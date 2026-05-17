let movimentacoes = [];
let paginaAtual = 1;
const itensPorPagina = 10;

let chartTop = null;
let chartResumo = null;

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacao();
  preencherUsuario();
  inicializarLogout();
  inicializarListeners();
  atualizarDataHoje();

  await carregarTudo();
  aplicarFiltros();

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
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

  document
    .getElementById('btnBaixarPDF')
    ?.addEventListener('click', baixarRelatorioPDF);
}

function inicializarLogout() {
  const logoutBtn = document.getElementById('logoutBtn');

  logoutBtn?.addEventListener('click', () => {
    if (typeof logout === 'function') {
      logout();
      return;
    }

    localStorage.removeItem('farm_current_user');
    localStorage.removeItem('farm_session_token');
    window.location.href = '/html/index.html';
  });
}

function preencherUsuario() {
  let currentUser = null;

  try {
    if (typeof getCurrentUser === 'function') {
      currentUser = getCurrentUser();
    }
  } catch (e) {}

  const el = document.getElementById('userName');
  if (el) {
    el.textContent = currentUser?.nome || currentUser?.name || 'Usuário';
  }
}

function atualizarDataHoje() {
  const el = document.getElementById('dataHoje');
  if (el) {
    el.textContent = new Date().toLocaleDateString('pt-BR');
  }
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
      data = await apiGetMovimentacoes();
    } else if (typeof getMovimentacoes === 'function') {
      data = getMovimentacoes();
    }
  } catch (e) {
    console.error('Erro ao buscar movimentações:', e);
  }

  if (!Array.isArray(data)) data = [];
  movimentacoes = data.map(normalizarMov);

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
function obterTipoSelecionado() {
  const v = String(
    document.getElementById('filterTipo')?.value || 'E'
  ).toUpperCase();
  return v;
}

function parseDateInputStart(valueYYYYMMDD) {
  if (!valueYYYYMMDD) return null;
  const [y, m, d] = valueYYYYMMDD.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function parseDateInputEnd(valueYYYYMMDD) {
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

  if (ini && fim && ini > fim) return { ini: fim, fim: ini };
  return { ini, fim };
}

function obterMovimentacoesFiltradas() {
  const search = (document.getElementById('searchRelatorio')?.value || '')
    .toLowerCase()
    .trim();

  const tipo = obterTipoSelecionado();
  const { ini, fim } = obterPeriodoSelecionado();

  return movimentacoes.filter((m) => {
    if (tipo !== 'T' && m.tipo !== tipo) return false;

    if (ini || fim) {
      const dt = new Date(m.data_movimentacao || 0);
      if (isNaN(dt.getTime())) return false;
      if (ini && dt < ini) return false;
      if (fim && dt > fim) return false;
    }

    if (!search) return true;

    const nome = String(m.medicamento_nome || '').toLowerCase();
    const obs = String(m.observacao || '').toLowerCase();
    return nome.includes(search) || obs.includes(search);
  });
}

function aplicarFiltros() {
  paginaAtual = 1;

  const tipo = obterTipoSelecionado();
  const filtradas = obterMovimentacoesFiltradas();

  atualizarKpisGerais();
  atualizarMiniCards(filtradas, tipo);
  renderizarRelatorio(filtradas);
  renderizarGraficos(filtradas, tipo);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// =============================
// KPIs
// =============================
function atualizarKpisGerais() {
  const entradas = movimentacoes
    .filter((m) => m.tipo === 'E')
    .reduce((acc, m) => acc + Number(m.quantidade || 0), 0);

  const saidas = movimentacoes
    .filter((m) => m.tipo === 'S')
    .reduce((acc, m) => acc + Number(m.quantidade || 0), 0);

  const saldo = entradas - saidas;

  setText('totalEntradas', entradas);
  setText('totalSaidas', saidas);
  setText('saldo', saldo);
}

function atualizarMiniCards(listaFiltrada, tipo) {
  setText('totalLinhas', listaFiltrada.length);
  setText('badgeTotalRegistros', listaFiltrada.length);

  const filtroAtual =
    tipo === 'E' ? 'Entradas' : tipo === 'S' ? 'Saídas' : 'Tudo';
  setText('filtroAtual', filtroAtual);

  const top10 = montarTop10(listaFiltrada);
  setText('topMedicamento', top10[0]?.medicamento || '—');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

// =============================
// EXTRATOR DE CAMPOS DA OBSERVAÇÃO
// =============================
function extrairCampo(texto, chave) {
  const regex = new RegExp(chave + ':\\s*([^|]+)');
  const match = String(texto || '').match(regex);
  return match ? match[1].trim() : '—';
}

// =============================
// TABELA
// =============================
function renderizarRelatorio(listaFiltrada) {
  const tbody = document.getElementById('tabelaRelatorios');
  if (!tbody) return;

  const totalPaginas = Math.ceil(listaFiltrada.length / itensPorPagina) || 1;
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const pagina = listaFiltrada.slice(inicio, inicio + itensPorPagina);

  tbody.innerHTML = '';

  if (pagina.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-row">
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
        ? `<span class="badge-in"><i data-lucide="arrow-down-circle" style="width:14px;height:14px"></i> Entrada</span>`
        : `<span class="badge-out"><i data-lucide="arrow-up-circle" style="width:14px;height:14px"></i> Saída</span>`;

    const obs = m.observacao || '';

    const fornecedor = extrairCampo(obs, 'Fornecedor');
    const categoria = extrairCampo(obs, 'Categoria');
    const lote = extrairCampo(obs, 'Lote');
    const validade = extrairCampo(obs, 'Validade informada');
    const valorUnit = extrairCampo(obs, 'Valor unitario');

    tr.innerHTML = `
      <td>${tipoCol}</td>
      <td>${escapeHTML(m.medicamento_nome || '—')}</td>
      <td>${Number(m.quantidade || 0)}</td>
      <td>${escapeHTML(fornecedor)}</td>
      <td>${escapeHTML(categoria)}</td>
      <td>${escapeHTML(lote)}</td>
      <td>${escapeHTML(validade)}</td>
      <td>${escapeHTML(valorUnit)}</td>
      <td>${formatarDataHora(m.data_movimentacao)}</td>
    `;

    tbody.appendChild(tr);
  });

  renderizarPaginacao(totalPaginas);
}

// =============================
// PAGINAÇÃO — CORRIGIDA
// =============================
function renderizarPaginacao(totalPaginas) {
  const el = document.getElementById('paginationRelatorios');
  if (!el) return;

  if (totalPaginas <= 1) {
    el.innerHTML = '';
    return;
  }

  // CORREÇÃO: aspas do atributo class fechadas corretamente antes do onclick
  let html = `<button class="pagination-btn" ${
    paginaAtual === 1 ? 'disabled' : ''
  } onclick="mudarPagina(${paginaAtual - 1})">‹</button>`;

  for (let i = 1; i <= totalPaginas; i++) {
    html += `<button class="pagination-btn ${
      i === paginaAtual ? 'active' : ''
    }" onclick="mudarPagina(${i})">${i}</button>`;
  }

  html += `<button class="pagination-btn" ${
    paginaAtual === totalPaginas ? 'disabled' : ''
  } onclick="mudarPagina(${paginaAtual + 1})">›</button>`;

  el.innerHTML = html;
}

window.mudarPagina = function (p) {
  paginaAtual = p;
  const filtradas = obterMovimentacoesFiltradas();
  renderizarRelatorio(filtradas);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
};

// =============================
// TOP 10 + GRÁFICOS
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

function renderizarGraficos(listaFiltrada, tipo) {
  renderizarGraficoTop(montarTop10(listaFiltrada), tipo);
  renderizarGraficoResumoTipos();
}

function renderizarGraficoTop(lista, tipo) {
  const canvas = document.getElementById('chartTopMovimentacoes');
  if (!canvas || typeof Chart === 'undefined') return;

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
          label:
            tipo === 'E'
              ? 'Total de entradas'
              : tipo === 'S'
                ? 'Total de saídas'
                : 'Total movimentado',
          data: valores,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
        },
      },
    },
  });
}

