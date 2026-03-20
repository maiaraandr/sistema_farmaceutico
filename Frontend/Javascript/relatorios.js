// relatorios.js — Consolidado via API /movimentacoes/ + gráfico Top 10 dinâmico
// Filtros: tipo (E/S), busca e período (data início/fim)
// (fallback: Storage.js)

let movimentacoes = [];
let paginaAtual = 1;
const itensPorPagina = 10;

let chartTop = null;

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacao();

  await carregarTudo();
  inicializarListeners();

  // filtro inicial (tipo selecionado)
  aplicarFiltros();

  if (typeof lucide !== 'undefined') lucide.createIcons();
});

function inicializarListeners() {
  document
    .getElementById('searchRelatorio')
    ?.addEventListener('input', aplicarFiltros);

  document
    .getElementById('filterTipo')
    ?.addEventListener('change', aplicarFiltros);

  document
    .getElementById('filterDataInicio')
    ?.addEventListener('change', aplicarFiltros);

  document
    .getElementById('filterDataFim')
    ?.addEventListener('change', aplicarFiltros);

  document.getElementById('btnLimparPeriodo')?.addEventListener('click', () => {
    const ini = document.getElementById('filterDataInicio');
    const fim = document.getElementById('filterDataFim');
    if (ini) ini.value = '';
    if (fim) fim.value = '';
    aplicarFiltros();
  });
}

// =============================
// CARREGAMENTO
// =============================
async function carregarTudo() {
  await carregarMovimentacoes();
}

async function carregarMovimentacoes() {
  let data = [];

  try {
    if (typeof apiGetMovimentacoes === 'function') {
      data = await apiGetMovimentacoes(); // API Django
    } else if (typeof getMovimentacoes === 'function') {
      data = getMovimentacoes(); // fallback local
    }
  } catch (e) {
    console.error('Erro ao buscar movimentações:', e);
  }

  if (!Array.isArray(data)) data = [];
  movimentacoes = data.map(normalizarMov);

  // mais recente primeiro
  movimentacoes.sort((a, b) => {
    const da = new Date(a.data_movimentacao || 0).getTime();
    const db = new Date(b.data_movimentacao || 0).getTime();
    return db - da;
  });
}

// =============================
// NORMALIZAÇÃO
// =============================
function normalizarMov(m) {
  // Formato API:
  if (m && (m.tipo === 'E' || m.tipo === 'S')) {
    return {
      id: m.id ?? null,
      tipo: m.tipo,
      quantidade: Number(m.quantidade || 0),
      medicamento_nome: m.medicamento_nome || m.medicamento_name || '',
      observacao: m.observacao || '',
      data_movimentacao: m.data_movimentacao || null,
      parceiro: '',
    };
  }

  // Formato antigo (Storage.js): tipo "entrada"/"saida"
  const tipo = m?.tipo === 'entrada' ? 'E' : m?.tipo === 'saida' ? 'S' : '';
  const parceiro = m?.tipo === 'entrada' ? m.fornecedor || '' : m.destino || '';

  return {
    id: m?.id ?? null,
    tipo,
    quantidade: Number(m?.quantidade || 0),
    medicamento_nome: m?.medicamento || m?.medicamento_nome || '',
    observacao: String(m?.observacao || parceiro || ''),
    data_movimentacao: m?.data_movimentacao || m?.data || null,
    parceiro,
  };
}

// =============================
// FILTROS
// =============================
function obterTipoSelecionadoAPI() {
  // Seu HTML agora manda: "E" ou "S"
  const v = String(
    document.getElementById('filterTipo')?.value || ''
  ).toUpperCase();
  return v === 'E' || v === 'S' ? v : 'E';
}

