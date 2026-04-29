const API_MEDICAMENTOS = 'http://127.0.0.1:8000/api/medicamentos/';
const API_FORNECEDORES = 'http://127.0.0.1:8000/api/fornecedores/';

let produtos = [];
let fornecedores = [];
let produtoEditando = null;
let produtoExcluindo = null;

let paginaAtual = 1;
const itensPorPagina = 10;

window.produtosFiltrados = [];

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacao();
  inicializarEventListeners();
  preencherUsuario();
  await carregarFornecedores();
  await carregarProdutos();
  renderizarTabela();
  criarIcones();
});

function criarIcones() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function preencherUsuario() {
  const el = document.getElementById('userName');
  if (!el) return;

  const currentUser =
    typeof getCurrentUser === 'function' ? getCurrentUser() : null;

  el.textContent = currentUser?.nome || 'Usuário';
}

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

  document
    .getElementById('btnExportar')
    ?.addEventListener('click', toggleExport);
  document
    .getElementById('btnExportarCSV')
    ?.addEventListener('click', exportarCSV);
  document
    .getElementById('btnExportarExcel')
    ?.addEventListener('click', exportarExcel);

  document.addEventListener('click', fecharExportAoClicarFora);

  document.querySelectorAll('.kpi-card-mini[data-filter]').forEach((card) => {
    card.addEventListener('click', () => {
      const filterEstoque = document.getElementById('filterEstoque');
      const tableContainer = document.getElementById('tableContainer');

      tableContainer?.classList.add('filtering');
      setTimeout(() => tableContainer?.classList.remove('filtering'), 250);

      document
        .querySelectorAll('.kpi-card-mini')
        .forEach((c) => c.classList.remove('active'));

      card.classList.add('pulse');
      setTimeout(() => card.classList.remove('pulse'), 400);

      const val = card.dataset.filter || '';
      if (filterEstoque) {
        filterEstoque.value = val;
        filterEstoque.dispatchEvent(new Event('change'));
      }

      if (val) {
        card.classList.add('active');
      }
    });
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (typeof logout === 'function') {
      logout();
      return;
    }

    localStorage.removeItem('farm_current_user');
    localStorage.removeItem('farm_session_token');
    window.location.href = 'index.html';
  });
}

function toggleExport(event) {
  event.stopPropagation();
  document.getElementById('dropdownExportar')?.classList.toggle('active');
}

function fecharExportAoClicarFora(event) {
  const dropdown = document.getElementById('dropdownExportar');
  const btn = document.getElementById('btnExportar');

  if (!dropdown || !btn) return;

  if (!dropdown.contains(event.target) && !btn.contains(event.target)) {
    dropdown.classList.remove('active');
  }
}

async function carregarFornecedores() {
  try {
    const resp = await fetch(API_FORNECEDORES);
    if (!resp.ok) throw new Error('Erro ao carregar fornecedores.');

    const data = await resp.json();
    fornecedores = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Erro ao carregar fornecedores:', error);
    fornecedores = [];
  }
}

async function carregarProdutos() {
  try {
    const resp = await fetch(API_MEDICAMENTOS);
    if (!resp.ok) throw new Error('Erro ao carregar medicamentos.');

    const data = await resp.json();
    produtos = Array.isArray(data) ? data.map(normalizarProdutoDaAPI) : [];
  } catch (error) {
    console.error('Erro ao carregar medicamentos:', error);
    produtos = [];
    alert('Não foi possível carregar os medicamentos da API.');
  }
}

function normalizarProdutoDaAPI(item) {
  return {
    id: item.id,
    nome: item.nome || '',
    miligrama: item.miligrama || '',
    categoria: item.categoria || '',
    lote: item.lote || '',
    vencimento: item.validade || '',
    stock_atual: Number(item.quantidade ?? 0),
    stock_minimo: Number(item.estoque_min ?? 0),
    preco: Number(item.valor_unit ?? 0),
    fornecedor: item.fornecedor ?? '',
    fornecedor_nome: item.fornecedor_nome || '',
    unidade: item.unidade || 'un',
    descricao: item.descricao || '',
    ativo: true,
  };
}

