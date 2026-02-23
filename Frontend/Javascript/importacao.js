let produtos = [];
let produtoEditando = null;
let produtoExcluindo = null;

let paginaAtual = 1;
const itensPorPagina = 10;

window.produtosFiltrados = [];

// ==========================================
// INIT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  verificarAutenticacao();
  carregarProdutos();
  renderizarTabela();
  inicializarEventListeners();
  inicializarExportacao();
  if (typeof lucide !== 'undefined') lucide.createIcons();
});

// ==========================================
// STORAGE
// ==========================================
function carregarProdutos() {
  produtos = (typeof getProdutos === 'function' ? getProdutos() : []).filter(
    (p) => p.ativo !== false
  );
  if (!Array.isArray(produtos)) produtos = [];
}

// ==========================================
// EVENT LISTENERS
// ==========================================
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
        updateProduto(produtoExcluindo.id, {
          ativo: false,
          atualizadoEm: new Date().toISOString(),
        });
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
// EXPORTAÇÃO — CSV e Excel via SheetJS
// ==========================================
function inicializarExportacao() {
  const btnExportar = document.getElementById('btnExportar');
  const dropdownExport = document.getElementById('dropdownExport');

  // Toggle dropdown
  btnExportar?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownExport?.classList.toggle('active');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  // Fecha ao clicar fora
  document.addEventListener('click', () =>
    dropdownExport?.classList.remove('active')
  );
  dropdownExport?.addEventListener('click', (e) => e.stopPropagation());

  // CSV
  document.getElementById('btnExportarCSV')?.addEventListener('click', () => {
    const lista = window.produtosFiltrados?.length
      ? window.produtosFiltrados
      : produtos;
    if (!lista.length) return alert('Não há dados para exportar.');

    const header = [
      'Código',
      'Nome',
      'Categoria',
      'Estoque',
      'Estoque Mín.',
      'Valor Unit. (R$)',
      'Validade',
      'Status',
    ];
    const rows = lista.map((p) => [
      String(p.id ?? '').padStart(4, '0'),
      p.nome ?? '',
      p.categoria ?? '',
      Number(p.stock_atual ?? 0),
      Number(p.stock_minimo ?? 0),
      Number(p.preco ?? 0).toFixed(2),
      formatarData(p.vencimento),
      getStatusProduto(p).text,
    ]);

    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(
        new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      ),
      download: `medicamentos_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
    dropdownExport?.classList.remove('active');
  });

  // Excel via SheetJS
  document.getElementById('btnExportarExcel')?.addEventListener('click', () => {
    const lista = window.produtosFiltrados?.length
      ? window.produtosFiltrados
      : produtos;
    if (!lista.length) return alert('Não há dados para exportar.');

    if (typeof XLSX === 'undefined') {
      alert('SheetJS não carregado. Verifique a CDN no HTML.');
      return;
    }

    const dados = lista.map((p) => ({
      Código: String(p.id ?? '').padStart(4, '0'),
      Nome: p.nome ?? '',
      Categoria: p.categoria ?? '',
      Estoque: Number(p.stock_atual ?? 0),
      'Estoque Mín.': Number(p.stock_minimo ?? 0),
      'Valor Unit.': Number(p.preco ?? 0),
      Validade: formatarData(p.vencimento),
      Status: getStatusProduto(p).text,
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    ws['!cols'] = [8, 30, 20, 10, 12, 12, 12, 16].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Medicamentos');
    XLSX.writeFile(
      wb,
      `medicamentos_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    dropdownExport?.classList.remove('active');
  });

  // PDF — aviso
  document.getElementById('btnExportarPDF')?.addEventListener('click', () => {
    alert(
      'Exportação para PDF: use Ctrl+P no navegador e escolha "Salvar como PDF".'
    );
    dropdownExport?.classList.remove('active');
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
    const nome = (p.nome || '').toLowerCase();
    const categoria = (p.categoria || '').toLowerCase();
    const principioAtivo = (p.principioAtivo || '').toLowerCase();
    const sku = (p.sku || '').toLowerCase();

    const matchSearch =
      nome.includes(search) ||
      categoria.includes(search) ||
      principioAtivo.includes(search) ||
      sku.includes(search);
    const matchCategoria = !filterCategoria || p.categoria === filterCategoria;

    let matchEstoque = true;
    const atual = Number(p.stock_atual ?? 0);
    const minimo = Number(p.stock_minimo ?? 0);
    if (filterEstoque === 'baixo') matchEstoque = atual < minimo;
    else if (filterEstoque === 'ok') matchEstoque = atual >= minimo;
    else if (filterEstoque === 'vencendo') {
      const dias = calcularDiasParaVencer(p.vencimento);
      matchEstoque = dias <= 90 && dias > 0;
    }

    return matchSearch && matchCategoria && matchEstoque;
  });
}

