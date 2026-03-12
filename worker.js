// ═══════════════════════════════════════
// AI Chatbot - Cloudflare Workers
// Powered by Groq (Free!)
// ═══════════════════════════════════════

const MODEL = "llama-3.3-70b-versatile";

const BASE_SYSTEM = `Bạn là một AI thông minh, thân thiện và cực kỳ có ích.
- Trả lời ngắn gọn, rõ ràng
- Làm ĐÚNG theo lệnh người dùng
- Thân thiện như người bạn
- Trả lời bằng tiếng Việt trừ khi được yêu cầu khác`;

// Lưu sessions trong memory (mỗi worker instance)
const sessions = new Map();

// ── Gọi Groq API ──
async function callGroq(messages, system, maxTokens = 2048, apiKey) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...messages]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Groq API error");
  return data.choices[0].message.content;
}

// ── CORS Headers ──
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() }
  });
}

// ── HTML Giao diện chat ──
function chatHTML() {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>AI Chat</title>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
  :root {
    --bg: #0d0f14; --surface: #161920; --surface2: #1e2230;
    --border: #2a2f42; --accent: #7c6aff; --accent2: #4fc3f7;
    --text: #e8eaf0; --text-muted: #6b7280;
    --user-bubble: #7c6aff; --ai-bubble: #1e2230; --radius: 18px;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Sora',sans-serif; background:var(--bg); color:var(--text); height:100vh; display:flex; flex-direction:column; overflow:hidden; }
  body::before { content:''; position:fixed; inset:0; background:radial-gradient(ellipse 80% 50% at 20% 10%,rgba(124,106,255,.08) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 90%,rgba(79,195,247,.06) 0%,transparent 60%); pointer-events:none; z-index:0; }
  .header { position:relative; z-index:10; display:flex; align-items:center; gap:14px; padding:16px 24px; background:rgba(22,25,32,.9); border-bottom:1px solid var(--border); backdrop-filter:blur(20px); }
  .avatar { width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,var(--accent),var(--accent2)); display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow:0 0 20px rgba(124,106,255,.4); }
  .header-info h1 { font-size:15px; font-weight:600; letter-spacing:-.3px; }
  .status { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-muted); }
  .status-dot { width:7px; height:7px; border-radius:50%; background:#4ade80; animation:pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.85)} }
  .header-actions { margin-left:auto; display:flex; gap:8px; }
  .btn-icon { width:36px; height:36px; border-radius:10px; border:1px solid var(--border); background:var(--surface2); color:var(--text-muted); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:16px; transition:all .2s; }
  .btn-icon:hover { background:var(--border); color:var(--text); }
  .chat-area { flex:1; overflow-y:auto; padding:24px 0; position:relative; z-index:1; scroll-behavior:smooth; }
  .chat-area::-webkit-scrollbar { width:4px; }
  .chat-area::-webkit-scrollbar-thumb { background:var(--border); border-radius:4px; }
  .messages-container { max-width:780px; margin:0 auto; padding:0 20px; display:flex; flex-direction:column; gap:20px; }
  .welcome { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; text-align:center; gap:16px; }
  .welcome-icon { width:64px; height:64px; border-radius:20px; background:linear-gradient(135deg,var(--accent),var(--accent2)); display:flex; align-items:center; justify-content:center; font-size:28px; box-shadow:0 0 40px rgba(124,106,255,.3); animation:float 3s ease-in-out infinite; }
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  .welcome h2 { font-size:24px; font-weight:600; letter-spacing:-.5px; }
  .welcome p { font-size:14px; color:var(--text-muted); max-width:360px; line-height:1.6; }
  .quick-prompts { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:8px; }
  .quick-btn { padding:8px 16px; border-radius:20px; border:1px solid var(--border); background:var(--surface); color:var(--text-muted); font-size:13px; font-family:'Sora',sans-serif; cursor:pointer; transition:all .2s; }
  .quick-btn:hover { border-color:var(--accent); color:var(--accent); background:rgba(124,106,255,.08); }
  .message { display:flex; gap:12px; animation:fadeUp .3s ease; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  .message.user { flex-direction:row-reverse; }
  .msg-avatar { width:32px; height:32px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; margin-top:2px; }
  .message.ai .msg-avatar { background:linear-gradient(135deg,var(--accent),var(--accent2)); box-shadow:0 0 12px rgba(124,106,255,.3); }
  .message.user .msg-avatar { background:var(--surface2); border:1px solid var(--border); }
  .bubble { max-width:72%; padding:13px 17px; border-radius:var(--radius); font-size:14px; line-height:1.65; word-break:break-word; }
  .message.ai .bubble { background:var(--ai-bubble); border:1px solid var(--border); border-radius:4px var(--radius) var(--radius) var(--radius); }
  .message.user .bubble { background:var(--user-bubble); border-radius:var(--radius) 4px var(--radius) var(--radius); color:#fff; }
  .bubble pre { background:rgba(0,0,0,.4); border:1px solid var(--border); border-radius:10px; padding:12px; margin:10px 0; overflow-x:auto; font-family:'JetBrains Mono',monospace; font-size:12.5px; line-height:1.6; }
  .bubble code { font-family:'JetBrains Mono',monospace; font-size:12.5px; background:rgba(124,106,255,.15); padding:2px 6px; border-radius:5px; }
  .bubble pre code { background:none; padding:0; }
  .typing { display:flex; gap:5px; padding:14px 18px; align-items:center; }
  .typing span { width:7px; height:7px; border-radius:50%; background:var(--accent); animation:bounce 1.2s infinite; }
  .typing span:nth-child(2){animation-delay:.2s;background:var(--accent2)} .typing span:nth-child(3){animation-delay:.4s}
  @keyframes bounce { 0%,60%,100%{transform:translateY(0);opacity:.6} 30%{transform:translateY(-6px);opacity:1} }
  .input-area { position:relative; z-index:10; padding:16px 20px 20px; background:rgba(13,15,20,.95); border-top:1px solid var(--border); backdrop-filter:blur(20px); }
  .input-wrapper { max-width:780px; margin:0 auto; display:flex; gap:10px; align-items:flex-end; background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:10px 10px 10px 16px; transition:border-color .2s,box-shadow .2s; }
  .input-wrapper:focus-within { border-color:var(--accent); box-shadow:0 0 0 3px rgba(124,106,255,.1); }
  textarea { flex:1; background:none; border:none; outline:none; color:var(--text); font-family:'Sora',sans-serif; font-size:14px; line-height:1.6; resize:none; max-height:140px; min-height:24px; padding:2px 0; }
  textarea::placeholder { color:var(--text-muted); }
  .send-btn { width:38px; height:38px; border-radius:11px; background:var(--accent); border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:16px; color:white; flex-shrink:0; transition:all .2s; box-shadow:0 4px 12px rgba(124,106,255,.35); }
  .send-btn:hover{background:#6b59f0;transform:scale(1.05)} .send-btn:active{transform:scale(.97)} .send-btn:disabled{opacity:.4;cursor:not-allowed;transform:none}
  .hint { text-align:center; font-size:11px; color:var(--text-muted); margin-top:10px; }
  .modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:100; backdrop-filter:blur(4px); align-items:center; justify-content:center; }
  .modal-overlay.open { display:flex; }
  .modal { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:28px; width:90%; max-width:480px; animation:fadeUp .25s ease; }
  .modal h3{font-size:16px;margin-bottom:8px} .modal p{font-size:13px;color:var(--text-muted);margin-bottom:16px;line-height:1.5}
  .modal textarea { width:100%; background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:12px; color:var(--text); font-family:'Sora',sans-serif; font-size:13px; min-height:100px; resize:vertical; margin-bottom:16px; }
  .modal-actions{display:flex;gap:10px;justify-content:flex-end}
  .btn{padding:9px 20px;border-radius:10px;font-family:'Sora',sans-serif;font-size:13px;font-weight:500;cursor:pointer;border:none;transition:all .2s}
  .btn-ghost{background:var(--surface2);color:var(--text-muted)} .btn-ghost:hover{color:var(--text)}
  .btn-primary{background:var(--accent);color:white} .btn-primary:hover{background:#6b59f0}
</style>
</head>
<body>
<div class="header">
  <div class="avatar">🤖</div>
  <div class="header-info">
    <h1>AI Assistant</h1>
    <div class="status"><div class="status-dot"></div><span>Đang hoạt động</span></div>
  </div>
  <div class="header-actions">
    <button class="btn-icon" onclick="openModal()" title="Tùy chỉnh AI">⚙️</button>
    <button class="btn-icon" onclick="clearChat()" title="Xóa hội thoại">🗑️</button>
  </div>
</div>
<div class="chat-area" id="chatArea">
  <div class="messages-container" id="messages">
    <div class="welcome" id="welcome">
      <div class="welcome-icon">🤖</div>
      <h2>Xin chào! Tôi là AI của bạn</h2>
      <p>Tôi có thể chat, viết code và làm nhiều thứ khác. Hỏi tôi bất cứ điều gì!</p>
      <div class="quick-prompts">
        <button class="quick-btn" onclick="sendQuick('Xin chào! Bạn có thể làm gì?')">👋 Chào hỏi</button>
        <button class="quick-btn" onclick="sendQuick('Viết code Python sắp xếp mảng tối ưu nhất')">💻 Viết code</button>
        <button class="quick-btn" onclick="sendQuick('Giải thích machine learning cho người mới')">🧠 Học AI</button>
        <button class="quick-btn" onclick="sendQuick('Kể cho tôi một câu chuyện thú vị')">📖 Kể chuyện</button>
      </div>
    </div>
  </div>
</div>
<div class="input-area">
  <div class="input-wrapper">
    <textarea id="userInput" placeholder="Nhắn tin với AI..." rows="1" onkeydown="handleKey(event)" oninput="autoResize(this)"></textarea>
    <button class="send-btn" id="sendBtn" onclick="sendMessage()">➤</button>
  </div>
  <div class="hint">Enter để gửi · Shift+Enter xuống dòng</div>
</div>
<div class="modal-overlay" id="modalOverlay">
  <div class="modal">
    <h3>⚙️ Tùy chỉnh AI</h3>
    <p>Nhập hướng dẫn cho AI — ví dụ: "Bạn là chuyên gia tài chính tên Minh"</p>
    <textarea id="systemInput" placeholder="Bạn là một trợ lý AI thông minh..."></textarea>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="saveSystem()">Lưu & Áp dụng</button>
    </div>
  </div>
</div>
<script>
  const USER_ID = 'user_' + Math.random().toString(36).slice(2,8);
  let systemPrompt = '';
  let isLoading = false;

  function autoResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,140)+'px'; }
  function handleKey(e) { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();} }
  function sendQuick(t) { document.getElementById('userInput').value=t; sendMessage(); }

  function formatText(t) {
    return t
      .replace(/\`\`\`(\w*)\n?([\s\S]*?)\`\`\`/g,'<pre><code>$2</code></pre>')
      .replace(/\`([^\`]+)\`/g,'<code>$1</code>')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.*?)\*/g,'<em>$1</em>')
      .replace(/\n/g,'<br>');
  }

  function addMessage(role, text) {
    const w = document.getElementById('welcome');
    if(w) w.remove();
    const c = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = 'message '+role;
    d.innerHTML = '<div class="msg-avatar">'+(role==='ai'?'🤖':'👤')+'</div><div class="bubble">'+(role==='ai'?formatText(text):text.replace(/\n/g,'<br>'))+'</div>';
    c.appendChild(d);
    scrollDown();
  }

  function showTyping() {
    const c = document.getElementById('messages');
    const d = document.createElement('div');
    d.className='message ai'; d.id='typing-indicator';
    d.innerHTML='<div class="msg-avatar">🤖</div><div class="bubble typing"><span></span><span></span><span></span></div>';
    c.appendChild(d); scrollDown();
  }

  function hideTyping() { const e=document.getElementById('typing-indicator'); if(e) e.remove(); }
  function scrollDown() { const a=document.getElementById('chatArea'); a.scrollTop=a.scrollHeight; }

  async function sendMessage() {
    if(isLoading) return;
    const input = document.getElementById('userInput');
    const text = input.value.trim();
    if(!text) return;
    input.value=''; input.style.height='auto';
    isLoading=true; document.getElementById('sendBtn').disabled=true;
    addMessage('user', text);
    showTyping();
    try {
      const res = await fetch('/chat', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({user_id:USER_ID, message:text, system_prompt:systemPrompt||null})
      });
      const data = await res.json();
      hideTyping();
      addMessage('ai', data.reply || '⚠️ Lỗi: '+JSON.stringify(data));
    } catch(err) {
      hideTyping();
      addMessage('ai', '⚠️ Lỗi kết nối: '+err.message);
    }
    isLoading=false; document.getElementById('sendBtn').disabled=false;
    document.getElementById('userInput').focus();
  }

  async function clearChat() {
    try { await fetch('/session/'+USER_ID, {method:'DELETE'}); } catch(e){}
    document.getElementById('messages').innerHTML = '<div class="welcome" id="welcome"><div class="welcome-icon">🤖</div><h2>Hội thoại mới</h2><p>Hỏi tôi bất cứ điều gì!</p></div>';
  }

  function openModal() { document.getElementById('systemInput').value=systemPrompt; document.getElementById('modalOverlay').classList.add('open'); }
  function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }
  function saveSystem() { systemPrompt=document.getElementById('systemInput').value.trim(); closeModal(); if(systemPrompt) addMessage('ai','✅ Đã áp dụng hướng dẫn mới!'); }
  document.getElementById('modalOverlay').addEventListener('click',function(e){if(e.target===this)closeModal();});
  document.getElementById('userInput').focus();
</script>
</body>
</html>`;
}

// ── Main Handler ──
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // GET / → Giao diện chat
    if (method === "GET" && path === "/") {
      return new Response(chatHTML(), {
        headers: { "Content-Type": "text/html;charset=UTF-8" }
      });
    }

    // GET /api → Info
    if (method === "GET" && path === "/api") {
      return jsonResponse({ message: "🤖 AI API (Cloudflare + Groq)", model: MODEL });
    }

    // POST /chat
    if (method === "POST" && path === "/chat") {
      try {
        const body = await request.json();
        const { user_id = "default", message, system_prompt, reset } = body;

        if (!message) return jsonResponse({ error: "Thiếu message" }, 400);

        if (reset || !sessions.has(user_id)) sessions.set(user_id, []);
        const history = sessions.get(user_id);
        history.push({ role: "user", content: message });

        const reply = await callGroq(history, system_prompt || BASE_SYSTEM, 2048, env.GROQ_API_KEY);
        history.push({ role: "assistant", content: reply });

        // Giới hạn lịch sử 20 tin nhắn
        if (history.length > 40) history.splice(0, 2);

        return jsonResponse({ user_id, reply, turns: history.length / 2 });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // DELETE /session/:id
    if (method === "DELETE" && path.startsWith("/session/")) {
      const uid = path.replace("/session/", "");
      sessions.delete(uid);
      return jsonResponse({ message: `Đã xoá session ${uid}` });
    }

    // GET /sessions
    if (method === "GET" && path === "/sessions") {
      const result = {};
      for (const [uid, msgs] of sessions) result[uid] = { turns: msgs.length / 2 };
      return jsonResponse(result);
    }

    return jsonResponse({ error: "Not found" }, 404);
  }
};
