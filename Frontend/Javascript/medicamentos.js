const API_MEDICAMENTOS =
  'https://sistemafarmaceutico-production.up.railway.app/api/medicamentos/';

let produtos = [];

let paginaAtual = 1;
const itensPorPagina = 10;

window.produtosFiltrados = [];

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacao();
  inicializarEventListeners();
  preencherUsuario();
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
    .getElementById('searchInput')
    ?.addEventListener('input', aplicarFiltros);

  document
    .getElementById('filterCategoria')
    ?.addEventListener('change', aplicarFiltros);

  document
    .getElementById('filterEstoque')
    ?.addEventListener('change', aplicarFiltros);

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

async function carregarProdutos() {
  try {
    const resp = await fetch(API_MEDICAMENTOS);

    if (!resp.ok) {
      throw new Error('Erro ao carregar medicamentos.');
    }

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
    preco: Number(item.valor_unit ?? 0),
    unidade: item.unidade || 'un',
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
    const codigo = String(p.id || '').toLowerCase();

    const matchSearch =
      !search ||
      nome.includes(search) ||
      categoria.includes(search) ||
      codigo.includes(search);

    const matchCategoria = !filterCategoria || p.categoria === filterCategoria;

    let matchEstoque = true;

    if (filterEstoque === 'sem-estoque') {
      matchEstoque = Number(p.stock_atual ?? 0) === 0;
    } else if (filterEstoque === 'ok') {
      matchEstoque = Number(p.stock_atual ?? 0) > 0;
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

  const semEstoque = lista.filter((m) => {
    return Number(m.stock_atual ?? 0) === 0;
  }).length;

  const vencendo = lista.filter((m) => {
    const dias = calcularDiasParaVencer(m.vencimento);
    return dias > 0 && dias <= 30;
  }).length;

  const valor = lista.reduce((acc, m) => {
    return acc + Number(m.stock_atual ?? 0) * Number(m.preco ?? 0);
  }, 0);

  atualizarTexto('kpiTotal', total);
  atualizarTexto('kpiSemEstoque', semEstoque);
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

  if (paginaAtual > totalPaginas) {
    paginaAtual = totalPaginas;
  }

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const pagina = filtrados.slice(inicio, inicio + itensPorPagina);

  tbody.innerHTML = '';

  if (pagina.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:40px;color:#64748b">
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

      <td>
        ${Number(produto.stock_atual ?? 0)}
        ${escapeHTML(produto.unidade || 'un')}
      </td>

      <td>
        ${formatarMoeda(produto.preco)}
      </td>

      <td>
        ${formatarData(produto.vencimento)}
        ${
          dias <= 90 && dias > 0
            ? `<br><small style="color:#d97706">${dias} dias</small>`
            : ''
        }
      </td>

      <td>${renderizarBadgeStatus(status)}</td>

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

  if (dias < 0) return { type: 'vencido', text: 'Vencido' };
  if (dias <= 30) return { type: 'critico', text: 'Vence em breve' };
  if (dias <= 90) return { type: 'alerta', text: 'Próximo vencimento' };
  if (atual === 0) return { type: 'baixo', text: 'Sem estoque' };

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
    'Dosagem',
    'Categoria',
    'Quantidade',
    'Valor Unit. (R$)',
    'Validade',
    'Estoque',
  ];

  const rows = lista.map((p) => {
    const status = getStatusProduto(p);

    return [
      String(p.id || '').padStart(4, '0'),
      p.nome || '',
      p.miligrama || '',
      p.categoria || '',
      `${Number(p.stock_atual ?? 0)} ${p.unidade || 'un'}`,
      Number(p.preco ?? 0).toFixed(2),
      p.vencimento || '',
      status.text,
    ];
  });

  const csv = [header, ...rows]
    .map((linha) =>
      linha.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');

  const arquivo = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8;',
  });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(arquivo);
  link.download = `medicamentos_${new Date()
    .toLocaleDateString('pt-BR')
    .replace(/\//g, '-')}.csv`;

  link.click();

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

  const dados = lista.map((p) => {
    const status = getStatusProduto(p);

    return {
      Código: String(p.id || '').padStart(4, '0'),
      Nome: p.nome || '',
      Dosagem: p.miligrama || '',
      Categoria: p.categoria || '',
      Quantidade: `${Number(p.stock_atual ?? 0)} ${p.unidade || 'un'}`,
      'Valor Unit.': Number(p.preco ?? 0),
      Validade: p.vencimento || '',
      Estoque: status.text,
    };
  });

  const ws = XLSX.utils.json_to_sheet(dados);

  ws['!cols'] = [
    { wch: 10 },
    { wch: 30 },
    { wch: 14 },
    { wch: 22 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 20 },
  ];

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

async function safeJson(resp) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
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

function formatarMoeda(valor) {
  return Number(valor ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
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
    window.location.href = '..index.html';
  }
}
