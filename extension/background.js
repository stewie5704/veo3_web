// VEO3 Web Bridge — service worker.
// Connects to the VEO3 Web server over WebSocket, pushes the user's labs.google cookies +
// Flow project id, and answers captcha requests with a reCAPTCHA Enterprise token.
//
// Config (server URL + JWT) is set from the popup and stored in chrome.storage.local.

const FLOW_URL = "https://labs.google/fx/tools/flow";
const SITEKEY_FALLBACK = "6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV";
const BRIDGE_VERSION = "1.7.8";
const BRIDGE_CAPABILITIES = ["flow_api_proxy", "flow_api_proxy_v4"];

let ws = null;
let everOpened = false;      // phiên WS hiện tại đã open chưa (phân biệt rớt mạng vs token chết)
let reconnectTimer = null;
const state = {
  connected: false, cookiesSent: false, projectId: "", error: "", needLogin: false,
  bridgeVersion: BRIDGE_VERSION, flowApiProxy: true,
  googleSessionValid: true, googleSessionError: "",
};

// Token còn hợp lệ không? 401/403 = chết -> đừng reconnect nữa, bắt user đăng nhập lại.
// Lỗi mạng/server-down -> coi như "chưa chắc" (giữ token, cứ thử lại).
async function tokenValid(server, token) {
  try {
    const r = await fetch(`${server.replace(/\/+$/, "")}/api/v1/auth/me`, {
      headers: { authorization: "Bearer " + token },
    });
    return !(r.status === 401 || r.status === 403);
  } catch (e) { return true; }
}

// ── config ───────────────────────────────────────────────────────────────────
async function getConfig() {
  return await chrome.storage.local.get(["server", "token"]);
}

function wsUrl(server, token) {
  const base = server.replace(/\/+$/, "").replace(/^http/i, "ws"); // http→ws, https→wss
  return `${base}/ws/extension?token=${encodeURIComponent(token)}`;
}

// ── cookies + project id ───────────────────────────────────────────────────────
async function gatherCookies() {
  try {
    const urls = [
      "https://labs.google/",
      "https://labs.google/fx/",
      "https://labs.google/fx/tools/flow",
      "https://labs.google/fx/api/auth",
      "https://labs.google/fx/api/auth/session",
    ];

    // 1. Quét cookies thông thường
    const fromDomain = await chrome.cookies.getAll({ domain: "labs.google" }).catch(() => []);
    const fromUrls = await Promise.all(urls.map(u => chrome.cookies.getAll({ url: u }).catch(() => [])));
    const fromGoogle = await chrome.cookies.getAll({ domain: ".google.com" }).catch(() => []);

    // 2. Quét cookies Partitioned (CHIPS) - CHỈ CHROME MV3 CÓ partitionKey: {}
    const fromPartitionDomain = await chrome.cookies.getAll({ domain: "labs.google", partitionKey: {} }).catch(() => []);
    const fromPartitionUrls = await Promise.all(urls.map(u => chrome.cookies.getAll({ url: u, partitionKey: {} }).catch(() => [])));
    const fromAllPartitioned = await chrome.cookies.getAll({ partitionKey: {} }).catch(() => []);

    const map = new Map();
    const all = [
      ...fromDomain,
      ...fromUrls.flat(),
      ...fromPartitionDomain,
      ...fromPartitionUrls.flat(),
    ];

    for (const c of all) {
      if (c && c.name && !map.has(c.name)) {
        map.set(c.name, c.value);
      }
    }

    // Thêm các cookie có chứa next-auth hoặc session-token từ allPartitioned
    for (const c of fromAllPartitioned) {
      if (c && c.name && (c.name.includes("next-auth") || c.name.includes("session-token") || (c.domain && c.domain.includes("labs.google")))) {
        if (!map.has(c.name)) {
          map.set(c.name, c.value);
        }
      }
    }

    for (const c of fromGoogle) {
      if (c && c.name && (c.name.startsWith("__Secure") || c.name.startsWith("SAPISID") || c.name.startsWith("SSID") || c.name.startsWith("SID") || c.name.startsWith("HSID") || c.name.includes("auth"))) {
        if (!map.has(c.name)) {
          map.set(c.name, c.value);
        }
      }
    }
    return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
  } catch (e) {
    console.error("gatherCookies error:", e);
    return "";
  }
}

