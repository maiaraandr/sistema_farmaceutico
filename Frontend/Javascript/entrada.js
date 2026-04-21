const API_MEDICAMENTOS = 'http://127.0.0.1:8000/api/medicamentos/';
const API_MOVIMENTACOES = 'http://127.0.0.1:8000/api/movimentacoes/';

let medicamentosCache = [];
let historicoEntradas = [];
let paginaAtual = 1;
const itensPorPagina = 10;

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacao();
  inicializarListeners();
  ajustarCampoData();
  preencherUsuario();
  inicializarLogout();

  await carregarMedicamentos();
  await carregarHistoricoEntradas();
  atualizarKPIHoje();

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

function inicializarListeners() {
  document
    .getElementById('formEntrada')
    ?.addEventListener('submit', registrarEntrada);

  document
    .getElementById('searchEntrada')
    ?.addEventListener('input', aplicarFiltros);

  document.getElementById('btnLimparEntrada')?.addEventListener('click', () => {
    setTimeout(() => {
      ajustarCampoData();
    }, 0);
  });
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
    window.location.href = 'index.html';
  });
}

function preencherUsuario() {
  const el = document.getElementById('userName');
  const currentUser =
    typeof getCurrentUser === 'function' ? getCurrentUser() : null;

  if (el) {
    el.textContent = currentUser?.nome || 'Usuário';
  }
}

function ajustarCampoData() {
  const dataEntradaInput = document.getElementById('dataEntrada');
  if (dataEntradaInput) {
    const hoje = new Date().toISOString().split('T')[0];
    dataEntradaInput.max = hoje;
    if (!dataEntradaInput.value) dataEntradaInput.value = hoje;
  }
}

function atualizarKPIHoje() {
  const el = document.getElementById('kpiHoje');
  if (el) {
    el.textContent = new Date().toLocaleDateString('pt-BR');
  }
}

async function carregarMedicamentos() {
  const campoMedicamento = document.getElementById('medicamento');
  if (!campoMedicamento) return;

  try {
    const resp = await fetch(API_MEDICAMENTOS);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    medicamentosCache = Array.isArray(data) ? data : [];

    transformarCampoMedicamentoEmSelect(campoMedicamento, medicamentosCache);
  } catch (err) {
    console.error('Erro ao carregar medicamentos:', err);
    alert('Não foi possível carregar os medicamentos da API.');
  }
}

async function carregarHistoricoEntradas() {
  try {
    const resp = await fetch(API_MOVIMENTACOES);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    const lista = Array.isArray(data) ? data : [];

    historicoEntradas = lista.filter((m) => m.tipo === 'E');

    renderizarTabelaEntradas();
    atualizarKPIsEntradas();
  } catch (err) {
    console.error('Erro ao carregar histórico de entradas:', err);
    alert('Não foi possível carregar o histórico de entradas.');
  }
}

