let saidas = [];
let paginaAtual = 1;
const itensPorPagina = 10;

window.saidasFiltradas = [];

// ===============================
// INIT
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  verificarAutenticacao();
  carregarSaidas();
  inicializarEventListeners();
  renderizarTabela();
  inicializarExportacao();
  atualizarKPIs();
  if (typeof lucide !== 'undefined') lucide.createIcons();
});

// ===============================
// STORAGE (usa farm_movimentacoes do Storage.js)
// ===============================
function getSaidasStorage() {
  // Preferir funções do Storage.js se existirem
  if (typeof getMovimentacoes === 'function') {
    const movs = getMovimentacoes() || [];
    return movs.filter((m) => m && m.tipo === 'saida' && m.ativo !== false);
  }

  // Fallback: tenta chave direta (caso você tenha usado antes)
  const raw = localStorage.getItem('farm_movimentacoes');
  const lista = raw ? safeJSONParse(raw, []) : [];
  return (Array.isArray(lista) ? lista : []).filter(
    (m) => m && m.tipo === 'saida' && m.ativo !== false
  );
}

function saveSaidasStorage(lista) {
  // Salva via Storage.js se existir
  if (typeof saveMovimentacoes === 'function') {
    return saveMovimentacoes(lista);
  }
  localStorage.setItem('farm_movimentacoes', JSON.stringify(lista));
  return true;
}

function addSaidaStorage(saida) {
  // Se existir addMovimentacao no Storage.js, usa
  if (typeof addMovimentacao === 'function') {
    return addMovimentacao(saida);
  }

  // Fallback manual
  const lista = getSaidasStorageAllMovs();
  lista.push(saida);
  return saveSaidasStorage(lista);
}

// Pega TODAS movimentações (para não sobrescrever entradas)
function getSaidasStorageAllMovs() {
  if (typeof getMovimentacoes === 'function') {
    return getMovimentacoes() || [];
  }
  const raw = localStorage.getItem('farm_movimentacoes');
  const lista = raw ? safeJSONParse(raw, []) : [];
  return Array.isArray(lista) ? lista : [];
}

// ===============================
// CARREGAR DADOS
// ===============================
function carregarSaidas() {
  try {
    saidas = getSaidasStorage();
  } catch (e) {
    console.warn('Erro ao carregar saídas:', e);
    saidas = [];
  }
  if (!Array.isArray(saidas)) saidas = [];
}

// ===============================
// EVENTOS
// ===============================
function inicializarEventListeners() {
  // Buscar
  document
    .getElementById('searchSaida')
    ?.addEventListener('input', aplicarFiltros);

  // Registrar saída
  document.getElementById('formSaida')?.addEventListener('submit', (e) => {
    e.preventDefault();
    registrarSaida();
  });
}

// ===============================
// REGISTRAR SAÍDA
// ===============================
function registrarSaida() {
  const medicamentoEl = document.getElementById('medicamento');
  const quantidadeEl = document.getElementById('quantidade');
  const destinoEl = document.getElementById('destino');
  const dataEl = document.getElementById('dataSaida');

  const medicamento = (medicamentoEl?.value || '').trim();
  const quantidade = Number(quantidadeEl?.value || 0);
  const destino = (destinoEl?.value || '').trim();
  const data = (dataEl?.value || '').trim(); // YYYY-MM-DD (do input type=date)

  if (!medicamento) return alert('Informe o medicamento.');
  if (!quantidade || quantidade < 1) return alert('Quantidade inválida.');
  if (!destino) return alert('Informe o destino/motivo.');
  if (!data) return alert('Informe a data da saída.');

  const currentUser =
    typeof getCurrentUser === 'function' ? getCurrentUser() : null;

  const saida = {
    id: typeof makeId === 'function' ? makeId() : Date.now(),
    tipo: 'saida',
    medicamento,
    quantidade,
    destino,
    data, // mantém a data que você escolheu
    responsavel: currentUser?.nome || '—',
    ativo: true,
    criadoEm: new Date().toISOString(),
  };

  // Salva
  addSaidaStorage(saida);

  // Atualiza lista/tela
  carregarSaidas();
  paginaAtual = 1;
  renderizarTabela();
  atualizarKPIs();

  // Limpa form (mantém a data se você quiser repetir; se não quiser, descomente a linha)
  document.getElementById('formSaida')?.reset();
  // dataEl.value = '';

  alert('Saída registrada com sucesso!');
}

// ===============================
// FILTROS
// ===============================
function obterSaidasFiltradas() {
  const search = (document.getElementById('searchSaida')?.value || '')
    .toLowerCase()
    .trim();

  if (!search) return saidas;

  return saidas.filter((s) => {
    const med = (s.medicamento || s.nome || '').toLowerCase();
    const dest = (s.destino || '').toLowerCase();
    return med.includes(search) || dest.includes(search);
  });
}

function aplicarFiltros() {
  paginaAtual = 1;
  renderizarTabela();
  atualizarKPIs();
}

// ===============================
// KPIs
// ===============================
function atualizarKPIs() {
  const filtrados = obterSaidasFiltradas();
  window.saidasFiltradas = filtrados;

  const total = filtrados.length;

  const hoje = new Date();
  const hojeStr = hoje.toLocaleDateString('pt-BR');

  const ultimo = filtrados[0]
    ? filtrados
        .slice()
        .sort((a, b) =>
          String(b.data || '').localeCompare(String(a.data || ''))
        )[0]?.medicamento || '—'
    : '—';

  const s = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };

  s('kpiSaidas', total);
  s('kpiHoje', hojeStr);
  s('kpiUltimo', ultimo);
  s('totalLinhasSaida', total);
}

