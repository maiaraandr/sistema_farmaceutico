/**
 * ========================================
 * STORAGE - LocalStorage Manager
 * ========================================
 * Gerencia todos os dados no localStorage
 */

// ========================================
// CHAVES DO LOCALSTORAGE
// ========================================
const STORAGE_KEYS = {
    USERS: 'farm_users',
    PRODUTOS: 'farm_produtos',
    FORNECEDORES: 'farm_fornecedores',
    MOVIMENTACOES: 'farm_movimentacoes',
    CURRENT_USER: 'farm_current_user',
    SESSION_TOKEN: 'farm_session_token'
};

// ========================================
// FUNÇÕES GENÉRICAS
// ========================================

/**
 * Salvar dados no localStorage
 */
function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Erro ao salvar no localStorage:', error);
        return false;
    }
}

/**
 * Carregar dados do localStorage
 */
function loadFromStorage(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
        console.error('Erro ao carregar do localStorage:', error);
        return defaultValue;
    }
}

/**
 * Remover dados do localStorage
 */
function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('Erro ao remover do localStorage:', error);
        return false;
    }
}

/**
 * Limpar todo o localStorage
 */
function clearStorage() {
    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            if (key !== STORAGE_KEYS.CURRENT_USER && key !== STORAGE_KEYS.SESSION_TOKEN) {
                localStorage.removeItem(key);
            }
        });
        return true;
    } catch (error) {
        console.error('Erro ao limpar localStorage:', error);
        return false;
    }
}

// ========================================
// USUÁRIOS
// ========================================

/**
 * Obter todos os usuários
 */
function getUsers() {
    return loadFromStorage(STORAGE_KEYS.USERS, []);
}

/**
 * Salvar usuários
 */
function saveUsers(users) {
    return saveToStorage(STORAGE_KEYS.USERS, users);
}

/**
 * Adicionar usuário
 */
function addUser(user) {
    const users = getUsers();
    users.push({
        id: Date.now(),
        ...user,
        criadoEm: new Date().toISOString()
    });
    return saveUsers(users);
}

// ========================================
// PRODUTOS
// ========================================

/**
 * Obter todos os produtos
 */
function getProdutos() {
    return loadFromStorage(STORAGE_KEYS.PRODUTOS, []);
}

/**
 * Salvar produtos
 */
function saveProdutos(produtos) {
    return saveToStorage(STORAGE_KEYS.PRODUTOS, produtos);
}

/**
 * Adicionar produto
 */
function addProduto(produto) {
    const produtos = getProdutos();
    produtos.push({
        id: Date.now(),
        ...produto,
        ativo: true,
        criadoEm: new Date().toISOString()
    });
    return saveProdutos(produtos);
}

/**
 * Atualizar produto
 */
function updateProduto(id, dadosAtualizados) {
    const produtos = getProdutos();
    const index = produtos.findIndex(p => p.id === id);
    
    if (index !== -1) {
        produtos[index] = {
            ...produtos[index],
            ...dadosAtualizados,
            atualizadoEm: new Date().toISOString()
        };
        return saveProdutos(produtos);
    }
    return false;
}

/**
 * Deletar produto (soft delete)
 */
function deleteProduto(id) {
    return updateProduto(id, { ativo: false });
}

/**
 * Buscar produto por ID
 */
function getProdutoById(id) {
    const produtos = getProdutos();
    return produtos.find(p => p.id === id);
}

// ========================================
// FORNECEDORES
// ========================================

/**
 * Obter todos os fornecedores
 */
function getFornecedores() {
    return loadFromStorage(STORAGE_KEYS.FORNECEDORES, []);
}

/**
 * Salvar fornecedores
 */
function saveFornecedores(fornecedores) {
    return saveToStorage(STORAGE_KEYS.FORNECEDORES, fornecedores);
}

/**
 * Adicionar fornecedor
 */
function addFornecedor(fornecedor) {
    const fornecedores = getFornecedores();
    fornecedores.push({
        id: Date.now(),
        ...fornecedor,
        ativo: true,
        criadoEm: new Date().toISOString()
    });
    return saveFornecedores(fornecedores);
}

/**
 * Atualizar fornecedor
 */
function updateFornecedor(id, dadosAtualizados) {
    const fornecedores = getFornecedores();
    const index = fornecedores.findIndex(f => f.id === id);
    
    if (index !== -1) {
        fornecedores[index] = {
            ...fornecedores[index],
            ...dadosAtualizados
        };
        return saveFornecedores(fornecedores);
    }
    return false;
}