async function registrarEntrada(e) {
  e.preventDefault();

  const medicamentoId = Number(getValue('medicamento'));
  const quantidade = Number(getValue('quantidade'));
  const validade = getValue('validade');
  const fornecedor = getValue('fornecedor');
  const dataEntrada = getValue('dataEntrada');

  if (!medicamentoId) {
    alert('Selecione um medicamento.');
    return;
  }

  if (!quantidade || quantidade <= 0) {
    alert('Informe uma quantidade válida.');
    return;
  }

  const observacao = [
    fornecedor ? `Fornecedor: ${fornecedor}` : null,
    validade ? `Validade informada: ${validade}` : null,
    dataEntrada ? `Data da entrada: ${dataEntrada}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const payload = {
    medicamento: medicamentoId,
    tipo: 'E',
    quantidade,
    observacao: observacao || 'Entrada',
  };

  try {
    const resp = await fetch(API_MOVIMENTACOES, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const erro = await safeJson(resp);
      console.error('Erro ao registrar entrada:', erro);
      alert('Não foi possível registrar a entrada.');
      return;
    }

    alert('Entrada registrada com sucesso.');

    document.getElementById('formEntrada')?.reset();
    ajustarCampoData();

    await carregarHistoricoEntradas();
  } catch (err) {
    console.error('Erro de conexão ao registrar entrada:', err);
    alert('Erro de conexão com a API.');
  }
}

function transformarCampoMedicamentoEmSelect(inputOriginal, medicamentos) {
  const select = document.createElement('select');
  select.id = 'medicamento';
  select.className = 'form-input';
  select.required = true;

  select.innerHTML = `
    <option value="">Selecione...</option>
    ${medicamentos
      .sort((a, b) =>
        String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
      )
      .map((m) => {
        const label = `${escapeHTML(m.nome || 'Sem nome')}${m.miligrama ? ' ' + escapeHTML(m.miligrama) : ''}`;
        return `<option value="${m.id}">${label}</option>`;
      })
      .join('')}
  `;

  inputOriginal.replaceWith(select);
}

function obterEntradasFiltradas() {
  const termo = (document.getElementById('searchEntrada')?.value || '')
    .toLowerCase()
    .trim();

  return historicoEntradas.filter((m) => {
    if (!termo) return true;

    const nome = String(m.medicamento_nome || '').toLowerCase();
    const obs = String(m.observacao || '').toLowerCase();

    return nome.includes(termo) || obs.includes(termo);
  });
}

function aplicarFiltros() {
  paginaAtual = 1;
  renderizarTabelaEntradas();
}

function atualizarKPIsEntradas() {
  const totalRegistros = historicoEntradas.length;
  const totalItens = historicoEntradas.reduce(
    (acc, m) => acc + Number(m.quantidade || 0),
    0
  );

  setText('kpiTotalEntradas', totalRegistros);
  setText('kpiTotalItens', totalItens);
}

function setText(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}

function renderizarTabelaEntradas() {
  const tbody = document.getElementById('tabelaEntrada');
  if (!tbody) return;

  const filtradas = obterEntradasFiltradas();
  const totalPaginas = Math.ceil(filtradas.length / itensPorPagina) || 1;

  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const pagina = filtradas.slice(inicio, inicio + itensPorPagina);

  tbody.innerHTML = '';

  if (pagina.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">
          Nenhuma entrada registrada ainda.
        </td>
      </tr>
    `;
    renderizarPaginacao(totalPaginas);
    return;
  }

  pagina.forEach((m) => {
    const tr = document.createElement('tr');

    const fornecedor = extrairTrechoObservacao(m.observacao, 'Fornecedor:');
    const validade = extrairTrechoObservacao(
      m.observacao,
      'Validade informada:'
    );
    const dataEntrada = extrairTrechoObservacao(
      m.observacao,
      'Data da entrada:'
    );

    tr.innerHTML = `
      <td>${escapeHTML(m.medicamento_nome || '—')}</td>
      <td>${Number(m.quantidade || 0)}</td>
      <td>${escapeHTML(fornecedor || '—')}</td>
      <td>${validade ? formatarDataBR(validade) : '—'}</td>
      <td>${dataEntrada ? formatarDataBR(dataEntrada) : formatarDataHora(m.data_movimentacao)}</td>
      <td>
        <span class="badge badge-success">Registrada</span>
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
  const el = document.getElementById('paginationEntrada');
  if (!el) return;

  if (totalPaginas <= 1) {
    el.innerHTML = '';
    return;
  }

  let html = `
    <button
      class="pagination-btn"
      ${paginaAtual === 1 ? 'disabled' : ''}
      onclick="mudarPaginaEntrada(${paginaAtual - 1})"
      type="button"
    >
      ‹
    </button>
  `;

  for (let i = 1; i <= totalPaginas; i++) {
    html += `
      <button
        class="pagination-btn ${i === paginaAtual ? 'active' : ''}"
        onclick="mudarPaginaEntrada(${i})"
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
      onclick="mudarPaginaEntrada(${paginaAtual + 1})"
      type="button"
    >
      ›
    </button>
  `;

  el.innerHTML = html;
}

window.mudarPaginaEntrada = function (p) {
  paginaAtual = p;
  renderizarTabelaEntradas();
};

async function safeJson(resp) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? String(el.value).trim() : '';
}

function formatarDataBR(dateStr) {
  if (!dateStr) return '—';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(dateStr))) return String(dateStr);

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) {
    const [ano, mes, dia] = dateStr.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);

  return d.toLocaleDateString('pt-BR');
}

function formatarDataHora(iso) {
  if (!iso) return '—';

  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);

  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function extrairTrechoObservacao(obs, prefixo) {
  if (!obs) return '';

  const partes = String(obs)
    .split('|')
    .map((p) => p.trim());
  const trecho = partes.find((p) => p.startsWith(prefixo));
  return trecho ? trecho.replace(prefixo, '').trim() : '';
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