function _extractUuid(text) {
  if (!text) return "";
  const m = String(text).match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
  if (m) return m[1].toLowerCase();
  const m2 = String(text).match(/\/projects?\/([a-zA-Z0-9_-]{16,})/);
  return m2 ? m2[1] : "";
}

async function findExistingFlowTabs() {
  const allTabs = await chrome.tabs.query({}).catch(() => []);
  const flowTabs = [];
  for (const t of allTabs) {
    const u = (t.url || "").toLowerCase();
    const title = (t.title || "").toLowerCase();
    if (u.includes("labs.google") || title.includes("google flow") || title.includes("flow")) {
      flowTabs.push(t);
    }
  }
  return flowTabs;
}

async function getProjectId() {
  const flowTabs = await findExistingFlowTabs();

  // 1) Ưu tiên số 1: Quét URL của tất cả các tab Flow đã mở
  for (const t of flowTabs) {
    const pid = _extractUuid(t.url);
    if (pid) return pid;
  }

  // 2) Đọc trực tiếp từ bên trong các tab Flow đang mở (DOM, window.location, localStorage)
  for (const t of flowTabs) {
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: t.id },
        world: "MAIN",
        func: () => {
          // A. Check window.location.href
          const href = window.location.href || "";
          const m = href.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/i);
          if (m) return m[1].toLowerCase();

          // B. Check links thẻ dự án trong trang
          const links = document.querySelectorAll('a[href*="/project/"]');
          for (const l of links) {
            if (l.href) {
              const lm = l.href.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/i);
              if (lm) return lm[1].toLowerCase();
            }
          }

          // C. Check localStorage
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              const v = localStorage.getItem(k);
              const vm = String(v).match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/i);
              if (vm) return vm[1].toLowerCase();
            }
          } catch (e) {}

          return "";
        }
      });
      if (res && res.result) return res.result;
    } catch (e) {}
  }

  // 3) Nếu user ĐÃ có tab Flow mở nhưng đang ở màn hình danh sách (chưa vào project):
  // Tận dụng chính tab đó: thử click vào project đầu tiên trong danh sách, TUYỆT ĐỐI KHÔNG mở thêm tab rác!
  if (flowTabs.length > 0) {
    const t = flowTabs[0];
    try {
      await chrome.scripting.executeScript({
        target: { tabId: t.id },
        func: () => {
          const firstCard = document.querySelector('a[href*="/project/"]') ||
                            document.querySelector('[data-testid*="project"]');
          if (firstCard) firstCard.click();
        }
      });
      await new Promise((r) => setTimeout(r, 1500));
      const fresh = await chrome.tabs.get(t.id).catch(() => null);
      const pid = _extractUuid(fresh && fresh.url);
      if (pid) return pid;
    } catch (e) {}
    // Nếu vẫn chưa vào project, dừng lại ở đây (báo user chọn 1 project) thay vì mở thêm tab mới
    return "";
  }

  // 4) CHỈ khi người dùng HOÀN TOÀN CHƯA MỞ tab Flow nào thì mới mở 1 tab mới duy nhất
  try {
    const { tab } = await ensureLabsTab();
    let pid = "";
    for (let i = 0; i < 8; i++) {
      const fresh = await chrome.tabs.get(tab.id).catch(() => null);
      pid = _extractUuid(fresh && fresh.url);
      if (pid) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return pid;
  } catch (e) {
    return "";
  }
}

