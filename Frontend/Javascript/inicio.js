// ── NAVIGATION ──
function goTo(page) {
  window.location.href = page;
}

// ── SIDEBAR ACTIVE STATE ──
function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.remove('active');
    if (el.dataset.page === page) el.classList.add('active');
  });
}

// ── SIDEBAR BUILDER ──
function buildSidebar(activePage) {
  const nav = [
    { page: 'index.html', icon: iconGrid, label: 'Dashboard' },
    { page: 'medicamentos.html', icon: iconPill, label: 'Medicamentos' },
    { page: 'fornecedores.html', icon: iconTruck, label: 'Fornecedores' },
    { page: 'entrada.html', icon: iconPlus, label: 'Entrada' },
    { page: 'saida.html', icon: iconMinus, label: 'Saída' },
    { page: 'relatorio.html', icon: iconFile, label: 'Relatório' },
    { page: 'importacao.html', icon: iconUpload, label: 'Importação' },
  ];

  const navHtml = nav
    .map(
      (n) => `
    <button class="nav-item ${n.page === activePage ? 'active' : ''}" data-page="${n.page}" onclick="goTo('${n.page}')">
      ${n.icon} ${n.label}
    </button>
  `
    )
    .join('');

  return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">${iconLogo}</div>
        <div>
          <div class="logo-name">GestMed</div>
          <div class="logo-sub">Gestão Farmacêutica</div>
        </div>
      </div>
      <nav class="sidebar-nav">${navHtml}</nav>
      <div class="sidebar-footer">
        <button class="nav-item" onclick="alert('Saindo...')">
          ${iconLogout} Sair
        </button>
      </div>
    </aside>
  `;
}

function buildTopBar(title, subtitle, icon) {
  return `
    <div class="topbar">
      <div class="topbar-left">
        <div class="topbar-title">${icon} ${title}</div>
        <div class="topbar-sub">${subtitle}</div>
      </div>
      <div class="topbar-right">
        <div class="user-pill">${iconUser} Usuário</div>
      </div>
    </div>
  `;
}

function buildHelpFab() {
  return `
    <button class="help-fab" onclick="openChat()">
      <span class="fab-pulse"></span>
      ${iconChat} Ajuda
    </button>
    <div class="chat-overlay" id="chatOverlay" onclick="handleOverlayClick(event)">
      <div class="chat-box" id="chatBox">
        <div class="chat-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="chat-avatar">${iconBot}</div>
            <div><div class="chat-htitle">Assistente GestMed</div><div class="chat-hsub">Online · IA integrada</div></div>
          </div>
          <button class="chat-close" onclick="closeChat()">✕</button>
        </div>
        <div class="chat-messages" id="chatMessages">
          <div class="msg msg-bot">
            <div class="msg-bubble">Olá! 👋 Sou o assistente do GestMed. Como posso te ajudar hoje?</div>
            <div class="msg-time">agora</div>
          </div>
        </div>
        <div class="quick-btns" id="quickBtns">
          <button class="quick-btn" onclick="quickSend('Como cadastrar um medicamento?')">💊 Cadastrar med.</button>
          <button class="quick-btn" onclick="quickSend('Como registrar entrada de estoque?')">📦 Entrada</button>
          <button class="quick-btn" onclick="quickSend('Como gerar relatório?')">📄 Relatório</button>
          <button class="quick-btn" onclick="quickSend('O que é estoque mínimo?')">⚠️ Estoque mín.</button>
        </div>
        <div class="chat-input-row">
          <input class="chat-input" id="chatInput" type="text" placeholder="Digite sua dúvida..." onkeydown="handleChatKey(event)" />
          <button class="send-btn" onclick="sendChatMessage()">${iconSend}</button>
        </div>
      </div>
    </div>
  `;
}

// ── CHAT FUNCTIONS ──
function openChat() {
  document.getElementById('chatOverlay').classList.add('open');
  setTimeout(() => document.getElementById('chatInput').focus(), 200);
}
function closeChat() {
  document.getElementById('chatOverlay').classList.remove('open');
}
function handleOverlayClick(e) {
  if (e.target.id === 'chatOverlay') closeChat();
}
function handleChatKey(e) {
  if (e.key === 'Enter') sendChatMessage();
}
function quickSend(t) {
  document.getElementById('chatInput').value = t;
  const qb = document.getElementById('quickBtns');
  if (qb) qb.style.display = 'none';
  sendChatMessage();
}

function addChatMsg(text, type) {
  const msgs = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg msg-' + type;
  const now = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  div.innerHTML = `<div class="msg-bubble">${text}</div><div class="msg-time">${now}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}
function showTyping() {
  const msgs = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg msg-bot';
  div.id = 'typingEl';
  div.innerHTML =
    '<div class="msg-bubble"><div class="typing"><span></span><span></span><span></span></div></div>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}
function removeTyping() {
  const t = document.getElementById('typingEl');
  if (t) t.remove();
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  addChatMsg(text, 'user');
  showTyping();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system:
          'Você é o assistente virtual do GestMed, sistema de gestão farmacêutica. Responda dúvidas sobre: medicamentos, fornecedores, entradas, saídas, relatórios e importação. Seja direto, amigável e conciso. Responda em português. Sem markdown com asteriscos.',
        messages: [{ role: 'user', content: text }],
      }),
    });
    const data = await res.json();
    removeTyping();
    addChatMsg(data?.content?.[0]?.text || 'Desculpe, tente novamente.', 'bot');
  } catch (e) {
    removeTyping();
    addChatMsg('Erro de conexão. Tente novamente.', 'bot');
  }
}

// ── ICONS ──
const iconLogo = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#0a2d8f" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>`;
const iconGrid = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`;
const iconPill = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M10.5 20H4a2 2 0 01-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 011.66.9l.82 1.2a2 2 0 001.66.9H20a2 2 0 012 2v2.5"/><circle cx="17" cy="17" r="5"/><path d="M14.5 17h5"/></svg>`;
const iconTruck = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;
const iconPlus = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`;
const iconMinus = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`;
const iconFile = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>`;
const iconUpload = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
const iconLogout = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/></svg>`;
const iconUser = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>`;
const iconChat = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>`;
const iconBot = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-1"/></svg>`;
const iconSend = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
const iconAlert = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#b45309" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
const iconCheck = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#166534" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
const iconEdit = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const iconTrash = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`;
const iconSearch = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const iconCalendar = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
const iconDollar = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`;
const iconPkg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;
const iconDown = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
