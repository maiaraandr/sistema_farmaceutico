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
  if (typeof lucide !== 'undefined') lucide.createIcons();
});

// ===============================
// CARREGAMENTO (Storage.js)
// ===============================
function carregarProdutos() {
  try {
    produtos = (typeof getProdutos === 'function' ? getProdutos() : []).filter(
      (p) => p.ativo !== false
    );
  } catch (e) {
    console.warn('Erro ao carregar produtos:', e);
    produtos = [];
  }
  if (!Array.isArray(produtos)) produtos = [];
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
    ?.addEventListener('click', () => {
      if (!produtoExcluindo) return;
      if (typeof updateProduto === 'function') {
        updateProduto(produtoExcluindo.id, { ativo: false });
      }
      carregarProdutos();
      const total = obterProdutosFiltrados().length;
      if ((paginaAtual - 1) * itensPorPagina >= total && paginaAtual > 1)
        paginaAtual--;
      renderizarTabela();
      fecharModalExcluir();
      alert('Medicamento excluído com sucesso!');
    });
}

// ==========================================
// FILTROS
// ==========================================
function obterProdutosFiltrados() {
  const search = (document.getElementById('searchInput')?.value || '')
    .toLowerCase()
    .trim();
  const filterCategoria =
    document.getElementById('filterCategoria')?.value || '';
  const filterEstoque = document.getElementById('filterEstoque')?.value || '';

  return produtos.filter((p) => {
    const matchSearch =
      (p.nome || '').toLowerCase().includes(search) ||
      (p.categoria || '').toLowerCase().includes(search);
    const matchCategoria = !filterCategoria || p.categoria === filterCategoria;

    let matchEstoque = true;
    const atual = Number(p.stock_atual ?? 0);
    const minimo = Number(p.stock_minimo ?? 0);
    if (filterEstoque === 'baixo') matchEstoque = atual < minimo;
    else if (filterEstoque === 'ok') matchEstoque = atual >= minimo;
    else if (filterEstoque === 'vencendo') {
      const d = calcularDiasParaVencer(p.vencimento);
      matchEstoque = d <= 90 && d > 0;
    }

    return matchSearch && matchCategoria && matchEstoque;
  });
}

// ==========================================
// KPIs
// ==========================================
function atualizarKPIs(lista) {
  const total = lista.length;
  const baixo = lista.filter(
    (m) => Number(m.stock_atual ?? 0) < Number(m.stock_minimo ?? 0)
  ).length;
  const vencendo = lista.filter((m) => {
    const d = calcularDiasParaVencer(m.vencimento);
    return d > 0 && d <= 30;
  }).length;
  const valor = lista.reduce(
    (acc, m) => acc + Number(m.stock_atual ?? 0) * Number(m.preco ?? 0),
    0
  );

  const s = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  s('kpiTotal', total);
  s('kpiBaixo', baixo);
  s('kpiVencendo', vencendo);
  s(
    'kpiValor',
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  );
}

