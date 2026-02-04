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
  USERS: "farm_users",
  PRODUTOS: "farm_produtos",
  FORNECEDORES: "farm_fornecedores",
  MOVIMENTACOES: "farm_movimentacoes",
  CURRENT_USER: "farm_current_user",
  SESSION_TOKEN: "farm_session_token",
};

// ========================================
// FUNÇÕES GENÉRICAS
// ========================================

function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Erro ao salvar no localStorage:", error);
    return false;
  }
}

function loadFromStorage(key, defaultValue = null) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error("Erro ao carregar do localStorage:", error);
    return defaultValue;
  }
}

function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error("Erro ao remover do localStorage:", error);
    return false;
  }
}

function clearStorage() {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      if (key !== STORAGE_KEYS.CURRENT_USER && key !== STORAGE_KEYS.SESSION_TOKEN) {
        localStorage.removeItem(key);
      }
    });
    return true;
  } catch (error) {
    console.error("Erro ao limpar localStorage:", error);
    return false;
  }
}

// ========================================
// NORMALIZAÇÃO (COMPATIBILIDADE DE CAMPOS)
// ========================================

function normalizeProduto(p) {
  if (!p || typeof p !== "object") return p;

  // Normaliza variações de nomes (mantém os originais e cria equivalentes)
  const estoqueAtual =
    p.estoqueAtual ?? p.stock_atual ?? p.stockAtual ?? p.estoque_atual ?? 0;

  const estoqueMinimo =
    p.estoqueMinimo ?? p.stock_minimo ?? p.stockMinimo ?? p.estoque_minimo ?? 0;

  const fornecedorId =
    p.fornecedorId ?? p.fornecedor_id ?? p.fornecedorID ?? null;

  return {
    ...p,
    // aliases padronizados
    estoqueAtual,
    estoqueMinimo,
    fornecedorId,
    // também mantém os nomes "stock_*" atualizados para não quebrar scripts antigos
    stock_atual: p.stock_atual ?? estoqueAtual,
    stock_minimo: p.stock_minimo ?? estoqueMinimo,
    fornecedor_id: p.fornecedor_id ?? fornecedorId,
  };
}

function normalizeProdutosArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeProduto);
}

// ========================================
// USUÁRIOS
// ========================================

function getUsers() {
  return loadFromStorage(STORAGE_KEYS.USERS, []);
}

function saveUsers(users) {
  return saveToStorage(STORAGE_KEYS.USERS, users);
}

function addUser(user) {
  const users = getUsers();
  users.push({
    id: Date.now(),
    ...user,
    criadoEm: new Date().toISOString(),
  });
  return saveUsers(users);
}

// ========================================
// PRODUTOS (MEDICAMENTOS)
// ========================================

function getProdutos() {
  const produtos = loadFromStorage(STORAGE_KEYS.PRODUTOS, []);
  return normalizeProdutosArray(produtos);
}

function saveProdutos(produtos) {
  return saveToStorage(STORAGE_KEYS.PRODUTOS, normalizeProdutosArray(produtos));
}

function addProduto(produto) {
  const produtos = getProdutos();
  produtos.push(
    normalizeProduto({
      id: Date.now(),
      ...produto,
      ativo: true,
      criadoEm: new Date().toISOString(),
    })
  );
  return saveProdutos(produtos);
}

function updateProduto(id, dadosAtualizados) {
  const produtos = getProdutos();
  const index = produtos.findIndex((p) => p.id === id);

  if (index !== -1) {
    produtos[index] = normalizeProduto({
      ...produtos[index],
      ...dadosAtualizados,
      atualizadoEm: new Date().toISOString(),
    });
    return saveProdutos(produtos);
  }
  return false;
}

function deleteProduto(id) {
  return updateProduto(id, { ativo: false });
}

function getProdutoById(id) {
  const produtos = getProdutos();
  return produtos.find((p) => p.id === id);
}

/**
 * Aliases para evitar quebra se seu JS usa "medicamentos"
 */
function getMedicamentos() {
  return getProdutos();
}
function saveMedicamentos(medicamentos) {
  return saveProdutos(medicamentos);
}
function addMedicamento(medicamento) {
  return addProduto(medicamento);
}
function updateMedicamento(id, dados) {
  return updateProduto(id, dados);
}
function deleteMedicamento(id) {
  return deleteProduto(id);
}
function getMedicamentoById(id) {
  return getProdutoById(id);
}

// ========================================
// FORNECEDORES
// ========================================

function getFornecedores() {
  return loadFromStorage(STORAGE_KEYS.FORNECEDORES, []);
}

function saveFornecedores(fornecedores) {
  return saveToStorage(STORAGE_KEYS.FORNECEDORES, fornecedores);
}

