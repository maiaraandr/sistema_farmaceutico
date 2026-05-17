const API_MEDICAMENTOS =
  'https://sistemafarmaceutico-production.up.railway.app/api/medicamentos/';
const API_MOVIMENTACOES =
  'https://sistemafarmaceutico-production.up.railway.app/api/movimentacoes/';

let medicamentos = [];
let saidas = [];
let paginaAtual = 1;
const itensPorPagina = 10;

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacao();
  preencherUsuario();
  inicializarEventos();
  inicializarLogout();
  ajustarCampoData();

  await carregarMedicamentos();
  await carregarSaidas();

  atualizarKPIs();

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

function inicializarEventos() {
  document
    .getElementById('formSaida')
    ?.addEventListener('submit', registrarSaida);

  document.getElementById('searchSaida')?.addEventListener('input', () => {
    paginaAtual = 1;
    renderTabela();
  });

  document.getElementById('btnLimparSaida')?.addEventListener('click', () => {
    setTimeout(() => {
      ajustarCampoData();
      limparEstoqueDisponivel();
    }, 0);
  });

  document
    .getElementById('medicamento')
    ?.addEventListener('change', mostrarEstoqueDisponivel);

  const btn = document.getElementById('btnExportarSaida');
  const menu = document.getElementById('dropdownExportarSaida');

  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    menu?.classList.toggle('active');
  });

  document.addEventListener('click', () => {
    menu?.classList.remove('active');
  });

  document
    .getElementById('btnExportarCSVSaida')
    ?.addEventListener('click', exportarCSVSaida);

  document
    .getElementById('btnExportarExcelSaida')
    ?.addEventListener('click', exportarExcelSaida);
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
  const currentUser =
    typeof getCurrentUser === 'function' ? getCurrentUser() : null;

  const el = document.getElementById('userName');
  if (el) {
    el.textContent = currentUser?.nome || 'Usuário';
  }
}

function ajustarCampoData() {
  const campoData = document.getElementById('dataSaida');
  if (campoData) {
    const hoje = new Date().toISOString().split('T')[0];
    campoData.max = hoje;
    if (!campoData.value) campoData.value = hoje;
  }
}

function mostrarEstoqueDisponivel() {
  const selectMedicamento = document.getElementById('medicamento');
  const campoEstoque = document.getElementById('estoqueAtual');

  if (!selectMedicamento || !campoEstoque) return;

  const medicamentoId = Number(selectMedicamento.value);

  if (!medicamentoId) {
    campoEstoque.value = '';
    return;
  }

  const medicamentoSelecionado = medicamentos.find(
    (m) => Number(m.id) === medicamentoId
  );

  if (!medicamentoSelecionado) {
    campoEstoque.value = 'Não encontrado';
    return;
  }

  const estoque =
    Number(
      medicamentoSelecionado.stock_atual ??
        medicamentoSelecionado.estoque ??
        medicamentoSelecionado.quantidade ??
        0
    ) || 0;

  campoEstoque.value = `${estoque} unidade(s)`;
}

function limparEstoqueDisponivel() {
  const campoEstoque = document.getElementById('estoqueAtual');
  if (campoEstoque) {
    campoEstoque.value = '';
  }
}

async function carregarMedicamentos() {
  try {
    const resp = await fetch(API_MEDICAMENTOS);
    if (!resp.ok) {
      throw new Error(`Erro HTTP ${resp.status}`);
    }

    medicamentos = await resp.json();

    const select = document.getElementById('medicamento');
    if (!select) return;

    select.innerHTML = `
      <option value="">Selecione...</option>
      ${medicamentos
        .map(
          (m) =>
            `<option value="${m.id}">${String(m.id).padStart(4, '0')} - ${escapeHTML(m.nome || '')} ${escapeHTML(m.miligrama || '')}</option>`
        )
        .join('')}
    `;
  } catch (error) {
    console.error('Erro ao carregar medicamentos:', error);
    alert('Não foi possível carregar os medicamentos.');
  }
}