// ==========================================
// RENDER TABELA
// ==========================================
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
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--gray-500)">
      <i data-lucide="inbox" style="width:40px;height:40px;margin-bottom:8px"></i>
      <p>Nenhum medicamento encontrado</p></td></tr>`;
    renderizarPaginacao(1);
    if (typeof lucide !== 'undefined') lucide.createIcons();
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
        ${produto.miligrama ? `<br><small style="color:var(--gray-500)">${escapeHTML(produto.miligrama)}</small>` : ''}
      </td>
      <td><span class="badge badge-info">${escapeHTML(produto.categoria || '-')}</span></td>
      <td>${Number(produto.stock_atual ?? 0)} ${escapeHTML(produto.unidade || 'un')}</td>
      <td>${Number(produto.stock_minimo ?? 0)} ${escapeHTML(produto.unidade || 'un')}</td>
      <td>R$ ${Number(produto.preco ?? 0).toFixed(2)}</td>
      <td>${formatarData(produto.vencimento)}${dias <= 90 && dias > 0 ? `<br><small style="color:#f59e0b">${dias} dias</small>` : ''}</td>
      <td>${renderizarBadgeStatus(status)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon btn-icon-primary" onclick="editarProduto(${produto.id})" title="Editar"><i data-lucide="edit"></i></button>
          <button class="btn-icon btn-icon-danger" onclick="confirmarExclusao(${produto.id})" title="Excluir"><i data-lucide="trash-2"></i></button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });

  renderizarPaginacao(totalPaginas);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function getStatusProduto(produto) {
  const dias = calcularDiasParaVencer(produto.vencimento);
  const atual = Number(produto.stock_atual ?? 0);
  const min = Number(produto.stock_minimo ?? 0);
  if (dias < 0) return { type: 'vencido', text: 'Vencido' };
  if (dias <= 30) return { type: 'critico', text: 'Vence em breve' };
  if (dias <= 90) return { type: 'alerta', text: 'Próximo vencimento' };
  if (atual < min) return { type: 'baixo', text: 'Estoque baixo' };
  return { type: 'ok', text: 'Normal' };
}

function renderizarBadgeStatus(status) {
  const cls = {
    vencido: 'badge-danger',
    critico: 'badge-danger',
    alerta: 'badge-warning',
    baixo: 'badge-warning',
    ok: 'badge-success',
  };
  return `<span class="badge ${cls[status.type] || 'badge-secondary'}">${status.text}</span>`;
}

function calcularDiasParaVencer(vencimento) {
  if (!vencimento) return 999999;
  return Math.ceil((new Date(vencimento) - new Date()) / (1000 * 60 * 60 * 24));
}

function formatarData(data) {
  if (!data) return '-';
  const d = new Date(data);
  if (isNaN(d.getTime())) return String(data);
  return d.toLocaleDateString('pt-BR');
}

function renderizarPaginacao(totalPaginas) {
  const paginacao = document.getElementById('pagination');
  if (!paginacao) return;
  if (totalPaginas <= 1) {
    paginacao.innerHTML = '';
    return;
  }

  let html = `<button class="pagination-btn" ${paginaAtual === 1 ? 'disabled' : ''} onclick="mudarPagina(${paginaAtual - 1})"><i data-lucide="chevron-left"></i></button>`;
  for (let i = 1; i <= totalPaginas; i++) {
    html += `<button class="pagination-btn ${i === paginaAtual ? 'active' : ''}" onclick="mudarPagina(${i})">${i}</button>`;
  }
  html += `<button class="pagination-btn" ${paginaAtual === totalPaginas ? 'disabled' : ''} onclick="mudarPagina(${paginaAtual + 1})"><i data-lucide="chevron-right"></i></button>`;
  paginacao.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function mudarPagina(p) {
  paginaAtual = p;
  renderizarTabela();
}
function aplicarFiltros() {
  paginaAtual = 1;
  renderizarTabela();
}

// ==========================================
// MODAL NOVO / EDITAR
// ==========================================
function abrirModalNovo() {
  produtoEditando = null;
  document.getElementById('modalTitle').innerHTML =
    '<i data-lucide="package-plus"></i> Novo Medicamento';
  document.getElementById('formProduto')?.reset();
  document.getElementById('produtoId').value = '';
  document.getElementById('modalProduto')?.classList.add('active');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function editarProduto(id) {
  const produto = produtos.find((p) => p.id === id);
  if (!produto) return;
  produtoEditando = produto;

  document.getElementById('modalTitle').innerHTML =
    '<i data-lucide="edit"></i> Editar Medicamento';
  document.getElementById('produtoId').value = produto.id;

  const set = (elId, val) => {
    const el = document.getElementById(elId);
    if (el) el.value = val ?? '';
  };
  set('nome', produto.nome);
  set('categoria', produto.categoria);
  set('lote', produto.lote);
  set('validade', produto.vencimento);
  set('quantidade', Number(produto.stock_atual ?? 0));
  set('quantidadeMinima', Number(produto.stock_minimo ?? 0));
  set('valorUnitario', Number(produto.preco ?? 0));
  set('unidade', produto.unidade || 'un');
  set('descricao', produto.descricao);

  document.getElementById('modalProduto')?.classList.add('active');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function fecharModal() {
  document.getElementById('modalProduto')?.classList.remove('active');
  produtoEditando = null;
}

function salvarProduto(e) {
  e.preventDefault();
  const id = document.getElementById('produtoId')?.value;
  const get = (elId) => {
    const el = document.getElementById(elId);
    return el ? el.value.trim() : '';
  };

  const payload = {
    nome: get('nome'),
    categoria: get('categoria'),
    lote: get('lote'),
    vencimento: get('validade'),
    stock_atual: parseInt(get('quantidade'), 10),
    stock_minimo: parseInt(get('quantidadeMinima'), 10),
    preco: parseFloat(get('valorUnitario')),
    unidade: get('unidade') || 'un',
    descricao: get('descricao'),
    ativo: true,
  };

  if (!payload.nome) return alert('Informe o nome.');
  if (!payload.categoria) return alert('Selecione a categoria.');
  if (!payload.vencimento) return alert('Informe a validade.');
  if (isNaN(payload.stock_atual)) return alert('Quantidade inválida.');
  if (isNaN(payload.stock_minimo)) return alert('Quantidade mínima inválida.');
  if (isNaN(payload.preco)) return alert('Valor unitário inválido.');

  if (id) {
    typeof updateProduto === 'function' && updateProduto(Number(id), payload);
    alert('Medicamento atualizado com sucesso!');
  } else {
    typeof addProduto === 'function' && addProduto(payload);
    alert('Medicamento cadastrado com sucesso!');
  }

  carregarProdutos();
  renderizarTabela();
  fecharModal();
}

// ==========================================
// MODAL EXCLUIR
// ==========================================
function confirmarExclusao(id) {
  const produto = produtos.find((p) => p.id === id);
  if (!produto) return;
  produtoExcluindo = produto;
  document.getElementById('nomeProdutoExcluir').textContent =
    produto.nome || 'Medicamento';
  document.getElementById('modalExcluir')?.classList.add('active');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function fecharModalExcluir() {
  document.getElementById('modalExcluir')?.classList.remove('active');
  produtoExcluindo = null;
}

// ==========================================
// HELPERS
// ==========================================
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
  if (el) el.textContent = currentUser.nome || 'Usuário';
}
