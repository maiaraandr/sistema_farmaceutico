let produtos = [];
let produtoEditando = null;
let produtoExcluindo = null;

let paginaAtual = 1;
const itensPorPagina = 10;

window.produtosFiltrados = [];

// ===============================
// INIT
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  verificarAutenticacao();
  inicializarEventListeners();
  carregarProdutos();
  renderizarTabela();

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

// ===============================
// STORAGE HELPERS
// ===============================
function obterProdutosStorage() {
  try {
    if (typeof getProdutos === 'function') {
      const lista = getProdutos();
      return Array.isArray(lista) ? lista : [];
    }

    const raw = localStorage.getItem('produtos');
    if (!raw) return [];

    const lista = JSON.parse(raw);
    return Array.isArray(lista) ? lista : [];
  } catch (error) {
    console.warn('Erro ao obter produtos do storage:', error);
    return [];
  }
}

function salvarProdutosStorage(lista) {
  try {
    localStorage.setItem('produtos', JSON.stringify(lista));
  } catch (error) {
    console.error('Erro ao salvar produtos no storage:', error);
  }
}

function excluirProdutoStorage(id) {
  try {
    const lista = obterProdutosStorage();
    const novaLista = lista.filter((p) => Number(p.id) !== Number(id));
    salvarProdutosStorage(novaLista);
    return true;
  } catch (error) {
    console.error('Erro ao excluir produto do storage:', error);
    return false;
  }
}

function gerarNovoId() {
  const lista = obterProdutosStorage();
  const maxId = lista.reduce((max, item) => {
    const idAtual = Number(item.id) || 0;
    return idAtual > max ? idAtual : max;
  }, 0);

  return maxId + 1;
}

// ===============================
// CARREGAMENTO
// ===============================
function carregarProdutos() {
  try {
    produtos = obterProdutosStorage().filter((p) => p && p.ativo !== false);
  } catch (error) {
    console.warn('Erro ao carregar produtos:', error);
    produtos = [];
  }

  if (!Array.isArray(produtos)) {
    produtos = [];
  }
}

// ===============================
// EVENT LISTENERS
// ===============================
function inicializarEventListeners() {
  document
    .getElementById('btnNovoProduto')
    ?.addEventListener('click', abrirModalNovo);

  document.getElementById('modalClose')?.addEventListener('click', fecharModal);

  document
    .getElementById('modalOverlay')
    ?.addEventListener('click', fecharModal);

  document
    .getElementById('btnCancelar')
    ?.addEventListener('click', fecharModal);

  document
    .getElementById('formProduto')
    ?.addEventListener('submit', salvarProduto);

  document
    .getElementById('searchInput')
    ?.addEventListener('input', aplicarFiltros);

  document
    .getElementById('filterCategoria')
    ?.addEventListener('change', aplicarFiltros);

  document
    .getElementById('filterEstoque')
    ?.addEventListener('change', aplicarFiltros);

  document
    .getElementById('modalExcluirClose')
    ?.addEventListener('click', fecharModalExcluir);

  document
    .getElementById('modalExcluirOverlay')
    ?.addEventListener('click', fecharModalExcluir);

  document
    .getElementById('btnCancelarExcluir')
    ?.addEventListener('click', fecharModalExcluir);

  document
    .getElementById('btnConfirmarExcluir')
    ?.addEventListener('click', confirmarExclusaoDefinitiva);
}

// ===============================
// FILTROS
// ===============================
function obterProdutosFiltrados() {
  const search = (document.getElementById('searchInput')?.value || '')
    .toLowerCase()
    .trim();

  const filterCategoria =
    document.getElementById('filterCategoria')?.value || '';

  const filterEstoque = document.getElementById('filterEstoque')?.value || '';

  return produtos.filter((p) => {
    const nome = String(p.nome || '').toLowerCase();
    const categoria = String(p.categoria || '').toLowerCase();

    const matchSearch =
      nome.includes(search) ||
      categoria.includes(search) ||
      String(p.id || '').includes(search);

    const matchCategoria = !filterCategoria || p.categoria === filterCategoria;

    let matchEstoque = true;

    const atual = Number(p.stock_atual ?? 0);
    const minimo = Number(p.stock_minimo ?? 0);

    if (filterEstoque === 'baixo') {
      matchEstoque = atual < minimo;
    } else if (filterEstoque === 'ok') {
      matchEstoque = atual >= minimo;
    } else if (filterEstoque === 'vencendo') {
      const dias = calcularDiasParaVencer(p.vencimento);
      matchEstoque = dias > 0 && dias <= 90;
    }

    return matchSearch && matchCategoria && matchEstoque;
  });
}