async function carregarSaidas() {
  try {
    const resp = await fetch(API_MOVIMENTACOES);
    if (!resp.ok) {
      throw new Error(`Erro HTTP ${resp.status}`);
    }

    const data = await resp.json();

    saidas = Array.isArray(data) ? data.filter((m) => m.tipo === 'S') : [];

    renderTabela();
  } catch (error) {
    console.error('Erro ao carregar saídas:', error);
    alert('Não foi possível carregar o histórico de saídas.');
  }
}

async function registrarSaida(e) {
  e.preventDefault();

  const medicamento = document.getElementById('medicamento').value;
  const quantidade = document.getElementById('quantidade').value;
  const destino = document.getElementById('destino').value.trim();
  const data = document.getElementById('dataSaida').value;

  if (!medicamento) {
    alert('Selecione medicamento');
    return;
  }
  if (!quantidade || Number(quantidade) <= 0) {
    alert('Informe quantidade válida');
    return;
  }
  if (!destino) {
    alert('Informe o destino ou motivo');
    return;
  }
  if (!data) {
    alert('Informe a data da saída');
    return;
  }

  const medicamentoSelecionado = medicamentos.find(
    (m) => Number(m.id) === Number(medicamento)
  );

  const estoqueDisponivel =
    Number(
      medicamentoSelecionado?.stock_atual ??
        medicamentoSelecionado?.estoque ??
        medicamentoSelecionado?.quantidade ??
        0
    ) || 0;

  if (Number(quantidade) > estoqueDisponivel) {
    alert(`Estoque insuficiente. Disponível: ${estoqueDisponivel}`);
    return;
  }

  const payload = {
    medicamento: Number(medicamento),
    tipo: 'S',
    quantidade: Number(quantidade),
    observacao: `Destino: ${destino} | Data: ${data}`,
  };

  try {
    const resp = await fetch(API_MOVIMENTACOES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const erro = await safeJson(resp);
      console.error('Erro ao registrar saída:', erro);
      alert('Não foi possível registrar a saída.');
      return;
    }

    document.getElementById('formSaida')?.reset();
    ajustarCampoData();
    limparEstoqueDisponivel();

    await carregarMedicamentos();
    await carregarSaidas();
    atualizarKPIs();

    alert('Saída registrada com sucesso.');
  } catch (error) {
    console.error('Erro ao registrar saída:', error);
    alert('Erro de conexão com a API.');
  }
}

// ── TABELA ──

function renderTabela() {
  const tbody = document.getElementById('tabelaSaida');
  if (!tbody) return;

  const busca = (document.getElementById('searchSaida')?.value || '')
    .toLowerCase()
    .trim();

  const filtradas = saidas.filter((s) =>
    String(s.medicamento_nome || '')
      .toLowerCase()
      .includes(busca)
  );

  window.saidasFiltradas = filtradas;

  const totalPaginas = Math.ceil(filtradas.length / itensPorPagina) || 1;
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const pagina = filtradas.slice(inicio, inicio + itensPorPagina);

  tbody.innerHTML = '';

  if (!pagina.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">Nenhuma saída registrada ainda.</td>
      </tr>
    `;
    renderizarPaginacao(totalPaginas);
    atualizarBadgeTotal(filtradas.length);
    return;
  }

  pagina.forEach((s) => {
    const destino = extrair(s.observacao, 'Destino:');
    const dataSaida = extrair(s.observacao, 'Data:');

    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td><code>${String(s.medicamento || '').padStart(4, '0')}</code></td>` +
      `<td><strong>${escapeHTML(s.medicamento_nome || '—')}</strong></td>` +
      `<td>${Number(s.quantidade || 0)}</td>` +
      `<td>${escapeHTML(destino || '—')}</td>` +
      `<td>${dataSaida ? fmtDataBR(dataSaida) : fmtDataHora(s.data_movimentacao)}</td>` +
      `<td><span class="badge badge-success">Registrada</span></td>`;
    tbody.appendChild(tr);
  });

  renderizarPaginacao(totalPaginas);
  atualizarBadgeTotal(filtradas.length);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function renderizarPaginacao(totalPaginas) {
  const el = document.getElementById('paginationSaida');
  if (!el) return;

  if (totalPaginas <= 1) {
    el.innerHTML = '';
    return;
  }

  let html = `<button class="pagination-btn" ${paginaAtual === 1 ? 'disabled' : ''} onclick="mudarPaginaSaida(${paginaAtual - 1})" type="button">‹</button>`;

  for (let i = 1; i <= totalPaginas; i++) {
    html += `<button class="pagination-btn ${i === paginaAtual ? 'active' : ''}" onclick="mudarPaginaSaida(${i})" type="button">${i}</button>`;
  }

  html += `<button class="pagination-btn" ${paginaAtual === totalPaginas ? 'disabled' : ''} onclick="mudarPaginaSaida(${paginaAtual + 1})" type="button">›</button>`;

  el.innerHTML = html;
}

