// ===============================
// AUTENTICAÇÃO DO SISTEMA
// ===============================

function getUsuariosSistema() {
  if (typeof getUsers === 'function') {
    const users = getUsers();
    return Array.isArray(users) ? users : [];
  }

  const raw = localStorage.getItem('farm_users');
  if (!raw) return [];

  try {
    const users = JSON.parse(raw);
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function getUsuarioLogado() {
  if (typeof getCurrentUser === 'function') {
    return getCurrentUser();
  }

  const raw = localStorage.getItem('farm_current_user');
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getTokenSessao() {
  if (typeof getSessionToken === 'function') {
    return getSessionToken();
  }

  return localStorage.getItem('farm_session_token');
}

function salvarSessaoUsuario(user) {
  if (typeof saveCurrentUser === 'function') {
    saveCurrentUser(user);
  } else {
    localStorage.setItem('farm_current_user', JSON.stringify(user));
  }

  const token = `token_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  if (typeof saveSessionToken === 'function') {
    saveSessionToken(token);
  } else {
    localStorage.setItem('farm_session_token', token);
  }
}

function limparSessaoUsuario() {
  if (typeof logoutUser === 'function') {
    logoutUser();
    return;
  }

  localStorage.removeItem('farm_current_user');
  localStorage.removeItem('farm_session_token');
}

function usuarioAindaExiste(user) {
  if (!user) return false;

  const usuarios = getUsuariosSistema();

  return usuarios.some((u) => {
    return (
      Number(u.id) === Number(user.id) ||
      (u.usuario && user.usuario && u.usuario === user.usuario) ||
      (u.email && user.email && u.email === user.email)
    );
  });
}

function isAuthenticated() {
  const user = getUsuarioLogado();
  const token = getTokenSessao();

  if (!user || !token) return false;
  if (!usuarioAindaExiste(user)) return false;

  return true;
}

// ===============================
// PROTEGER PÁGINAS INTERNAS
// ===============================
function protectPage() {
  if (!isAuthenticated()) {
    limparSessaoUsuario();
    window.location.href = 'index.html';
    return false;
  }

  return true;
}

// ===============================
// IMPEDIR VOLTA AO LOGIN SE JÁ ESTIVER LOGADO
// ===============================
function redirectIfAuthenticated() {
  if (isAuthenticated()) {
    window.location.href = 'dashboard.html';
    return true;
  }

  return false;
}

// ===============================
// LOGIN
// ===============================
function loginSistema(login, senha) {
  const usuarios = getUsuariosSistema();

  const loginInformado = String(login || '')
    .trim()
    .toLowerCase();
  const senhaInformada = String(senha || '');

  const usuario = usuarios.find((u) => {
    const usuarioMatch =
      String(u.usuario || u.username || '')
        .trim()
        .toLowerCase() === loginInformado;

    const emailMatch =
      String(u.email || '')
        .trim()
        .toLowerCase() === loginInformado;

    const senhaMatch = String(u.senha || u.password || '') === senhaInformada;

    return (usuarioMatch || emailMatch) && senhaMatch;
  });

  if (!usuario) {
    return {
      sucesso: false,
      mensagem: 'Usuário, email ou senha inválidos.',
    };
  }

  salvarSessaoUsuario(usuario);

  return {
    sucesso: true,
    mensagem: 'Login realizado com sucesso.',
    usuario,
  };
}

// ===============================
// LOGOUT
// ===============================
function logout() {
  limparSessaoUsuario();
  window.location.href = 'index.html';
}

// ===============================
// EXIBIR NOME DO USUÁRIO
// ===============================
function preencherNomeUsuario(elementId = 'userName') {
  const el = document.getElementById(elementId);
  if (!el) return;

  const user = getUsuarioLogado();
  el.textContent = user?.nome || user?.usuario || 'Usuário';
}