// ==========================================
// KPIs
// ==========================================
function atualizarKPIs(lista) {
  const elTotal = document.getElementById('kpiTotal');
  const elBaixo = document.getElementById('kpiBaixo');
  const elVencendo = document.getElementById('kpiVencendo');
  const elValor = document.getElementById('kpiValor');

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

  if (elTotal) elTotal.textContent = total;
  if (elBaixo) elBaixo.textContent = baixo;
  if (elVencendo) elVencendo.textContent = vencendo;
  if (elValor)
    elValor.textContent = valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
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
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;padding:40px;color:var(--gray-500)">
          <i data-lucide="inbox" style="width:40px;height:40px;margin-bottom:8px"></i>
          <p>Nenhum medicamento encontrado</p>
        </td>
      </tr>`;
    renderizarPaginacao(1);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  pagina.forEach((produto) => {
    const tr = document.createElement('tr');
    const status = getStatusProduto(produto);
    const diasParaVencer = calcularDiasParaVencer(produto.vencimento);

    tr.innerHTML = `
      <td><code>${String(produto.id ?? '').padStart(4, '0')}</code></td>
      <td>
        <strong>${escapeHTML(produto.nome)}</strong>
        ${produto.descricao ? `<br><small style="color:var(--gray-500)">${escapeHTML(produto.descricao)}</small>` : ''}
      </td>
      <td><span class="badge badge-info">${escapeHTML(produto.categoria || '-')}</span></td>
      <td>${Number(produto.stock_atual ?? 0)} ${escapeHTML(produto.unidade || 'un')}</td>
      <td>${Number(produto.stock_minimo ?? 0)} ${escapeHTML(produto.unidade || 'un')}</td>
      <td>R$ ${Number(produto.preco ?? 0).toFixed(2)}</td>
      <td>
        ${formatarData(produto.vencimento)}
        ${diasParaVencer <= 90 && diasParaVencer > 0 ? `<br><small style="color:#f59e0b">${diasParaVencer} dias</small>` : ''}
      </td>
      <td>${renderizarBadgeStatus(status)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon btn-icon-primary" onclick="editarProduto(${produto.id})" title="Editar">
            <i data-lucide="edit"></i>
          </button>
          <button class="btn-icon btn-icon-danger" onclick="confirmarExclusao(${produto.id})" title="Excluir">
            <i data-lucide="trash-2"></i>
          </button>
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
  const diff = new Date(vencimento) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatarData(data) {
  if (!data) return '-';
  const d = new Date(data);
  if (isNaN(d.getTime())) return String(data);
  return d.toLocaleDateString('pt-BR');
}

// ==========================================
// PAGINAÇÃO
// ==========================================
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

function mudarPagina(pagina) {
  paginaAtual = pagina;
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

  // Preenche todos os campos disponíveis
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
    unidade: get('unidade'),
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
    if (typeof updateProduto === 'function') {
      updateProduto(Number(id), {
        ...payload,
        atualizadoEm: new Date().toISOString(),
      });
    }
  } else {
    if (typeof addProduto === 'function') {
      addProduto(payload);
    } else {
      const lista = getProdutos();
      lista.push({
        id: Date.now(),
        ...payload,
        criadoEm: new Date().toISOString(),
      });
      localStorage.setItem('farm_produtos', JSON.stringify(lista));
    }
  }

  carregarProdutos();
  renderizarTabela();
  fecharModal();
  alert(
    id
      ? 'Medicamento atualizado com sucesso!'
      : 'Medicamento cadastrado com sucesso!'
  );
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