/**
 * Deletar fornecedor
 */
function deleteFornecedor(id) {
    return updateFornecedor(id, { ativo: false });
}

// ========================================
// MOVIMENTAÇÕES
// ========================================

/**
 * Obter todas as movimentações
 */
function getMovimentacoes() {
    return loadFromStorage(STORAGE_KEYS.MOVIMENTACOES, []);
}

/**
 * Salvar movimentações
 */
function saveMovimentacoes(movimentacoes) {
    return saveToStorage(STORAGE_KEYS.MOVIMENTACOES, movimentacoes);
}

/**
 * Adicionar movimentação
 */
function addMovimentacao(movimentacao) {
    const movimentacoes = getMovimentacoes();
    movimentacoes.push({
        id: Date.now(),
        ...movimentacao,
        data: new Date().toISOString()
    });
    return saveMovimentacoes(movimentacoes);
}

// ========================================
// INICIALIZAÇÃO COM DADOS DE EXEMPLO
// ========================================

/**
 * Inicializar sistema com dados de exemplo
 */
function initializeSampleData() {
    // Verificar se já tem dados
    if (getProdutos().length > 0) {
        return; // Já inicializado
    }

    // Usuários de exemplo
    const users = [
        {
            id: 1,
            usuario: 'admin',
            senha: 'admin123', // Em produção, usar hash
            nome: 'Administrador Principal',
            tipo: 'admin'
        },
        {
            id: 2,
            usuario: 'caixa1',
            senha: 'caixa123',
            nome: 'João Silva',
            tipo: 'caixa'
        }
    ];
    saveUsers(users);

    // Fornecedores de exemplo
    const fornecedores = [
        {
            id: 1,
            nome: 'Distribuidora Médica Central',
            contato: 'João Pereira',
            telefone: '(11) 98765-4321',
            email: 'contato@dmcentral.com.br',
            endereco: 'Av. Principal, 123 - São Paulo, SP',
            ativo: true
        },
        {
            id: 2,
            nome: 'Farmacêutica Global S.A.',
            contato: 'Maria González',
            telefone: '(21) 97654-3210',
            email: 'vendas@farmaglobal.com.br',
            endereco: 'Rua do Comércio, 456 - Rio de Janeiro, RJ',
            ativo: true
        },
        {
            id: 3,
            nome: 'Medicamentos do Sul',
            contato: 'Carlos Ramírez',
            telefone: '(51) 96543-2109',
            email: 'pedidos@medsul.com.br',
            endereco: 'Av. Industrial, 789 - Porto Alegre, RS',
            ativo: true
        }
    ];
    saveFornecedores(fornecedores);

    // Produtos de exemplo
    const produtos = [
        {
            id: 1,
            sku: 'PAR-500',
            nome: 'Paracetamol 500mg',
            categoria: 'Analgésicos',
            preco: 5.50,
            stock_atual: 15,
            stock_minimo: 50,
            vencimento: '2025-12-30',
            fornecedor_id: 1,
            ativo: true
        },
        {
            id: 2,
            sku: 'IBU-400',
            nome: 'Ibuprofeno 400mg',
            categoria: 'Antiinflamatórios',
            preco: 8.00,
            stock_atual: 120,
            stock_minimo: 80,
            vencimento: '2026-03-14',
            fornecedor_id: 1,
            ativo: true
        },
        {
            id: 3,
            sku: 'AMO-500',
            nome: 'Amoxicilina 500mg',
            categoria: 'Antibióticos',
            preco: 12.50,
            stock_atual: 30,
            stock_minimo: 40,
            vencimento: '2025-11-29',
            fornecedor_id: 2,
            ativo: true
        },
        {
            id: 4,
            sku: 'OME-20',
            nome: 'Omeprazol 20mg',
            categoria: 'Antiácidos',
            preco: 10.00,
            stock_atual: 8,
            stock_minimo: 30,
            vencimento: '2025-11-30',
            fornecedor_id: 2,
            ativo: true
        },
        {
            id: 5,
            sku: 'LOR-10',
            nome: 'Loratadina 10mg',
            categoria: 'Anti-histamínicos',
            preco: 6.50,
            stock_atual: 95,
            stock_minimo: 50,
            vencimento: '2026-06-19',
            fornecedor_id: 3,
            ativo: true
        }
    ];
    saveProdutos(produtos);

    console.log('✅ Dados de exemplo inicializados!');
}

// Inicializar ao carregar
if (typeof window !== 'undefined') {
    initializeSampleData();
}