function aplicarFiltros() {
  paginaAtual = 1;
  renderizarTabela();
}

// ===============================
// KPIs
// ===============================
function atualizarKPIs(lista) {
  const total = lista.length;

  const baixo = lista.filter(
    (m) => Number(m.stock_atual ?? 0) < Number(m.stock_minimo ?? 0)
  ).length;

  const vencendo = lista.filter((m) => {
    const dias = calcularDiasParaVencer(m.vencimento);
    return dias > 0 && dias <= 30;
  }).length;

  const valor = lista.reduce((acc, m) => {
    return acc + Number(m.stock_atual ?? 0) * Number(m.preco ?? 0);
  }, 0);

  atualizarTexto('kpiTotal', total);
  atualizarTexto('kpiBaixo', baixo);
  atualizarTexto('kpiVencendo', vencendo);
  atualizarTexto(
    'kpiValor',
    valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  );
}

function atualizarTexto(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}

// ===============================
// TABELA
// ===============================
function renderizarTabela() {
  const tbody = document.getElementById('tabelaProdutos');
  if (!tbody) return;

  const filtrados = obterProdutosFiltrados();
  window.produtosFiltrados = filtrados;

  atualizarKPIs(filtrados);

  const totalPaginas = Math.ceil(filtrados.length / itensPorPagina) || 1;
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const pagina = filtrados.slice(inicio, inicio + itensPorPagina);

  tbody.innerHTML = '';

  if (pagina.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;padding:40px;color:var(--gray-500)">
          <i data-lucide="inbox" style="width:40px;height:40px;margin-bottom:8px"></i>
          <p>Nenhum medicamento encontrado</p>
        </td>
      </tr>
    `;
    renderizarPaginacao(1);

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    return;
  }

  pagina.forEach((produto) => {
    const tr = document.createElement('tr');
    const status = getStatusProduto(produto);
    const dias = calcularDiasParaVencer(produto.vencimento);

    tr.innerHTML = `
      <td><code>${String(produto.id ?? '').padStart(4, '0')}</code></td>
      <td>
        <strong>${escapeHTML(produto.nome)}</strong>
        ${
          produto.miligrama
            ? `<br><small style="color:var(--gray-500)">${escapeHTML(produto.miligrama)}</small>`
            : ''
        }
      </td>
      <td>
        <span class="badge badge-info">${escapeHTML(produto.categoria || '-')}</span>
      </td>
      <td>${Number(produto.stock_atual ?? 0)} ${escapeHTML(produto.unidade || 'un')}</td>
      <td>${Number(produto.stock_minimo ?? 0)} ${escapeHTML(produto.unidade || 'un')}</td>
      <td>R$ ${Number(produto.preco ?? 0).toFixed(2)}</td>
      <td>
        ${formatarData(produto.vencimento)}
        ${
          dias <= 90 && dias > 0
            ? `<br><small style="color:#f59e0b">${dias} dias</small>`
            : ''
        }
      </td>
      <td>${renderizarBadgeStatus(status)}</td>
      <td>
        <div class="action-buttons">
          <button
            class="btn-icon btn-icon-primary"
            onclick="editarProduto(${Number(produto.id)})"
            title="Editar"
            type="button"
          >
            <i data-lucide="edit"></i>
          </button>
          <button
            class="btn-icon btn-icon-danger"
            onclick="confirmarExclusao(${Number(produto.id)})"
            title="Excluir"
            type="button"
          >
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  renderizarPaginacao(totalPaginas);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function renderizarPaginacao(totalPaginas) {
  const paginacao = document.getElementById('pagination');
  if (!paginacao) return;

  if (totalPaginas <= 1) {
    paginacao.innerHTML = '';
    return;
  }

  let html = `
    <button
      class="pagination-btn"
      ${paginaAtual === 1 ? 'disabled' : ''}
      onclick="mudarPagina(${paginaAtual - 1})"
      type="button"
    >
      <i data-lucide="chevron-left"></i>
    </button>
  `;

  for (let i = 1; i <= totalPaginas; i++) {
    html += `
      <button
        class="pagination-btn ${i === paginaAtual ? 'active' : ''}"
        onclick="mudarPagina(${i})"
        type="button"
      >
        ${i}
      </button>
    `;
  }

  html += `
    <button
      class="pagination-btn"
      ${paginaAtual === totalPaginas ? 'disabled' : ''}
      onclick="mudarPagina(${paginaAtual + 1})"
      type="button"
    >
      <i data-lucide="chevron-right"></i>
    </button>
  `;

  paginacao.innerHTML = html;

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function mudarPagina(pagina) {
  paginaAtual = pagina;
  renderizarTabela();
}

// ===============================
// STATUS
// ===============================
function getStatusProduto(produto) {
  const dias = calcularDiasParaVencer(produto.vencimento);
  const atual = Number(produto.stock_atual ?? 0);
  const minimo = Number(produto.stock_minimo ?? 0);

  if (dias < 0) return { type: 'vencido', text: 'Vencido' };
  if (dias <= 30) return { type: 'critico', text: 'Vence em breve' };
  if (dias <= 90) return { type: 'alerta', text: 'Próximo vencimento' };
  if (atual < minimo) return { type: 'baixo', text: 'Estoque baixo' };

  return { type: 'ok', text: 'Normal' };
}

function renderizarBadgeStatus(status) {
  const classes = {
    vencido: 'badge-danger',
    critico: 'badge-danger',
    alerta: 'badge-warning',
    baixo: 'badge-warning',
    ok: 'badge-success',
  };

  return `<span class="badge ${classes[status.type] || 'badge-secondary'}">${status.text}</span>`;
}

// ===============================
// MODAL NOVO / EDITAR
// ===============================
function abrirModalNovo() {
  produtoEditando = null;

  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) {
    modalTitle.innerHTML =
      '<i data-lucide="package-plus"></i> Novo Medicamento';
  }

  document.getElementById('formProduto')?.reset();

  const produtoId = document.getElementById('produtoId');
  if (produtoId) produtoId.value = '';

  document.getElementById('modalProduto')?.classList.add('active');

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function editarProduto(id) {
  const produto = produtos.find((p) => Number(p.id) === Number(id));
  if (!produto) {
    alert('Medicamento não encontrado.');
    return;
  }

  produtoEditando = produto;

  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) {
    modalTitle.innerHTML = '<i data-lucide="edit"></i> Editar Medicamento';
  }

  setValorCampo('produtoId', produto.id);
  setValorCampo('nome', produto.nome);
  setValorCampo('categoria', produto.categoria);
  setValorCampo('lote', produto.lote);
  setValorCampo('validade', produto.vencimento);
  setValorCampo('quantidade', Number(produto.stock_atual ?? 0));
  setValorCampo('quantidadeMinima', Number(produto.stock_minimo ?? 0));
  setValorCampo('valorUnitario', Number(produto.preco ?? 0));
  setValorCampo('unidade', produto.unidade || 'un');
  setValorCampo('descricao', produto.descricao);

  document.getElementById('modalProduto')?.classList.add('active');

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function fecharModal() {
  document.getElementById('modalProduto')?.classList.remove('active');
  produtoEditando = null;
}

function salvarProduto(event) {
  event.preventDefault();

  const id = getValorCampo('produtoId');

  const payload = {
    nome: getValorCampo('nome'),
    categoria: getValorCampo('categoria'),
    lote: getValorCampo('lote'),
    vencimento: getValorCampo('validade'),
    stock_atual: parseInt(getValorCampo('quantidade'), 10),
    stock_minimo: parseInt(getValorCampo('quantidadeMinima'), 10),
    preco: parseFloat(getValorCampo('valorUnitario')),
    unidade: getValorCampo('unidade') || 'un',
    descricao: getValorCampo('descricao'),
    ativo: true,
  };

  if (!payload.nome) {
    alert('Informe o nome do medicamento.');
    return;
  }

  if (!payload.categoria) {
    alert('Selecione a categoria.');
    return;
  }

  if (!payload.vencimento) {
    alert('Informe a validade.');
    return;
  }

  if (isNaN(payload.stock_atual) || payload.stock_atual < 0) {
    alert('Quantidade inválida.');
    return;
  }

  if (isNaN(payload.stock_minimo) || payload.stock_minimo < 0) {
    alert('Quantidade mínima inválida.');
    return;
  }

  if (isNaN(payload.preco) || payload.preco < 0) {
    alert('Valor unitário inválido.');
    return;
  }

  try {
    if (id) {
      atualizarProdutoExistente(Number(id), payload);
      alert('Medicamento atualizado com sucesso.');
    } else {
      criarNovoProduto(payload);
      alert('Medicamento cadastrado com sucesso.');
    }

    carregarProdutos();
    renderizarTabela();
    fecharModal();
  } catch (error) {
    console.error('Erro ao salvar medicamento:', error);
    alert('Erro ao salvar medicamento.');
  }
}

function criarNovoProduto(payload) {
  if (typeof addProduto === 'function') {
    addProduto(payload);
    return;
  }

  const lista = obterProdutosStorage();
  const novoProduto = {
    id: gerarNovoId(),
    ...payload,
  };

  lista.push(novoProduto);
  salvarProdutosStorage(lista);
}

function atualizarProdutoExistente(id, payload) {
  if (typeof updateProduto === 'function') {
    updateProduto(id, payload);
    return;
  }

  const lista = obterProdutosStorage();
  const index = lista.findIndex((p) => Number(p.id) === Number(id));

  if (index === -1) {
    throw new Error('Produto não encontrado para atualização.');
  }

  lista[index] = {
    ...lista[index],
    ...payload,
    id: lista[index].id,
  };

  salvarProdutosStorage(lista);
}

// ===============================
// MODAL EXCLUIR
// ===============================
function confirmarExclusao(id) {
  const produto = produtos.find((p) => Number(p.id) === Number(id));

  if (!produto) {
    alert('Medicamento não encontrado.');
    return;
  }

  produtoExcluindo = produto;

  const nomeEl = document.getElementById('nomeProdutoExcluir');
  if (nomeEl) {
    nomeEl.textContent = produto.nome || 'Medicamento';
  }

  document.getElementById('modalExcluir')?.classList.add('active');

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function confirmarExclusaoDefinitiva() {
  if (!produtoExcluindo) return;

  const id = Number(produtoExcluindo.id);

  try {
    let excluiu = false;

    if (typeof deleteProduto === 'function') {
      deleteProduto(id);
      excluiu = true;
    } else {
      excluiu = excluirProdutoStorage(id);
    }

    if (!excluiu) {
      alert('Não foi possível excluir o medicamento.');
      return;
    }

    carregarProdutos();

    const totalFiltrados = obterProdutosFiltrados().length;
    if (
      (paginaAtual - 1) * itensPorPagina >= totalFiltrados &&
      paginaAtual > 1
    ) {
      paginaAtual--;
    }

    renderizarTabela();
    fecharModalExcluir();

    alert('Medicamento excluído com sucesso.');
  } catch (error) {
    console.error('Erro ao excluir medicamento:', error);
    alert('Erro ao excluir medicamento.');
  }
}

function fecharModalExcluir() {
  document.getElementById('modalExcluir')?.classList.remove('active');
  produtoExcluindo = null;
}

// ===============================
// HELPERS
// ===============================
function getValorCampo(id) {
  const el = document.getElementById(id);
  return el ? String(el.value).trim() : '';
}

function setValorCampo(id, valor) {
  const el = document.getElementById(id);
  if (el) el.value = valor ?? '';
}

function calcularDiasParaVencer(vencimento) {
  if (!vencimento) return 999999;

  const hoje = new Date();
  const dataVencimento = new Date(vencimento);

  hoje.setHours(0, 0, 0, 0);
  dataVencimento.setHours(0, 0, 0, 0);

  const diferenca = dataVencimento - hoje;
  return Math.ceil(diferenca / (1000 * 60 * 60 * 24));
}

function formatarData(data) {
  if (!data) return '-';

  const d = new Date(data);
  if (isNaN(d.getTime())) return String(data);

  return d.toLocaleDateString('pt-BR');
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function verificarAutenticacao() {
  const currentUser =
    typeof getCurrentUser === 'function' ? getCurrentUser() : null;

  if (!currentUser) {
    window.location.href = '../html/index.html';
    return;
  }

  const el = document.getElementById('userName');
  if (el) {
    el.textContent = currentUser.nome || 'Usuário';
  }
}