function addFornecedor(fornecedor) {
  const fornecedores = getFornecedores();
  fornecedores.push({
    id: Date.now(),
    ...fornecedor,
    ativo: true,
    criadoEm: new Date().toISOString(),
  });
  return saveFornecedores(fornecedores);
}

function updateFornecedor(id, dadosAtualizados) {
  const fornecedores = getFornecedores();
  const index = fornecedores.findIndex((f) => f.id === id);

  if (index !== -1) {
    fornecedores[index] = {
      ...fornecedores[index],
      ...dadosAtualizados,
      atualizadoEm: new Date().toISOString(),
    };
    return saveFornecedores(fornecedores);
  }
  return false;
}

function deleteFornecedor(id) {
  return updateFornecedor(id, { ativo: false });
}

// ========================================
// MOVIMENTAÇÕES
// ========================================

function getMovimentacoes() {
  return loadFromStorage(STORAGE_KEYS.MOVIMENTACOES, []);
}

function saveMovimentacoes(movimentacoes) {
  return saveToStorage(STORAGE_KEYS.MOVIMENTACOES, movimentacoes);
}

function addMovimentacao(movimentacao) {
  const movimentacoes = getMovimentacoes();
  movimentacoes.push({
    id: Date.now(),
    ...movimentacao,
    data: new Date().toISOString(),
  });
  return saveMovimentacoes(movimentacoes);
}

// ========================================
// INICIALIZAÇÃO COM DADOS DE EXEMPLO (SEM SOBRESCREVER)
// ========================================

function initializeSampleData() {
  // Inicializa CADA conjunto só se estiver vazio
  const users = getUsers();
  if (users.length === 0) {
    saveUsers([
      {
        id: 1,
        usuario: "admin",
        senha: "admin123",
        nome: "Administrador Principal",
        tipo: "admin",
      },
      {
        id: 2,
        usuario: "caixa1",
        senha: "caixa123",
        nome: "João Silva",
        tipo: "caixa",
      },
    ]);
  }

  const fornecedores = getFornecedores();
  if (fornecedores.length === 0) {
    saveFornecedores([
      {
        id: 1,
        nome: "Distribuidora Médica Central",
        contato: "João Pereira",
        telefone: "(11) 98765-4321",
        email: "contato@dmcentral.com.br",
        endereco: "Av. Principal, 123 - São Paulo, SP",
        ativo: true,
      },
      {
        id: 2,
        nome: "Farmacêutica Global S.A.",
        contato: "Maria González",
        telefone: "(21) 97654-3210",
        email: "vendas@farmaglobal.com.br",
        endereco: "Rua do Comércio, 456 - Rio de Janeiro, RJ",
        ativo: true,
      },
      {
        id: 3,
        nome: "Medicamentos do Sul",
        contato: "Carlos Ramírez",
        telefone: "(51) 96543-2109",
        email: "pedidos@medsul.com.br",
        endereco: "Av. Industrial, 789 - Porto Alegre, RS",
        ativo: true,
      },
    ]);
  }

  const produtos = getProdutos();
  if (produtos.length === 0) {
    saveProdutos([
      {
        id: 1,
        sku: "PAR-500",
        nome: "Paracetamol 500mg",
        categoria: "Analgésicos",
        preco: 5.5,
        stock_atual: 15,
        stock_minimo: 50,
        vencimento: "2025-12-30",
        fornecedor_id: 1,
        ativo: true,
      },
      {
        id: 2,
        sku: "IBU-400",
        nome: "Ibuprofeno 400mg",
        categoria: "Antiinflamatórios",
        preco: 8.0,
        stock_atual: 120,
        stock_minimo: 80,
        vencimento: "2026-03-14",
        fornecedor_id: 1,
        ativo: true,
      },
      {
        id: 3,
        sku: "AMO-500",
        nome: "Amoxicilina 500mg",
        categoria: "Antibióticos",
        preco: 12.5,
        stock_atual: 30,
        stock_minimo: 40,
        vencimento: "2025-11-29",
        fornecedor_id: 2,
        ativo: true,
      },
      {
        id: 4,
        sku: "OME-20",
        nome: "Omeprazol 20mg",
        categoria: "Antiácidos",
        preco: 10.0,
        stock_atual: 8,
        stock_minimo: 30,
        vencimento: "2025-11-30",
        fornecedor_id: 2,
        ativo: true,
      },
      {
        id: 5,
        sku: "LOR-10",
        nome: "Loratadina 10mg",
        categoria: "Anti-histamínicos",
        preco: 6.5,
        stock_atual: 95,
        stock_minimo: 50,
        vencimento: "2026-06-19",
        fornecedor_id: 3,
        ativo: true,
      },
    ]);
  }

  console.log("✅ Storage inicializado (sem sobrescrever dados existentes).");
}

if (typeof window !== "undefined") {
  initializeSampleData();
}
