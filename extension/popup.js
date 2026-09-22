const $ = (id) => document.getElementById(id);

function setStatus(html) { $("status").innerHTML = html; }

let serverInitialized = false;

$("server").addEventListener("input", () => {
  serverInitialized = true;
});

async function refresh() {
  const { server, token } = await chrome.storage.local.get(["server", "token"]);
  if (server && !serverInitialized && document.activeElement !== $("server")) {
    $("server").value = server;
    serverInitialized = true;
  }
  const loggedIn = !!token;
  $("logout").classList.toggle("hide", !loggedIn);
  $("connect").textContent = loggedIn ? "Kết nối lại" : "Đăng nhập & Kết nối";

  chrome.runtime.sendMessage({ type: "status" }, (st) => {
    if (chrome.runtime.lastError || !st) { setStatus('<span class="muted">Khởi động…</span>'); return; }
    if (!loggedIn) { setStatus('<span class="muted">Chưa đăng nhập.</span>'); return; }
    const dot = st.connected ? '<span class="dot on"></span>Đã kết nối server'
                             : '<span class="dot off"></span>Mất kết nối';
    let ck = "";
    if (!st.cookiesSent || st.googleSessionError === "NO_SESSION") {
      ck = "⚠️ <b style='color:#fbbf24'>Chưa đăng nhập Google Flow!</b><br><button id='openFlowBtn' style='margin-top:6px;width:100%;background:#f59e0b;color:#111;font-weight:700;border:none;border-radius:6px;padding:7px;font-size:12px;cursor:pointer'>👉 Bấm để mở tab Flow & Đăng nhập</button>";
    } else if (st.googleSessionError === "ACCESS_TOKEN_REFRESH_NEEDED") {
      ck = "❌ <b style='color:#f87171'>Phiên Google hết hạn!</b><br><button id='openFlowBtn' style='margin-top:6px;width:100%;background:#ef4444;color:#fff;font-weight:700;border:none;border-radius:6px;padding:7px;font-size:12px;cursor:pointer'>👉 Xoá phiên cũ & Mở tab đăng nhập lại</button>";
    } else {
      ck = "✅ đã gửi cookie Google Flow (Ultra)";
    }
    const pj = st.projectId ? `✅ project: <code>${st.projectId.slice(0, 8)}…</code>`
                            : "⚠️ chưa mở project Flow (mở 1 project trên labs.google)";
    const err = st.error ? `<br><span style="color:#fca5a5">${st.error}</span>` : "";
    const ver = st.bridgeVersion ? `<br><span class="muted">Bridge v${st.bridgeVersion} · Flow API qua Chrome</span>` : "";
    setStatus(`${dot}<br>${ck}<br>${pj}${ver}${err}`);
  });
}

$("connect").onclick = async () => {
  const server = $("server").value.trim().replace(/\/+$/, "");
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!server || !email || !password) { setStatus("⚠️ Nhập đủ server, email, mật khẩu."); return; }
  setStatus("⏳ Đang đăng nhập…");
  try {
    const r = await fetch(`${server}/api/v1/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.access_token) { setStatus("❌ " + (d.detail || "Đăng nhập thất bại")); return; }
    // Đổi sang token sống lâu (30 ngày) dành riêng cho extension -> đỡ phải đăng nhập lại mỗi 24h
    let token = d.access_token;
    try {
      const er = await fetch(`${server}/api/v1/auth/extension-token`, {
        method: "POST", headers: { authorization: "Bearer " + d.access_token },
      });
      const ed = await er.json().catch(() => ({}));
      if (er.ok && ed.access_token) token = ed.access_token;
    } catch (e) { /* fallback dùng token 24h */ }
    await chrome.storage.local.set({ server, token });
    setStatus("✅ Đăng nhập OK, đang kết nối…");
    chrome.runtime.sendMessage({ type: "reconnect" }, () => setTimeout(refresh, 800));
  } catch (e) {
    setStatus("❌ Không gọi được server: " + e + "<br><span class='muted'>Kiểm tra URL + server đang chạy.</span>");
  }
};

$("logout").onclick = () => {
  chrome.runtime.sendMessage({ type: "logout" }, () => refresh());
};

document.addEventListener("click", (e) => {
  if (e.target && (e.target.id === "openFlowBtn" || e.target.closest?.("#openFlowBtn"))) {
    chrome.runtime.sendMessage({ type: "open_flow" });
  }
});

refresh();
setInterval(refresh, 2500);