async function checkGoogleSession() {
  const flowTabs = await findExistingFlowTabs();

  for (const t of flowTabs) {
    if (!t.id) continue;

    // 1. Quét đồng bộ DOM, localStorage, sessionStorage, __NEXT_DATA__
    try {
      const [resSync] = await chrome.scripting.executeScript({
        target: { tabId: t.id },
        world: "MAIN",
        func: () => {
          let token = "";
          let user = null;

          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              const v = localStorage.getItem(k);
              if (v && v.includes("ya29.")) {
                const m = v.match(/(ya29\.[a-zA-Z0-9_-]+)/);
                if (m) { token = m[1]; break; }
              }
            }
          } catch (e) {}

          if (!token) {
            try {
              for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                const v = sessionStorage.getItem(k);
                if (v && v.includes("ya29.")) {
                  const m = v.match(/(ya29\.[a-zA-Z0-9_-]+)/);
                  if (m) { token = m[1]; break; }
                }
              }
            } catch (e) {}
          }

          if (!token && window.__NEXT_DATA__) {
            try {
              const s = JSON.stringify(window.__NEXT_DATA__);
              const m = s.match(/(ya29\.[a-zA-Z0-9_-]+)/);
              if (m) token = m[1];
            } catch (e) {}
          }

          return { token, user };
        },
      });

      if (resSync && resSync.result && resSync.result.token) {
        return { valid: true, error: "", access_token: resSync.result.token };
      }
    } catch (e) {}

    // 2. Chạy fetch async bên trong tab Flow của user
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: t.id },
        world: "MAIN",
        func: async () => {
          try {
            const r = await fetch("/fx/api/auth/session", {
              cache: "no-store",
              headers: { accept: "application/json" },
            });
            const data = await r.json().catch(() => ({}));
            let tok = data && (data.access_token || data.token || data.accessToken);
            if (!tok && data) {
              const s = JSON.stringify(data);
              const m = s.match(/(ya29\.[a-zA-Z0-9_-]+)/);
              if (m) tok = m[1];
            }
            return { ok: r.ok, status: r.status, data, token: tok || "" };
          } catch (e) {
            return { ok: false, error: String(e) };
          }
        },
      });

      if (res && res.result) {
        const data = res.result.data || {};
        if (data.error === "ACCESS_TOKEN_REFRESH_NEEDED") {
          return { valid: false, error: "ACCESS_TOKEN_REFRESH_NEEDED", email: data.user?.email || "" };
        }
        const tok = res.result.token || data.access_token || data.token || data.accessToken;
        if (tok) {
          return { valid: true, error: "", email: data.user?.email || "", access_token: tok };
        }
        if (data.user && !data.error) {
          return { valid: true, error: "", email: data.user?.email || "" };
        }
      }
    } catch (e) {
      console.warn("checkGoogleSession in tab error:", e);
    }
  }

  // 3. Fallback: fetch từ service worker
  try {
    const res = await fetch("https://labs.google/fx/api/auth/session", {
      credentials: "include",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (data && data.error === "ACCESS_TOKEN_REFRESH_NEEDED") {
      return { valid: false, error: "ACCESS_TOKEN_REFRESH_NEEDED", email: data.user?.email || "" };
    }
    let token = data && (data.access_token || data.token || data.accessToken);
    if (!token && data) {
      const s = JSON.stringify(data);
      const m = s.match(/(ya29\.[a-zA-Z0-9_-]+)/);
      if (m) token = m[1];
    }
    if (token) {
      return { valid: true, error: "", email: data.user?.email || "", access_token: token };
    }
    if (data && data.user && !data.error) {
      return { valid: true, error: "", email: data.user?.email || "" };
    }
  } catch (e) {}

  return { valid: false, error: "NO_SESSION", email: "" };
}

let isPushingCookies = false;
let lastPushTime = 0;

async function pushCookies() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const now = Date.now();
  if (isPushingCookies || (now - lastPushTime < 2500)) return;
  isPushingCookies = true;
  lastPushTime = now;

  try {
    const flowTabs = await findExistingFlowTabs();
    const cookies = await gatherCookies();
    const project_id = await getProjectId();
    const sessionCheck = await checkGoogleSession();

    let bearerToSend = sessionCheck.access_token || "";
    if (!bearerToSend && cookies.includes("ya29.")) {
      const m = cookies.match(/(ya29\.[a-zA-Z0-9_-]+)/);
      if (m) bearerToSend = m[1];
    }

    const hasCookies = !!cookies && cookies.length > 20;
    const hasNextAuth = cookies.toLowerCase().includes("session-token");
    const isRefreshNeeded = sessionCheck.error === "ACCESS_TOKEN_REFRESH_NEEDED";

    let isSessionOk = false;
    let sessionErr = "";

    if (isRefreshNeeded) {
      isSessionOk = false;
      sessionErr = "ACCESS_TOKEN_REFRESH_NEEDED";
      state.error = "Phiên Google đã hết hạn. Hãy mở tab Google Flow và đăng nhập lại.";
    } else if (bearerToSend || hasNextAuth) {
      // Bắt buộc có token bearer (ya29.) hoặc cookie session-token thực sự
      isSessionOk = true;
      sessionErr = "";
      state.error = "";
    } else {
      isSessionOk = false;
      sessionErr = "NO_SESSION";
      state.error = "Chưa đăng nhập Google Flow. Hãy mở tab Google Flow và bấm Đăng nhập (Sign in) bằng tài khoản Ultra.";
    }

    state.cookiesSent = isSessionOk;
    state.projectId = project_id;
    state.googleSessionValid = isSessionOk;
    state.googleSessionError = sessionErr;

    // Gói cả bearer_token vào cookies nếu có để lưu chắc chắn vào DB
    let cookiesPayload = cookies;
    if (bearerToSend && !cookiesPayload.includes("ya29_token=")) {
      cookiesPayload = cookiesPayload ? `${cookiesPayload}; ya29_token=${bearerToSend}` : `ya29_token=${bearerToSend}`;
    }

    ws.send(JSON.stringify({
      type: "cookies",
      cookies: cookiesPayload,
      project_id,
      bridge_version: BRIDGE_VERSION,
      capabilities: BRIDGE_CAPABILITIES,
      google_session_error: sessionErr,
      bearer_token: bearerToSend,
      debug: {
        cookies_len: cookiesPayload.length,
        has_session_token: hasNextAuth,
        has_bearer: !!bearerToSend,
        flow_tabs: flowTabs.length,
        session_check_err: sessionCheck.error,
      }
    }));
  } catch (e) {
    console.error("pushCookies error:", e);
  } finally {
    isPushingCookies = false;
  }
}

