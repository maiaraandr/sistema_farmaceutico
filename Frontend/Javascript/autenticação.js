/**
 * ========================================
 * AUTENTICAÇÃO
 * ========================================
 */

/**
 * Fazer login
 */
function login(username, password, rememberMe = false) {
    return new Promise((resolve) => {
        // Simular delay de rede
        setTimeout(() => {
            const users = getUsers();
            const user = users.find(u => 
                u.usuario === username && u.senha === password
            );

            if (user) {
                // Login bem-sucedido
                const sessionData = {
                    id: user.id,
                    usuario: user.usuario,
                    nome: user.nome,
                    tipo: user.tipo,
                    loginAt: new Date().toISOString()
                };

                // Salvar sessão
                saveToStorage(STORAGE_KEYS.CURRENT_USER, sessionData);
                
                // Gerar token simples
                const token = btoa(`${user.usuario}:${Date.now()}`);
                saveToStorage(STORAGE_KEYS.SESSION_TOKEN, token);

                resolve({
                    success: true,
                    user: sessionData
                });
            } else {
                resolve({
                    success: false,
                    message: 'Usuário ou senha inválidos'
                });
            }
        }, 500);
    });
}

/**
 * Fazer logout
 */
function logout() {
    removeFromStorage(STORAGE_KEYS.CURRENT_USER);
    removeFromStorage(STORAGE_KEYS.SESSION_TOKEN);
    window.location.href = '/index.html';
}

/**
 * Verificar se está logado
 */
function isLoggedIn() {
    const user = getCurrentUser();
    const token = loadFromStorage(STORAGE_KEYS.SESSION_TOKEN);
    return user && token;
}

/**
 * Obter usuário atual
 */
function getCurrentUser() {
    return loadFromStorage(STORAGE_KEYS.CURRENT_USER);
}

/**
 * Verificar se é admin
 */
function isAdmin() {
    const user = getCurrentUser();
    return user && user.tipo === 'admin';
}

/**
 * Proteger página (redirecionar se não estiver logado)
 */
function protectPage() {
    if (!isLoggedIn()) {
        window.location.href = '/index.html';
    }
}

/**
 * Proteger página apenas para admin
 */
function protectAdminPage() {
    if (!isLoggedIn()) {
        window.location.href = '/index.html';
    } else if (!isAdmin()) {
        alert('Acesso negado! Apenas administradores.');
        window.location.href = 'dashboard.html';
    }
}