function parseDateInputStart(valueYYYYMMDD) {
  // início do dia local
  if (!valueYYYYMMDD) return null;
  const [y, m, d] = valueYYYYMMDD.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function parseDateInputEnd(valueYYYYMMDD) {
  // fim do dia local
  if (!valueYYYYMMDD) return null;
  const [y, m, d] = valueYYYYMMDD.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

function obterPeriodoSelecionado() {
  const iniVal = document.getElementById('filterDataInicio')?.value || '';
  const fimVal = document.getElementById('filterDataFim')?.value || '';

  const ini = parseDateInputStart(iniVal);
  const fim = parseDateInputEnd(fimVal);

  // se usuário colocou invertido, ajusta
  if (ini && fim && ini > fim) return { ini: fim, fim: ini };
  return { ini, fim };
}

function obterMovimentacoesFiltradas() {
  const search = (document.getElementById('searchRelatorio')?.value || '')
    .toLowerCase()
    .trim();

  const tipo = obterTipoSelecionadoAPI(); // 'E' ou 'S'
  const { ini, fim } = obterPeriodoSelecionado();

  return movimentacoes.filter((m) => {
    // filtro tipo (obrigatório)
    if (m.tipo !== tipo) return false;

    // filtro período
    if (ini || fim) {
      const dt = new Date(m.data_movimentacao || 0);
      if (isNaN(dt.getTime())) return false;
      if (ini && dt < ini) return false;
      if (fim && dt > fim) return false;
    }

    // filtro busca
    if (!search) return true;
    const nome = String(m.medicamento_nome || '').toLowerCase();
    const obs = String(m.observacao || '').toLowerCase();
    return nome.includes(search) || obs.includes(search);
  });
}

function aplicarFiltros() {
  paginaAtual = 1;

  const tipo = obterTipoSelecionadoAPI();
  atualizarTituloTop10(tipo);

  renderizarRelatorio();

  const filtradas = obterMovimentacoesFiltradas();
  const top10 = montarTop10(filtradas);
  renderizarGraficoTop(top10, tipo);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// =============================
// KPIs (seguem filtros)
// =============================
function atualizarKPIs(listaFiltrada, tipoSelecionado) {
  const totalTipo = listaFiltrada.reduce(
    (acc, m) => acc + Number(m.quantidade || 0),
    0
  );

  if (tipoSelecionado === 'E') {
    setTextSeExistir('totalEntradas', totalTipo);
    setTextSeExistir('totalSaidas', 0);
    setTextSeExistir('saldo', totalTipo);
  } else {
    setTextSeExistir('totalEntradas', 0);
    setTextSeExistir('totalSaidas', totalTipo);
    setTextSeExistir('saldo', 0 - totalTipo);
  }
}

function setTextSeExistir(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

// =============================
// TABELA
// =============================
function renderizarRelatorio() {
  const tbody = document.getElementById('tabelaRelatorios');
  if (!tbody) return;

  const tipoSelecionado = obterTipoSelecionadoAPI();
  const filtradas = obterMovimentacoesFiltradas();

  setTextSeExistir('totalLinhas', filtradas.length);
  atualizarKPIs(filtradas, tipoSelecionado);

  const totalPaginas = Math.ceil(filtradas.length / itensPorPagina) || 1;
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const pagina = filtradas.slice(inicio, inicio + itensPorPagina);

  tbody.innerHTML = '';

  if (pagina.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding:16px;color:var(--gray-600);text-align:center;">
          Nenhuma movimentação encontrada.
        </td>
      </tr>
    `;
    renderizarPaginacao(1);
    return;
  }

  pagina.forEach((m) => {
    const tr = document.createElement('tr');

    const tipoCol =
      m.tipo === 'E'
        ? `<span class="badge-pill badge-in"><i data-lucide="arrow-down-circle" style="width:14px;height:14px"></i> Entrada</span>`
        : `<span class="badge-pill badge-out"><i data-lucide="arrow-up-circle" style="width:14px;height:14px"></i> Saída</span>`;

    const parceiro = m.observacao || m.parceiro || '—';

    tr.innerHTML = `
      <td>${tipoCol}</td>
      <td>${escapeHTML(m.medicamento_nome || '—')}</td>
      <td>${Number(m.quantidade || 0)}</td>
      <td>${escapeHTML(parceiro)}</td>
      <td>${formatarDataHora(m.data_movimentacao)}</td>
    `;

    tbody.appendChild(tr);
  });

  renderizarPaginacao(totalPaginas);
}

// =============================
// PAGINAÇÃO
// =============================
function renderizarPaginacao(totalPaginas) {
  const el = document.getElementById('paginationRelatorios');
  if (!el) return;

  if (totalPaginas <= 1) {
    el.innerHTML = '';
    return;
  }

  let html = `<button class="pagination-btn" ${
    paginaAtual === 1 ? 'disabled' : ''
  } onclick="mudarPagina(${paginaAtual - 1})">‹</button>`;

  for (let i = 1; i <= totalPaginas; i++) {
    html += `<button class="pagination-btn ${
      i === paginaAtual ? 'active' : ''
    } onclick="mudarPagina(${i})">${i}</button>`;
  }

  html += `<button class="pagination-btn" ${
    paginaAtual === totalPaginas ? 'disabled' : ''
  } onclick="mudarPagina(${paginaAtual + 1})">›</button>`;

  el.innerHTML = html;
}

window.mudarPagina = function (p) {
  paginaAtual = p;
  renderizarRelatorio();

  const tipo = obterTipoSelecionadoAPI();
  const filtradas = obterMovimentacoesFiltradas();
  const top10 = montarTop10(filtradas);
  renderizarGraficoTop(top10, tipo);

  if (typeof lucide !== 'undefined') lucide.createIcons();
};

// =============================
// TOP 10
// =============================
function montarTop10(listaFiltrada) {
  const mapa = new Map();

  for (const m of listaFiltrada) {
    const nome = (m.medicamento_nome || '').trim();
    if (!nome) continue;
    mapa.set(nome, (mapa.get(nome) || 0) + Number(m.quantidade || 0));
  }

  return Array.from(mapa.entries())
    .map(([medicamento, total], idx) => ({
      medicamento_id: idx + 1,
      medicamento,
      total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

function atualizarTituloTop10(tipo) {
  const alvo = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5')).find(
    (x) => (x.textContent || '').trim().startsWith('Top 10 Medicamentos')
  );

  if (!alvo) return;

  if (tipo === 'E') alvo.textContent = 'Top 10 Medicamentos (Entradas)';
  else alvo.textContent = 'Top 10 Medicamentos (Saídas)';
}

// =============================
// GRÁFICO (Chart.js)
// =============================
function renderizarGraficoTop(lista, tipo) {
  const canvas = document.getElementById('chartTopSaidas');
  if (!canvas) return;
  if (typeof Chart === 'undefined') return;

  const labels = (lista || []).map(
    (x) => x.medicamento || `ID ${x.medicamento_id}`
  );
  const valores = (lista || []).map((x) => Number(x.total || 0));

  if (chartTop) chartTop.destroy();

  chartTop = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: tipo === 'E' ? 'Total de entradas' : 'Total de saídas',
          data: valores,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

// =============================
// AUTH + HELPERS
// =============================
function verificarAutenticacao() {
  let currentUser = null;

  try {
    if (typeof getCurrentUser === 'function') currentUser = getCurrentUser();
  } catch (e) {}

  if (!currentUser) {
    const keys = [
      'currentUser',
      'current_user',
      'usuarioLogado',
      'loggedUser',
      'user',
    ];
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') {
          currentUser = obj;
          break;
        }
      } catch (e) {}
    }
  }

  const el = document.getElementById('userName');
  if (el) el.textContent = currentUser?.nome || currentUser?.name || 'Usuário';
}

function formatarDataHora(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);

  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
