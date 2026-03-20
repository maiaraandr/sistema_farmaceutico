const STORAGE_KEYS = {
  USERS: 'farm_users',
  PRODUTOS: 'farm_produtos',
  FORNECEDORES: 'farm_fornecedores',
  MOVIMENTACOES: 'farm_movimentacoes',
  CURRENT_USER: 'farm_current_user',
  SESSION_TOKEN: 'farm_session_token',
};

const DISABLE_SAMPLE_DATA = true;

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
    ];
    if (!keepUsers) keysToRemove.push(STORAGE_KEYS.USERS);

    keysToRemove.forEach((k) => localStorage.removeItem(k));
    return true;
  } catch (error) {
    console.error('Erro ao limpar localStorage:', error);
    return false;
  }
}

function normalizeProduto(p) {
  if (!p || typeof p !== 'object') return null;

  const stock_atual = Number(
    p.stock_atual ?? p.estoqueAtual ?? p.stockAtual ?? p.estoque_atual ?? 0
  );

  const stock_minimo = Number(
    p.stock_minimo ?? p.estoqueMinimo ?? p.stockMinimo ?? p.estoque_minimo ?? 0
  );

  const fornecedor_id =
    p.fornecedor_id ?? p.fornecedorId ?? p.fornecedorID ?? null;

  return {
    ...p,
    stock_atual: isNaN(stock_atual) ? 0 : stock_atual,
    stock_minimo: isNaN(stock_minimo) ? 0 : stock_minimo,
    fornecedor_id,
    ativo: p.ativo !== false,
  };
}

function normalizeProdutosArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeProduto).filter(Boolean);
}

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

function getProdutos() {
  return normalizeProdutosArray(loadFromStorage(STORAGE_KEYS.PRODUTOS, []));
}

function saveProdutos(produtos) {
  return saveToStorage(STORAGE_KEYS.PRODUTOS, normalizeProdutosArray(produtos));
}

function addProduto(produto) {
  const produtos = getProdutos();
  produtos.push(
    normalizeProduto({
      id: makeId(),
      ...produto,
      ativo: true,
      criadoEm: new Date().toISOString(),
    })
  );
  return saveProdutos(produtos);
}

function updateProduto(id, dadosAtualizados) {
  const produtos = getProdutos();
  const index = produtos.findIndex((p) => Number(p.id) === Number(id));
  if (index === -1) return false;

  produtos[index] = normalizeProduto({
    ...produtos[index],
    ...dadosAtualizados,
    atualizadoEm: new Date().toISOString(),
  });

  return saveProdutos(produtos);
}

function deleteProduto(id) {
  return updateProduto(id, { ativo: false });
}

function getProdutoById(id) {
  return getProdutos().find((p) => Number(p.id) === Number(id));
}

function getMedicamentos() {
  return getProdutos();
}
function saveMedicamentos(m) {
  return saveProdutos(m);
}
function addMedicamento(m) {
  return addProduto(m);
}
function updateMedicamento(id, d) {
  return updateProduto(id, d);
}
function deleteMedicamento(id) {
  return deleteProduto(id);
}
function getMedicamentoById(id) {
  return getProdutoById(id);
}

function getFornecedores() {
  return loadFromStorage(STORAGE_KEYS.FORNECEDORES, []).filter(Boolean);
}

function saveFornecedores(fornecedores) {
  return saveToStorage(
    STORAGE_KEYS.FORNECEDORES,
    Array.isArray(fornecedores) ? fornecedores : []
  );
}

function addFornecedor(fornecedor) {
  const fornecedores = getFornecedores();
  fornecedores.push({
    id: makeId(),
    ...fornecedor,
    ativo: fornecedor.ativo !== false,
    criadoEm: new Date().toISOString(),
  });
  return saveFornecedores(fornecedores);
}

function updateFornecedor(id, dadosAtualizados) {
  const fornecedores = getFornecedores();
  const index = fornecedores.findIndex((f) => Number(f.id) === Number(id));
  if (index === -1) return false;

  fornecedores[index] = {
    ...fornecedores[index],
    ...dadosAtualizados,
    atualizadoEm: new Date().toISOString(),
  };
  return saveFornecedores(fornecedores);
}

function deleteFornecedor(id) {
  return updateFornecedor(id, { ativo: false });
}

function getMovimentacoes() {
  return loadFromStorage(STORAGE_KEYS.MOVIMENTACOES, []).filter(Boolean);
}

function saveMovimentacoes(movimentacoes) {
  return saveToStorage(
    STORAGE_KEYS.MOVIMENTACOES,
    Array.isArray(movimentacoes) ? movimentacoes : []
  );
}

function addMovimentacao(movimentacao) {
  const movimentacoes = getMovimentacoes();
  movimentacoes.push({
    id: makeId(),
    ...movimentacao,
    data: new Date().toISOString(),
  });
  return saveMovimentacoes(movimentacoes);
}

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
        categoria: 'Analgésicos',
        preco: 5.5,
        stock_atual: 15,
        stock_minimo: 50,
        vencimento: '2025-12-30',
        fornecedor_id: 1,
        ativo: true,
      },
    ]);
  }

  function getSaidas() {
    return JSON.parse(localStorage.getItem('saidas')) || [];
  }

  function addSaida(saida) {
    const lista = getSaidas();
    lista.push(saida);
    localStorage.setItem('saidas', JSON.stringify(lista));
  }

  console.log(' Storage inicializado com dados de exemplo.');
}

if (typeof window !== 'undefined') {
  initializeSampleData();
}

// ===============================
// ENTRADAS / SAÍDAS (MOVIMENTAÇÕES)
// ===============================
function getEntradas() {
  return getMovimentacoes().filter((m) => m.tipo === 'entrada');
}

function addEntrada(entrada) {
  return addMovimentacao({
    ...entrada,
    tipo: 'entrada',
  });
}

function getSaidas() {
  return getMovimentacoes().filter((m) => m.tipo === 'saida');
}

function addSaida(saida) {
  return addMovimentacao({
    ...saida,
    tipo: 'saida',
  });
}
