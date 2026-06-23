const $ = (id) => document.getElementById(id);

function setStatus(html) { $("status").innerHTML = html; }

async function refresh() {
  const { server, token } = await chrome.storage.local.get(["server", "token"]);
  if (server) $("server").value = server;
  const loggedIn = !!token;
  $("logout").classList.toggle("hide", !loggedIn);
  $("connect").textContent = loggedIn ? "Kết nối lại" : "Đăng nhập & Kết nối";

  chrome.runtime.sendMessage({ type: "status" }, (st) => {
    if (chrome.runtime.lastError || !st) { setStatus('<span class="muted">Khởi động…</span>'); return; }
    if (!loggedIn) { setStatus('<span class="muted">Chưa đăng nhập.</span>'); return; }
    const dot = st.connected ? '<span class="dot on"></span>Đã kết nối server'
                             : '<span class="dot off"></span>Mất kết nối';
    const ck = st.cookiesSent ? "✅ đã gửi cookie Google" : "⚠️ chưa lấy được cookie (đăng nhập labs.google?)";
    const pj = st.projectId ? `✅ project: <code>${st.projectId.slice(0, 8)}…</code>`
                            : "⚠️ chưa mở project Flow (mở 1 project trên labs.google)";
    const err = st.error ? `<br><span style="color:#fca5a5">${st.error}</span>` : "";
    setStatus(`${dot}<br>${ck}<br>${pj}${err}`);
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
    await chrome.storage.local.set({ server, token: d.access_token });
    setStatus("✅ Đăng nhập OK, đang kết nối…");
    chrome.runtime.sendMessage({ type: "reconnect" }, () => setTimeout(refresh, 800));
  } catch (e) {
    setStatus("❌ Không gọi được server: " + e + "<br><span class='muted'>Kiểm tra URL + server đang chạy.</span>");
  }
};

$("logout").onclick = () => {
  chrome.runtime.sendMessage({ type: "logout" }, () => refresh());
};

refresh();
setInterval(refresh, 2500);