// ── reCAPTCHA Enterprise (run inside a logged-in labs.google tab) ───────────────
function waitForTabComplete(tabId, ms = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("tab load timeout"));
    }, ms);
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function waitForRecaptcha(tabId, tries = 12) {
  for (let i = 0; i < tries; i++) {
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId }, world: "MAIN",
        func: () => !!(window.grecaptcha && window.grecaptcha.enterprise),
      });
      if (res && res.result) return true;
    } catch (e) { /* tab not ready */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function ensureLabsTab() {
  const flowTabs = await findExistingFlowTabs();

  // 1) Nếu đã có tab chứa project, ưu tiên dùng ngay tab đó
  const projectTab = flowTabs.find((t) => _extractUuid(t.url));
  if (projectTab) return { tab: projectTab, isNew: false };

  // 2) Nếu đã có BẤT KỲ tab Flow nào mở -> DÙNG LẠI NGAY, TUYỆT ĐỐI KHÔNG MỞ THÊM TAB MỚI
  if (flowTabs.length > 0) return { tab: flowTabs[0], isNew: false };

  // 3) Chỉ khi KHÔNG CÓ tab Flow nào mới mở 1 tab
  let win = null;
  try { win = await chrome.windows.getLastFocused({ windowTypes: ["normal"] }); } catch (e) {}
  if (!win || win.id == null) {
    const all = await chrome.windows.getAll({ windowTypes: ["normal"] });
    win = all && all.length ? all[0] : null;
  }
  let tab;
  if (win && win.id != null) tab = await chrome.tabs.create({ windowId: win.id, url: FLOW_URL, active: false });
  else { const c = await chrome.windows.create({ url: FLOW_URL, focused: false }); tab = c && c.tabs && c.tabs[0]; }
  if (!tab) throw new Error("không mở được tab labs.google");
  await waitForTabComplete(tab.id, 20000);
  return { tab, isNew: true };
}

async function solveCaptcha(action) {
  try {
    const { tab, isNew } = await ensureLabsTab();
    const ready = await waitForRecaptcha(tab.id, 12);
    if (!ready) {
      if (isNew) chrome.tabs.remove(tab.id).catch(() => {});
      return { err: "grecaptcha.enterprise chưa sẵn sàng (đăng nhập labs.google chưa?)" };
    }
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, world: "MAIN",
      func: async (act, skFallback) => {
        try {
          // Flow's public enterprise key is fixed. Picking the first grecaptcha client
          // can select an unrelated widget after a Labs UI update and yields a valid-
          // looking token that Google rejects during evaluation.
          const token = await window.grecaptcha.enterprise.execute(skFallback, { action: act });
          return { token };
        } catch (e) { return { err: String(e) }; }
      },
      args: [action, SITEKEY_FALLBACK],
    });
    if (isNew) chrome.tabs.remove(tab.id).catch(() => {});
    return (res && res.result) || { err: "executeScript không trả kết quả" };
  } catch (e) {
    return { err: e.message || String(e) };
  }
}

