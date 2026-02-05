//Autenticação simples usando localStorage//
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

      saveToStorage("farm_remember_me", !!rememberMe);

      resolve({
        success: true,
        user: sessionData,
      });
    }, 500);
  });
}

function logout() {
  removeFromStorage(STORAGE_KEYS.CURRENT_USER);
  removeFromStorage(STORAGE_KEYS.SESSION_TOKEN);
  removeFromStorage("farm_remember_me");

  window.location.href = "index.html";
}

function getCurrentUser() {
  return loadFromStorage(STORAGE_KEYS.CURRENT_USER);
}

function isLoggedIn() {
  const user = getCurrentUser();
  const token = loadFromStorage(STORAGE_KEYS.SESSION_TOKEN);
  return !!(user && token);
}

function isAdmin() {
  const user = getCurrentUser();
  return !!(user && user.tipo === "admin");
}

function protectPage() {
  if (!isLoggedIn()) {
    window.location.href = "index.html";
  }
}

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
