// VEO3 Web Bridge — service worker.
// Connects to the VEO3 Web server over WebSocket, pushes the user's labs.google cookies +
// Flow project id, and answers captcha requests with a reCAPTCHA Enterprise token.
//
// Config (server URL + JWT) is set from the popup and stored in chrome.storage.local.

const FLOW_URL = "https://labs.google/fx/tools/flow";
const SITEKEY_FALLBACK = "6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV";

let ws = null;
let everOpened = false;      // phiên WS hiện tại đã open chưa (phân biệt rớt mạng vs token chết)
let reconnectTimer = null;
const state = { connected: false, cookiesSent: false, projectId: "", error: "", needLogin: false };

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
  // The cookies API reads httpOnly cookies (e.g. __Secure-next-auth.session-token) that
  // document.cookie can't — exactly what the server needs to mint the ya29 token.
  const cks = await chrome.cookies.getAll({ url: "https://labs.google/" });
  return cks.map((c) => `${c.name}=${c.value}`).join("; ");
}

function _matchProject(url) {
  const m = (url || "").match(/\/project\/([0-9a-fA-F-]{36})/);
  return m ? m[1] : "";
}

async function getProjectId() {
  // 1) Đã có tab labs.google đang mở 1 project
  const tabs = await chrome.tabs.query({ url: "https://labs.google/*" });
  for (const t of tabs) {
    const pid = _matchProject(t.url);
    if (pid) return pid;
  }
  // 2) Fallback: mở Flow ngầm, đợi SPA redirect tới /project/<id> rồi đọc (tài khoản đã có project)
  try {
    const { tab, isNew } = await ensureLabsTab();
    let pid = "";
    for (let i = 0; i < 10; i++) {
      const fresh = await chrome.tabs.get(tab.id).catch(() => null);
      pid = _matchProject(fresh && fresh.url);
      if (pid) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (isNew && !pid) chrome.tabs.remove(tab.id).catch(() => {});
    return pid;
  } catch (e) {
    return "";
  }
}

async function pushCookies() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const cookies = await gatherCookies();
  const project_id = await getProjectId();
  state.cookiesSent = !!cookies;
  state.projectId = project_id;
  ws.send(JSON.stringify({ type: "cookies", cookies, project_id }));
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
  const tabs = await chrome.tabs.query({ url: "https://labs.google/*" });
  if (tabs && tabs.length) return { tab: tabs[0], isNew: false };
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
          let sk = skFallback;
          const clients = (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) || {};
          for (const k in clients) { if (clients[k] && clients[k].sitekey) { sk = clients[k].sitekey; break; } }
          const token = await window.grecaptcha.enterprise.execute(sk, { action: act });
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

  ws.onopen = () => { everOpened = true; state.connected = true; state.error = ""; state.needLogin = false; pushCookies(); };
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
  };
}

// keep the SW alive + reconnect + refresh cookies (session-token rotates)
chrome.alarms.create("keepAlive", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => {
  connect();
  if (ws && ws.readyState === WebSocket.OPEN) pushCookies();
});
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
connect();

// ── popup messaging ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "status") { sendResponse(state); return false; }
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