async function proxyFlowApi(msg) {
  const requestId = String(msg.request_id || "");
  const url = String(msg.url || "");
  if (!requestId || !url.startsWith("https://aisandbox-pa.googleapis.com/v1/")) {
    return { request_id: requestId, status: 400, data: { error: "Flow API URL không hợp lệ" } };
  }
  const bearer = String(msg.bearer || "");
  if (!bearer) return { request_id: requestId, status: 401, data: { error: "Thiếu bearer" } };

  try {
    let body = JSON.parse(JSON.stringify(msg.body || {}));
    if (msg.captcha_action) {
      const solved = await solveCaptcha(String(msg.captcha_action));
      if (!solved.token) throw new Error(solved.err || "không lấy được reCAPTCHA");
      let injected = 0;
      const visit = (node) => {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!node || typeof node !== "object") return;
        for (const [key, value] of Object.entries(node)) {
          if (key.toLowerCase() === "recaptchacontext" && value && typeof value === "object") {
            value.token = solved.token;
            injected++;
          } else if (value && typeof value === "object") visit(value);
        }
      };
      visit(body);
      if (!injected) throw new Error("request không có recaptchaContext");
    }

    // The DNR rule in rules.json rewrites Origin + Referer to labs.google. This is
    // the reliable MV3 path: solve in the real Flow tab, submit from the extension
    // service worker with host permission, and let Chrome attach the Flow headers.
    const controller = new AbortController();
    // Flow's image endpoint often needs 30-90 seconds before returning the
    // generated asset. Video submission is normally faster, but still gets a
    // generous window so a slow Google response is not reported as an old bridge.
    const isImageGeneration = url.includes("/flowMedia:batchGenerateImages");
    const timeoutMs = isImageGeneration ? 120000 : 60000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          authorization: "Bearer " + bearer,
          "content-type": "text/plain;charset=UTF-8",
          accept: "*/*",
          "x-browser-channel": "stable",
          "x-browser-year": "2026",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); }
    catch { data = { _raw: raw.slice(0, 2000) }; }
    return { request_id: requestId, status: response.status, data };
  } catch (e) {
    return { request_id: requestId, status: 0, data: { error: String(e && e.message || e) } };
  }
}