// ===============================
// RENDER TABELA + PAGINAÇÃO
// ===============================
function renderizarTabela() {
  const tbody = document.getElementById('tabelaSaida');
  if (!tbody) return;

  const filtrados = obterSaidasFiltradas();
  window.saidasFiltradas = filtrados;

  const totalPaginas = Math.ceil(filtrados.length / itensPorPagina) || 1;
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const pagina = filtrados.slice(inicio, inicio + itensPorPagina);

  tbody.innerHTML = '';

  if (!pagina.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:40px;color:var(--gray-500)">
          Nenhuma saída encontrada
        </td>
      </tr>`;
    renderizarPaginacao(1);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  pagina.forEach((saida) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${escapeHTML(saida.medicamento || saida.nome || '-')}</td>
      <td>${Number(saida.quantidade || 0)}</td>
      <td>${escapeHTML(saida.destino || '-')}</td>
      <td>${formatarData(saida.data)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon btn-icon-danger" title="Excluir" onclick="excluirSaida(${Number(saida.id)})">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  renderizarPaginacao(totalPaginas);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderizarPaginacao(totalPaginas) {
  const pag = document.getElementById('paginationSaida');
  if (!pag) return;

  if (totalPaginas <= 1) {
    pag.innerHTML = '';
    return;
  }

  let html = `<button class="pagination-btn" ${
    paginaAtual === 1 ? 'disabled' : ''
  } onclick="mudarPaginaSaida(${paginaAtual - 1})">
    <i data-lucide="chevron-left"></i>
  </button>`;

  for (let i = 1; i <= totalPaginas; i++) {
    html += `<button class="pagination-btn ${
      i === paginaAtual ? 'active' : ''
    }" onclick="mudarPaginaSaida(${i})">${i}</button>`;
  }

  html += `<button class="pagination-btn" ${
    paginaAtual === totalPaginas ? 'disabled' : ''
  } onclick="mudarPaginaSaida(${paginaAtual + 1})">
    <i data-lucide="chevron-right"></i>
  </button>`;

  pag.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function mudarPaginaSaida(p) {
  paginaAtual = p;
  renderizarTabela();
}

// ===============================
// EXCLUIR SAÍDA (soft delete)
// ===============================
window.excluirSaida = function excluirSaida(id) {
  const ok = confirm('Deseja excluir esta saída?');
  if (!ok) return;

  const movs = getSaidasStorageAllMovs();
  const idx = movs.findIndex((m) => Number(m?.id) === Number(id));
  if (idx === -1) return;

  movs[idx] = {
    ...movs[idx],
    ativo: false,
    atualizadoEm: new Date().toISOString(),
  };
  saveSaidasStorage(movs);

  carregarSaidas();
  const total = obterSaidasFiltradas().length;
  const totalPaginas = Math.ceil(total / itensPorPagina) || 1;
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  renderizarTabela();
  atualizarKPIs();
};

// ===============================
// EXPORTAÇÃO (dropdown do seu HTML)
// ===============================
function inicializarExportacao() {
  const btn = document.getElementById('btnExportarSaida');
  const menu = document.getElementById('dropdownExportarSaida');

  if (!btn || !menu) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.remove('active');
    }
  });

  // CSV
  document
    .getElementById('btnExportarCSVSaida')
    ?.addEventListener('click', () => {
      const lista = window.saidasFiltradas || [];
      if (!lista.length) return alert('Não há dados para exportar.');

      const header = [
        'Medicamento',
        'Quantidade',
        'Destino',
        'Data',
        'Responsável',
      ];

      const rows = lista.map((s) => [
        s.medicamento || s.nome || '',
        Number(s.quantidade || 0),
        s.destino || '',
        s.data || '',
        s.responsavel || '',
      ]);

      const csv = [header, ...rows]
        .map((r) =>
          r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
        )
        .join('\n');

      const blob = new Blob(['\uFEFF' + csv], {
        type: 'text/csv;charset=utf-8;',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saidas_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      menu.classList.remove('active');
    });

  // Excel
  document
    .getElementById('btnExportarExcelSaida')
    ?.addEventListener('click', () => {
      const lista = window.saidasFiltradas || [];
      if (!lista.length) return alert('Não há dados para exportar.');

      if (typeof XLSX === 'undefined') {
        alert(
          'Biblioteca XLSX não carregada. Adicione a CDN do SheetJS no HTML.'
        );
        return;
      }

      const dados = lista.map((s) => ({
        Medicamento: s.medicamento || s.nome || '',
        Quantidade: Number(s.quantidade || 0),
        Destino: s.destino || '',
        Data: s.data || '',
        Responsável: s.responsavel || '',
      }));

      const ws = XLSX.utils.json_to_sheet(dados);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Saídas');
      XLSX.writeFile(
        wb,
        `saidas_${new Date().toISOString().slice(0, 10)}.xlsx`
      );

      menu.classList.remove('active');
    });
}

// ===============================
// HELPERS
// ===============================
function formatarData(data) {
  if (!data) return '-';

  // Se vier YYYY-MM-DD do input date
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(data))) {
    const [y, m, d] = String(data).split('-');
    return `${d}/${m}/${y}`;
  }

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
  if (el) el.textContent = currentUser.nome || 'Usuário';
}

// Se o Storage.js não tiver safeJSONParse global, cria um fallback
function safeJSONParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