window.mudarPaginaSaida = function (pagina) {
  paginaAtual = pagina;
  renderTabela();
};

function atualizarBadgeTotal(total) {
  const el = document.getElementById('totalLinhasSaida');
  if (el) el.textContent = total;
}

// ── KPIs ──

function atualizarKPIs() {
  const kpiSaidas = document.getElementById('kpiSaidas');
  const kpiHoje = document.getElementById('kpiHoje');
  const kpiUltimo = document.getElementById('kpiUltimo');

  if (kpiSaidas) kpiSaidas.textContent = saidas.length;
  if (kpiHoje) kpiHoje.textContent = new Date().toLocaleDateString('pt-BR');

  const ultimo = saidas[0]?.medicamento_nome || '—';
  if (kpiUltimo) kpiUltimo.textContent = ultimo;

  atualizarBadgeTotal(saidas.length);
}

// ── EXPORTAÇÃO ──

function exportarCSVSaida() {
  const lista = window.saidasFiltradas || [];
  if (!lista.length) {
    alert('Não há dados para exportar.');
    return;
  }

  const header = [
    'Código',
    'Medicamento',
    'Quantidade',
    'Destino',
    'Data da Saída',
  ];
  const rows = lista.map((s) => [
    String(s.medicamento || '').padStart(4, '0'),
    s.medicamento_nome || '',
    s.quantidade || 0,
    extrair(s.observacao, 'Destino:'),
    extrair(s.observacao, 'Data:'),
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `saidas_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  document.getElementById('dropdownExportarSaida')?.classList.remove('active');
}

function exportarExcelSaida() {
  const lista = window.saidasFiltradas || [];
  if (!lista.length) {
    alert('Não há dados para exportar.');
    return;
  }
  if (typeof XLSX === 'undefined') {
    alert('Biblioteca XLSX não carregada.');
    return;
  }

  const dados = lista.map((s) => ({
    Código: String(s.medicamento || '').padStart(4, '0'),
    Medicamento: s.medicamento_nome || '',
    Quantidade: Number(s.quantidade || 0),
    Destino: extrair(s.observacao, 'Destino:'),
    'Data da Saída': extrair(s.observacao, 'Data:'),
  }));

  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Saídas');
  XLSX.writeFile(wb, `saidas_${new Date().toISOString().slice(0, 10)}.xlsx`);

  document.getElementById('dropdownExportarSaida')?.classList.remove('active');
}

// ── HELPERS ──

function extrair(texto, label) {
  if (!texto) return '';
  const p = String(texto)
    .split('|')
    .find((x) => x.trim().startsWith(label));
  return p ? p.replace(label, '').trim() : '';
}

function fmtDataBR(s) {
  if (!s) return '—';
  const str = String(s);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const p = str.split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? str : dt.toLocaleDateString('pt-BR');
}

function fmtDataHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return (
    d.toLocaleDateString('pt-BR') +
    ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function safeJson(resp) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

function verificarAutenticacao() {
  const currentUser =
    typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!currentUser) window.location.href = '../html/index.html';
}