// ── WebSocket ──────────────────────────────────────────────────────────────────
async function killTokenAndPromptLogin() {
  await chrome.storage.local.remove(["token"]);
  state.connected = false;
  state.needLogin = true;
  state.error = "Token hết hạn — mở popup đăng nhập lại";
}

async function connect() {
  const { server, token } = await getConfig();
  if (!server || !token) { if (!state.needLogin) state.error = "Chưa đăng nhập (mở popup để kết nối)"; return; }
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  everOpened = false;
  try { ws = new WebSocket(wsUrl(server, token)); }
  catch (e) { state.error = "URL server sai: " + e; return; }

  ws.onopen = () => {
    everOpened = true; state.connected = true; state.error = ""; state.needLogin = false;
    ws.send(JSON.stringify({ type: "hello", bridge_version: BRIDGE_VERSION, capabilities: BRIDGE_CAPABILITIES }));
    pushCookies();
  };
  ws.onerror = () => { try { ws.close(); } catch (e) {} };
  ws.onclose = async (ev) => {
    state.connected = false;
    ws = null;
    // Server từ chối rõ ràng (close code) -> token hỏng.
    if (ev && (ev.code === 4001 || ev.code === 4002)) { await killTokenAndPromptLogin(); return; }
    // Bắt tay bị 403 (reject trước accept) -> client thấy code 1006, KHÔNG bao giờ open.
    // Verify token: chết -> dừng loop + báo đăng nhập lại (hết cảnh quay vòng 403 vô tận).
    if (!everOpened) {
      const ok = await tokenValid(server, token);
      if (!ok) { await killTokenAndPromptLogin(); return; }
    }
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 3000); // rớt tạm thời -> thử lại
  };
  ws.onmessage = async (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === "connected") { state.connected = true; pushCookies(); }
    else if (msg.type === "ping") { try { ws.send(JSON.stringify({ type: "pong" })); } catch (e) {} }
    else if (msg.type === "get_captcha") {
      const r = await solveCaptcha(msg.action || "VIDEO_GENERATION");
      try { ws.send(JSON.stringify({ type: "captcha", token: r.token || "", err: r.err || "" })); } catch (e) {}
    }
    else if (msg.type === "api_request") {
      const r = await proxyFlowApi(msg);
      try { ws.send(JSON.stringify({ type: "api_response", ...r })); } catch (e) {}
    }
  };
}

// keep the SW alive + reconnect + refresh cookies (session-token rotates)
chrome.alarms.create("keepAlive", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => {
  try {
    connect();
    if (ws && ws.readyState === WebSocket.OPEN) {
      pushCookies().catch(() => {});
    }
  } catch (e) {}
});
chrome.runtime.onStartup.addListener(() => {
  try { connect(); } catch (e) {}
});
chrome.runtime.onInstalled.addListener(() => {
  try { connect(); } catch (e) {}
});

// Tự động kiểm tra project_id và cookie khi tab labs.google tải xong
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status === "complete" && tab && tab.url && tab.url.includes("labs.google")) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        pushCookies().catch(() => {});
      }
    }
  } catch (e) {}
});

connect();

// ── popup messaging ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "status") { sendResponse(state); return false; }
  if (msg.type === "open_flow") {
    ensureLabsTab().then(async ({ tab }) => {
      try {
        if (tab && tab.id) {
          await chrome.tabs.update(tab.id, { active: true });
          if (tab.windowId) {
            await chrome.windows.update(tab.windowId, { focused: true });
          }
        }
      } catch (e) {}
      sendResponse({ ok: true });
    }).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === "reconnect") {
    try { if (ws) ws.close(); } catch (e) {}
    ws = null; state.error = ""; state.needLogin = false;
    clearTimeout(reconnectTimer);
    connect().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "logout") {
    chrome.storage.local.remove(["token"]).then(() => {
      try { if (ws) ws.close(); } catch (e) {}
      ws = null; state.connected = false; sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === "pushcookies") { pushCookies().then(() => sendResponse({ ok: true })); return true; }
  return false;
});
