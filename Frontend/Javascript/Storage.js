const STORAGE_KEYS = {
  USERS: 'farm_users',
  PRODUTOS: 'farm_produtos',
  FORNECEDORES: 'farm_fornecedores',
  MOVIMENTACOES: 'farm_movimentacoes',
  CURRENT_USER: 'farm_current_user',
  SESSION_TOKEN: 'farm_session_token',
};

const DISABLE_SAMPLE_DATA = true;

// ===============================
// HELPERS GERAIS
// ===============================
function safeJSONParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function makeId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Erro ao salvar no localStorage:', error);
    return false;
  }
}

function loadFromStorage(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? safeJSONParse(raw, defaultValue) : defaultValue;
  } catch (error) {
    console.error('Erro ao carregar do localStorage:', error);
    return defaultValue;
  }
}

function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Erro ao remover do localStorage:', error);
    return false;
  }
}

function clearStorage({ keepUsers = true } = {}) {
  try {
    const keysToRemove = [
      STORAGE_KEYS.PRODUTOS,
      STORAGE_KEYS.FORNECEDORES,
      STORAGE_KEYS.MOVIMENTACOES,
      STORAGE_KEYS.CURRENT_USER,
      STORAGE_KEYS.SESSION_TOKEN,
    ];

    if (!keepUsers) {
      keysToRemove.push(STORAGE_KEYS.USERS);
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    return true;
  } catch (error) {
    console.error('Erro ao limpar localStorage:', error);
    return false;
  }
}

// ===============================
// NORMALIZAÇÃO DE PRODUTOS
// ===============================
function normalizeProduto(produto) {
  if (!produto || typeof produto !== 'object') return null;

  const stock_atual = Number(
    produto.stock_atual ??
      produto.estoqueAtual ??
      produto.stockAtual ??
      produto.estoque_atual ??
      0
  );

  const stock_minimo = Number(
    produto.stock_minimo ??
      produto.estoqueMinimo ??
      produto.stockMinimo ??
      produto.estoque_minimo ??
      0
  );

  const preco = Number(produto.preco ?? produto.valorUnitario ?? 0);

  const fornecedor_id =
    produto.fornecedor_id ??
    produto.fornecedorId ??
    produto.fornecedorID ??
    null;

  return {
    ...produto,
    id: Number(produto.id) || makeId(),
    nome: produto.nome || '',
    categoria: produto.categoria || '',
    lote: produto.lote || '',
    vencimento: produto.vencimento || '',
    stock_atual: isNaN(stock_atual) ? 0 : stock_atual,
    stock_minimo: isNaN(stock_minimo) ? 0 : stock_minimo,
    preco: isNaN(preco) ? 0 : preco,
    unidade: produto.unidade || 'un',
    descricao: produto.descricao || '',
    fornecedor_id,
    ativo: produto.ativo !== false,
  };
}

function normalizeProdutosArray(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.map(normalizeProduto).filter(Boolean);
}

// ===============================
// USERS
// ===============================
function getUsers() {
  return loadFromStorage(STORAGE_KEYS.USERS, []);
}

function saveUsers(users) {
  return saveToStorage(STORAGE_KEYS.USERS, Array.isArray(users) ? users : []);
}

function addUser(user) {
  const users = getUsers();

  users.push({
    id: makeId(),
    ...user,
    criadoEm: new Date().toISOString(),
  });

  return saveUsers(users);
}

function getUserById(id) {
  return getUsers().find((user) => Number(user.id) === Number(id)) || null;
}

function updateUser(id, dadosAtualizados) {
  const users = getUsers();
  const index = users.findIndex((user) => Number(user.id) === Number(id));

  if (index === -1) return false;

  users[index] = {
    ...users[index],
    ...dadosAtualizados,
    atualizadoEm: new Date().toISOString(),
  };

  return saveUsers(users);
}

function deleteUser(id) {
  const users = getUsers().filter((user) => Number(user.id) !== Number(id));
  return saveUsers(users);
}

// ===============================
// SESSÃO / USUÁRIO LOGADO
// ===============================
function getCurrentUser() {
  return loadFromStorage(STORAGE_KEYS.CURRENT_USER, null);
}

function saveCurrentUser(user) {
  return saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
}

function clearCurrentUser() {
  return removeFromStorage(STORAGE_KEYS.CURRENT_USER);
}

function getSessionToken() {
  return loadFromStorage(STORAGE_KEYS.SESSION_TOKEN, null);
}

function saveSessionToken(token) {
  return saveToStorage(STORAGE_KEYS.SESSION_TOKEN, token);
}

function clearSessionToken() {
  return removeFromStorage(STORAGE_KEYS.SESSION_TOKEN);
}

function logoutUser() {
  clearCurrentUser();
  clearSessionToken();
  return true;
}

// ===============================
// PRODUTOS / MEDICAMENTOS
// ===============================
function getProdutos() {
  return normalizeProdutosArray(loadFromStorage(STORAGE_KEYS.PRODUTOS, []));
}

function saveProdutos(produtos) {
  return saveToStorage(STORAGE_KEYS.PRODUTOS, normalizeProdutosArray(produtos));
}

function addProduto(produto) {
  const produtos = getProdutos();

  const novoProduto = normalizeProduto({
    id: makeId(),
    ...produto,
    ativo: true,
    criadoEm: new Date().toISOString(),
  });

  produtos.push(novoProduto);
  return saveProdutos(produtos);
}

function updateProduto(id, dadosAtualizados) {
  const produtos = getProdutos();
  const index = produtos.findIndex(
    (produto) => Number(produto.id) === Number(id)
  );

  if (index === -1) return false;

  produtos[index] = normalizeProduto({
    ...produtos[index],
    ...dadosAtualizados,
    id: produtos[index].id,
    atualizadoEm: new Date().toISOString(),
  });

  return saveProdutos(produtos);
}

// EXCLUSÃO REAL
function deleteProduto(id) {
  const produtos = getProdutos();

  const novaLista = produtos.filter(
    (produto) => Number(produto.id) !== Number(id)
  );

  return saveProdutos(novaLista);
}

function getProdutoById(id) {
  return (
    getProdutos().find((produto) => Number(produto.id) === Number(id)) || null
  );
}

// Alias para medicamentos
function getMedicamentos() {
  return getProdutos();
}

function saveMedicamentos(medicamentos) {
  return saveProdutos(medicamentos);
}

function addMedicamento(medicamento) {
  return addProduto(medicamento);
}

function updateMedicamento(id, dadosAtualizados) {
  return updateProduto(id, dadosAtualizados);
}

function deleteMedicamento(id) {
  return deleteProduto(id);
}

function getMedicamentoById(id) {
  return getProdutoById(id);
}

// ===============================
// FORNECEDORES
// ===============================
function normalizeFornecedor(fornecedor) {
  if (!fornecedor || typeof fornecedor !== 'object') return null;

  return {
    ...fornecedor,
    id: Number(fornecedor.id) || makeId(),
    nome: fornecedor.nome || '',
    ativo: fornecedor.ativo !== false,
  };
}

function normalizeFornecedoresArray(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.map(normalizeFornecedor).filter(Boolean);
}

function getFornecedores() {
  return normalizeFornecedoresArray(
    loadFromStorage(STORAGE_KEYS.FORNECEDORES, [])
  );
}

function saveFornecedores(fornecedores) {
  return saveToStorage(
    STORAGE_KEYS.FORNECEDORES,
    normalizeFornecedoresArray(fornecedores)
  );
}

function addFornecedor(fornecedor) {
  const fornecedores = getFornecedores();

  fornecedores.push(
    normalizeFornecedor({
      id: makeId(),
      ...fornecedor,
      ativo: fornecedor.ativo !== false,
      criadoEm: new Date().toISOString(),
    })
  );

  return saveFornecedores(fornecedores);
}

function updateFornecedor(id, dadosAtualizados) {
  const fornecedores = getFornecedores();
  const index = fornecedores.findIndex(
    (fornecedor) => Number(fornecedor.id) === Number(id)
  );

  if (index === -1) return false;

  fornecedores[index] = normalizeFornecedor({
    ...fornecedores[index],
    ...dadosAtualizados,
    id: fornecedores[index].id,
    atualizadoEm: new Date().toISOString(),
  });

  return saveFornecedores(fornecedores);
}

function deleteFornecedor(id) {
  const fornecedores = getFornecedores().filter(
    (fornecedor) => Number(fornecedor.id) !== Number(id)
  );

  return saveFornecedores(fornecedores);
}

function getFornecedorById(id) {
  return (
    getFornecedores().find(
      (fornecedor) => Number(fornecedor.id) === Number(id)
    ) || null
  );
}

// ===============================
// MOVIMENTAÇÕES
// ===============================
function normalizeMovimentacao(movimentacao) {
  if (!movimentacao || typeof movimentacao !== 'object') return null;

  return {
    ...movimentacao,
    id: Number(movimentacao.id) || makeId(),
    medicamento_id:
      movimentacao.medicamento_id ??
      movimentacao.medicamentoId ??
      movimentacao.produto_id ??
      movimentacao.produtoId ??
      null,
    quantidade: Number(movimentacao.quantidade) || 0,
    tipo: movimentacao.tipo || '',
    data:
      movimentacao.data ||
      movimentacao.data_movimentacao ||
      new Date().toISOString(),
  };
}

function normalizeMovimentacoesArray(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.map(normalizeMovimentacao).filter(Boolean);
}

function getMovimentacoes() {
  return normalizeMovimentacoesArray(
    loadFromStorage(STORAGE_KEYS.MOVIMENTACOES, [])
  );
}

function saveMovimentacoes(movimentacoes) {
  return saveToStorage(
    STORAGE_KEYS.MOVIMENTACOES,
    normalizeMovimentacoesArray(movimentacoes)
  );
}

function addMovimentacao(movimentacao) {
  const movimentacoes = getMovimentacoes();

  movimentacoes.push(
    normalizeMovimentacao({
      id: makeId(),
      ...movimentacao,
      data: new Date().toISOString(),
    })
  );

  return saveMovimentacoes(movimentacoes);
}

function updateMovimentacao(id, dadosAtualizados) {
  const movimentacoes = getMovimentacoes();
  const index = movimentacoes.findIndex(
    (movimentacao) => Number(movimentacao.id) === Number(id)
  );

  if (index === -1) return false;

  movimentacoes[index] = normalizeMovimentacao({
    ...movimentacoes[index],
    ...dadosAtualizados,
    id: movimentacoes[index].id,
    atualizadoEm: new Date().toISOString(),
  });

  return saveMovimentacoes(movimentacoes);
}

function deleteMovimentacao(id) {
  const movimentacoes = getMovimentacoes().filter(
    (movimentacao) => Number(movimentacao.id) !== Number(id)
  );

  return saveMovimentacoes(movimentacoes);
}

function getMovimentacaoById(id) {
  return (
    getMovimentacoes().find(
      (movimentacao) => Number(movimentacao.id) === Number(id)
    ) || null
  );
}

// ===============================
// ENTRADAS / SAÍDAS
// ===============================
function getEntradas() {
  return getMovimentacoes().filter(
    (movimentacao) =>
      String(movimentacao.tipo).toLowerCase() === 'entrada' ||
      String(movimentacao.tipo).toLowerCase() === 'e'
  );
}

function addEntrada(entrada) {
  return addMovimentacao({
    ...entrada,
    tipo: 'entrada',
  });
}

function getSaidas() {
  return getMovimentacoes().filter(
    (movimentacao) =>
      String(movimentacao.tipo).toLowerCase() === 'saida' ||
      String(movimentacao.tipo).toLowerCase() === 'saída' ||
      String(movimentacao.tipo).toLowerCase() === 's'
  );
}

function addSaida(saida) {
  return addMovimentacao({
    ...saida,
    tipo: 'saida',
  });
}

// ===============================
// DADOS DE EXEMPLO
// ===============================
function initializeSampleData() {
  if (DISABLE_SAMPLE_DATA) return;

  const users = getUsers();
  if (users.length === 0) {
    saveUsers([
      {
        id: 1,
        usuario: 'admin',
        senha: 'admin123',
        nome: 'Administrador',
        tipo: 'admin',
      },
      {
        id: 2,
        usuario: 'caixa1',
        senha: 'caixa123',
        nome: 'Caixa',
        tipo: 'caixa',
      },
    ]);
  }

  const fornecedores = getFornecedores();
  if (fornecedores.length === 0) {
    saveFornecedores([
      { id: 1, nome: 'Distribuidora X', ativo: true },
      { id: 2, nome: 'Fornecedor Y', ativo: true },
    ]);
  }

  const produtos = getProdutos();
  if (produtos.length === 0) {
    saveProdutos([
      {
        id: 1,
        sku: 'PAR-500',
        nome: 'Paracetamol 500mg',
        categoria: 'Analgésico',
        preco: 5.5,
        stock_atual: 15,
        stock_minimo: 50,
        vencimento: '2026-12-30',
        fornecedor_id: 1,
        unidade: 'cx',
        ativo: true,
      },
    ]);
  }

  console.log('Storage inicializado com dados de exemplo.');
}

if (typeof window !== 'undefined') {
  initializeSampleData();
}
