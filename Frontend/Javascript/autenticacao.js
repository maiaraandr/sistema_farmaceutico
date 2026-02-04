/**
 * ========================================
 * AUTENTICAÇÃO
 * ========================================
 * Depende do Storage.js (saveToStorage, loadFromStorage, removeFromStorage, getUsers)
 */

/**
 * Fazer login
 */
function login(username, password, rememberMe = false) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const users = getUsers();

      const user = users.find(
        (u) => u.usuario === username && u.senha === password
      );

      if (!user) {
        resolve({
          success: false,
          message: "Usuário ou senha inválidos",
        });
        return;
      }

      const sessionData = {
        id: user.id,
        usuario: user.usuario,
        nome: user.nome,
        tipo: user.tipo,
        loginAt: new Date().toISOString(),
      };

      // Salva sessão e token
      saveToStorage(STORAGE_KEYS.CURRENT_USER, sessionData);

      const token = btoa(`${user.usuario}:${Date.now()}`);
      saveToStorage(STORAGE_KEYS.SESSION_TOKEN, token);

      // rememberMe (simples): marca preferência
      // (o localStorage já persiste, mas isso serve pra você controlar depois se quiser)
      saveToStorage("farm_remember_me", !!rememberMe);

      resolve({
        success: true,
        user: sessionData,
      });
    }, 500);
  });
}

/**
 * Fazer logout
 */
function logout() {
  removeFromStorage(STORAGE_KEYS.CURRENT_USER);
  removeFromStorage(STORAGE_KEYS.SESSION_TOKEN);
  removeFromStorage("farm_remember_me");

  // ✅ Sem barra inicial (evita quebrar quando abre por pasta)
  window.location.href = "index.html";
}

/**
 * Obter usuário atual
 */
function getCurrentUser() {
  return loadFromStorage(STORAGE_KEYS.CURRENT_USER);
}

/**
 * Verificar se está logado
 */
function isLoggedIn() {
  const user = getCurrentUser();
  const token = loadFromStorage(STORAGE_KEYS.SESSION_TOKEN);
  return !!(user && token);
}

/**
 * Verificar se é admin
 */
function isAdmin() {
  const user = getCurrentUser();
  return !!(user && user.tipo === "admin");
}

/**
 * Proteger página (redirecionar se não estiver logado)
 */
function protectPage() {
  if (!isLoggedIn()) {
    window.location.href = "index.html";
  }
}

/**
 * Proteger página apenas para admin
 */
function protectAdminPage() {
  if (!isLoggedIn()) {
    window.location.href = "index.html";
    return;
  }

  if (!isAdmin()) {
    alert("Acesso negado! Apenas administradores.");
    window.location.href = "dashboard.html";
  }
}