function montarPayloadParaAPI() {
  const nome = getValorCampo('nome');
  const categoria = getValorCampo('categoria');
  const lote = getValorCampo('lote');
  const validade = getValorCampo('validade');
  const quantidade = parseInt(getValorCampo('quantidade'), 10);
  const quantidadeMinima = parseInt(getValorCampo('quantidadeMinima'), 10);
  const valorUnitario = parseFloat(getValorCampo('valorUnitario'));

  let fornecedorId = getValorCampo('fornecedor');
  if (!fornecedorId) fornecedorId = 1;

  return {
    nome,
    miligrama: getValorCampo('miligrama') || null,
    categoria,
    lote,
    validade,
    quantidade: isNaN(quantidade) ? 0 : quantidade,
    estoque_min: isNaN(quantidadeMinima) ? 0 : quantidadeMinima,
    valor_unit: isNaN(valorUnitario) ? 0 : valorUnitario,
    fornecedor: Number(fornecedorId),
    unidade: getValorCampo('unidade') || 'un',
    descricao: getValorCampo('descricao') || '',
  };
}

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
        <td colspan="9" style="text-align:center;padding:40px;color:#64748b">
          <i data-lucide="inbox" style="width:40px;height:40px;margin-bottom:8px"></i>
          <p>Nenhum medicamento encontrado</p>
        </td>
      </tr>
    `;
    renderizarPaginacao(1);
    criarIcones();
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
            ? `<br><small style="color:#64748b">${escapeHTML(produto.miligrama)}</small>`
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
            ? `<br><small style="color:#d97706">${dias} dias</small>`
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
  criarIcones();
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
  criarIcones();
}

function mudarPagina(pagina) {
  paginaAtual = pagina;
  renderizarTabela();
}

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

  preencherSelectFornecedores();

  document.getElementById('modalProduto')?.classList.add('active');
  criarIcones();
}

function preencherSelectFornecedores() {
  const select = document.getElementById('fornecedor');
  if (!select) return;

  select.innerHTML = `
    <option value="">Selecione...</option>
    ${fornecedores
      .map(
        (f) =>
          `<option value="${f.id}">${escapeHTML(f.nome || 'Fornecedor')}</option>`
      )
      .join('')}
  `;
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

  preencherSelectFornecedores();

  setValorCampo('produtoId', produto.id);
  setValorCampo('nome', produto.nome);
  setValorCampo('miligrama', produto.miligrama);
  setValorCampo('categoria', produto.categoria);
  setValorCampo('lote', produto.lote);
  setValorCampo('validade', produto.vencimento);
  setValorCampo('quantidade', Number(produto.stock_atual ?? 0));
  setValorCampo('quantidadeMinima', Number(produto.stock_minimo ?? 0));
  setValorCampo('valorUnitario', Number(produto.preco ?? 0));
  setValorCampo('fornecedor', produto.fornecedor || '');
  setValorCampo('unidade', produto.unidade || 'un');
  setValorCampo('descricao', produto.descricao || '');

  document.getElementById('modalProduto')?.classList.add('active');
  criarIcones();
}

function fecharModal() {
  document.getElementById('modalProduto')?.classList.remove('active');
  produtoEditando = null;
}

async function salvarProduto(event) {
  event.preventDefault();

  const id = getValorCampo('produtoId');
  const payload = montarPayloadParaAPI();

  if (!payload.nome) {
    alert('Informe o nome do medicamento.');
    return;
  }

  if (!payload.categoria) {
    alert('Selecione a categoria.');
    return;
  }

  if (!payload.lote) {
    alert('Informe o lote.');
    return;
  }

  if (!payload.validade) {
    alert('Informe a validade.');
    return;
  }

  if (!payload.fornecedor) {
    alert('Selecione o fornecedor.');
    return;
  }

  try {
    let resp;

    if (id) {
      resp = await fetch(`${API_MEDICAMENTOS}${id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } else {
      resp = await fetch(API_MEDICAMENTOS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }

    if (!resp.ok) {
      const erro = await safeJson(resp);
      console.error(erro);
      alert('Erro ao salvar medicamento.');
      return;
    }

    await carregarProdutos();
    renderizarTabela();
    fecharModal();

    alert(
      id
        ? 'Medicamento atualizado com sucesso.'
        : 'Medicamento cadastrado com sucesso.'
    );
  } catch (error) {
    console.error('Erro ao salvar medicamento:', error);
    alert('Erro de conexão com a API.');
  }
}

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
  criarIcones();
}

async function confirmarExclusaoDefinitiva() {
  if (!produtoExcluindo) return;

  const id = Number(produtoExcluindo.id);

  try {
    const resp = await fetch(`${API_MEDICAMENTOS}${id}/`, {
      method: 'DELETE',
    });

    if (!resp.ok) {
      const erro = await safeJson(resp);
      console.error(erro);
      alert('Não foi possível excluir o medicamento.');
      return;
    }

    await carregarProdutos();

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
    alert('Erro de conexão com a API.');
  }
}

function fecharModalExcluir() {
  document.getElementById('modalExcluir')?.classList.remove('active');
  produtoExcluindo = null;
}

function exportarCSV() {
  const lista = window.produtosFiltrados?.length
    ? window.produtosFiltrados
    : produtos;

  if (!lista.length) {
    alert('Não há dados para exportar.');
    return;
  }

  const header = [
    'Código',
    'Nome',
    'Categoria',
    'Estoque',
    'Estoque Mín.',
    'Valor Unit. (R$)',
    'Validade',
  ];

  const rows = lista.map((p) => [
    String(p.id || '').padStart(4, '0'),
    p.nome || '',
    p.categoria || '',
    Number(p.stock_atual ?? p.quantidade ?? 0),
    Number(p.stock_minimo ?? p.quantidadeMinima ?? 0),
    Number(p.preco ?? p.valorUnitario ?? 0).toFixed(2),
    p.vencimento ?? p.validade ?? '',
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const a = document.createElement('a');
  a.href = URL.createObjectURL(
    new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  );
  a.download = `medicamentos_${new Date()
    .toLocaleDateString('pt-BR')
    .replace(/\//g, '-')}.csv`;

  a.click();
  document.getElementById('dropdownExportar')?.classList.remove('active');
}

function exportarExcel() {
  const lista = window.produtosFiltrados?.length
    ? window.produtosFiltrados
    : produtos;

  if (!lista.length) {
    alert('Não há dados para exportar.');
    return;
  }

  if (typeof XLSX === 'undefined') {
    alert('Biblioteca de exportação não carregada.');
    return;
  }

  const dados = lista.map((p) => ({
    Código: String(p.id || '').padStart(4, '0'),
    Nome: p.nome || '',
    Categoria: p.categoria || '',
    Estoque: Number(p.stock_atual ?? 0),
    'Estoque Mín.': Number(p.stock_minimo ?? 0),
    'Valor Unit.': Number(p.preco ?? 0),
    Validade: p.vencimento ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(dados);
  ws['!cols'] = [8, 30, 20, 10, 12, 12, 12].map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Medicamentos');

  XLSX.writeFile(
    wb,
    `medicamentos_${new Date()
      .toLocaleDateString('pt-BR')
      .replace(/\//g, '-')}.xlsx`
  );

  document.getElementById('dropdownExportar')?.classList.remove('active');
}

async function safeJson(resp) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

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
  }
}