function renderizarGraficoResumoTipos() {
  const canvas = document.getElementById('chartResumoTipos');
  if (!canvas || typeof Chart === 'undefined') return;

  const entradas = movimentacoes
    .filter((m) => m.tipo === 'E')
    .reduce((acc, m) => acc + Number(m.quantidade || 0), 0);

  const saidas = movimentacoes
    .filter((m) => m.tipo === 'S')
    .reduce((acc, m) => acc + Number(m.quantidade || 0), 0);

  if (chartResumo) chartResumo.destroy();

  chartResumo = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Entradas', 'Saídas'],
      datasets: [
        {
          data: [entradas, saidas],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
        },
      },
    },
  });
}

// =============================
// HELPERS
// =============================
function verificarAutenticacao() {
  const currentUser =
    typeof getCurrentUser === 'function' ? getCurrentUser() : null;

  if (!currentUser) {
    window.location.href = '../html/index.html';
  }
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

async function baixarRelatorioPDF() {
  const alvo = document.getElementById('areaRelatorioPDF');
  const botao = document.getElementById('btnBaixarPDF');

  if (!alvo) {
    alert('Área do relatório não encontrada.');
    return;
  }

  if (
    typeof html2canvas === 'undefined' ||
    typeof window.jspdf === 'undefined'
  ) {
    alert('Bibliotecas de PDF não carregadas.');
    return;
  }

  try {
    if (botao) {
      botao.disabled = true;
      botao.innerHTML = '<i data-lucide="loader-circle"></i> Gerando PDF...';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    const canvas = await html2canvas(alvo, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#f7faff',
      scrollX: 0,
      scrollY: -window.scrollY,
    });

    const imgData = canvas.toDataURL('image/png');

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    const hoje = new Date().toISOString().slice(0, 10);
    pdf.save(`relatorio_gestmed_${hoje}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    alert('Não foi possível gerar o PDF.');
  } finally {
    if (botao) {
      botao.disabled = false;
      botao.innerHTML = '<i data-lucide="file-down"></i> Baixar PDF';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
}
