const API_MEDICAMENTOS = 'http://127.0.0.1:8000/api/medicamentos/';
const API_FORNECEDORES = 'http://127.0.0.1:8000/api/fornecedores/';
const API_MOVIMENTACOES = 'http://127.0.0.1:8000/api/movimentacoes/';

let medicamentosCache = [];
let fornecedoresCache = [];
let historicoEntradas = [];
let paginaAtual = 1;

const itensPorPagina = 10;

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacao();
  inicializarListeners();
  ajustarCampoData();
  preencherUsuario();
  inicializarLogout();

  await carregarFornecedores();
  await carregarMedicamentos();
  await carregarHistoricoEntradas();

  atualizarKPIHoje();
  criarIcones();
});

function criarIcones() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

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

    if (!dataEntradaInput.value) {
      dataEntradaInput.value = hoje;
    }
  }
}

function atualizarKPIHoje() {
  const el = document.getElementById('kpiHoje');

  if (el) {
    el.textContent = new Date().toLocaleDateString('pt-BR');
  }
}

async function carregarFornecedores() {
  const select = document.getElementById('fornecedor');

  try {
    const resp = await fetch(API_FORNECEDORES);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();
    fornecedoresCache = Array.isArray(data) ? data : [];

    preencherSelectFornecedores();
  } catch (err) {
    console.error('Erro ao carregar fornecedores:', err);

    if (select) {
      select.innerHTML =
        '<option value="">Erro ao carregar fornecedores</option>';
    }
  }
}

function preencherSelectFornecedores() {
  const select = document.getElementById('fornecedor');

  if (!select) return;

  select.innerHTML = '<option value="">Selecione...</option>';

  fornecedoresCache
    .filter((f) => f.ativo !== false)
    .sort((a, b) =>
      String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
    )
    .forEach((fornecedor) => {
      const option = document.createElement('option');
      option.value = fornecedor.id;
      option.textContent = fornecedor.nome || 'Fornecedor';
      select.appendChild(option);
    });
}

async function carregarMedicamentos() {
  try {
    const resp = await fetch(API_MEDICAMENTOS);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();
    medicamentosCache = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Erro ao carregar medicamentos:', err);
    medicamentosCache = [];
  }
}

async function carregarHistoricoEntradas() {
  try {
    const resp = await fetch(API_MOVIMENTACOES);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

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

async function registrarEntrada(event) {
  event.preventDefault();

  const nome = getValue('nomeMedicamento');
  const miligrama = getValue('miligrama');
  const categoria = getValue('categoria');
  const lote = getValue('lote');
  const quantidade = Number(getValue('quantidade'));
  const valorUnitario = Number(getValue('valorUnitario'));
  const validade = getValue('validade');
  const fornecedorId = Number(getValue('fornecedor'));
  const fornecedorNome = getTextoSelecionado('fornecedor');
  const dataEntrada = getValue('dataEntrada');
  const descricao = getValue('descricao');

  if (!nome) {
    alert('Informe o nome do medicamento.');
    return;
  }

  if (!categoria) {
    alert('Selecione a categoria.');
    return;
  }

  if (!lote) {
    alert('Informe o lote.');
    return;
  }

  if (!quantidade || quantidade <= 0) {
    alert('Informe uma quantidade válida.');
    return;
  }

  if (valorUnitario < 0 || Number.isNaN(valorUnitario)) {
    alert('Informe um valor unitário válido.');
    return;
  }

  if (!validade) {
    alert('Informe a validade.');
    return;
  }

  if (!fornecedorId) {
    alert('Selecione o fornecedor.');
    return;
  }

  try {
    await carregarMedicamentos();

    const medicamentoExistente = encontrarMedicamentoExistente(
      nome,
      lote,
      miligrama
    );

    let medicamentoSalvo;

    if (medicamentoExistente) {
      medicamentoSalvo = await atualizarMedicamentoExistente(
        medicamentoExistente,
        {
          nome,
          miligrama,
          categoria,
          lote,
          validade,
          quantidade,
          valorUnitario,
          fornecedorId,
          descricao,
        }
      );
    } else {
      medicamentoSalvo = await criarMedicamento({
        nome,
        miligrama,
        categoria,
        lote,
        validade,
        quantidade,
        valorUnitario,
        fornecedorId,
        descricao,
      });
    }

    await registrarMovimentacaoEntrada({
      medicamentoId: medicamentoSalvo.id,
      quantidade,
      fornecedorNome,
      categoria,
      lote,
      validade,
      valorUnitario,
      dataEntrada,
    });

    alert('Entrada registrada com sucesso.');

    document.getElementById('formEntrada')?.reset();
    ajustarCampoData();

    await carregarMedicamentos();
    await carregarHistoricoEntradas();
  } catch (err) {
    console.error('Erro ao registrar entrada:', err);
    alert('Não foi possível registrar a entrada.');
  }
}

function encontrarMedicamentoExistente(nome, lote, miligrama) {
  const nomeNormalizado = normalizarTexto(nome);
  const loteNormalizado = normalizarTexto(lote);
  const mgNormalizado = normalizarTexto(miligrama);

  return medicamentosCache.find((m) => {
    return (
      normalizarTexto(m.nome) === nomeNormalizado &&
      normalizarTexto(m.lote) === loteNormalizado &&
      normalizarTexto(m.miligrama) === mgNormalizado
    );
  });
}

async function criarMedicamento(dados) {
  const payload = {
    nome: dados.nome,
    miligrama: dados.miligrama || null,
    categoria: dados.categoria,
    lote: dados.lote,
    validade: dados.validade,
    quantidade: dados.quantidade,
    valor_unit: dados.valorUnitario,
    fornecedor: dados.fornecedorId,
  };

  const resp = await fetch(API_MEDICAMENTOS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const erro = await safeJson(resp);
    console.error('Erro ao criar medicamento:', erro);
    throw new Error('Erro ao criar medicamento.');
  }

  return await resp.json();
}

async function atualizarMedicamentoExistente(medicamento, dados) {
  const quantidadeAtual = Number(medicamento.quantidade ?? 0);
  const novaQuantidade = quantidadeAtual + Number(dados.quantidade ?? 0);

  const payload = {
    nome: dados.nome,
    miligrama: dados.miligrama || null,
    categoria: dados.categoria,
    lote: dados.lote,
    validade: dados.validade,
    quantidade: novaQuantidade,
    valor_unit: dados.valorUnitario,
    descricao: dados.descricao || medicamento.descricao || '',
    fornecedor: dados.fornecedorId,
  };

  const resp = await fetch(`${API_MEDICAMENTOS}${medicamento.id}/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const erro = await safeJson(resp);
    console.error('Erro ao atualizar medicamento:', erro);
    throw new Error('Erro ao atualizar medicamento.');
  }

  return await resp.json();
}

async function registrarMovimentacaoEntrada(dados) {
  const observacao = [
    `Fornecedor: ${dados.fornecedorNome}`,
    `Categoria: ${dados.categoria}`,
    `Lote: ${dados.lote}`,
    `Validade informada: ${dados.validade}`,
    `Valor unitário: ${dados.valorUnitario}`,
    `Data da entrada: ${dados.dataEntrada}`,
  ].join(' | ');

  const payload = {
    medicamento: dados.medicamentoId,
    tipo: 'E',
    quantidade: dados.quantidade,
    observacao,
  };

  const resp = await fetch(API_MOVIMENTACOES, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const erro = await safeJson(resp);
    console.error('Erro ao registrar movimentação:', erro);
    throw new Error('Erro ao registrar movimentação.');
  }

  return await resp.json();
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

  const totalItens = historicoEntradas.reduce((acc, m) => {
    return acc + Number(m.quantidade || 0);
  }, 0);

  setText('kpiTotalEntradas', totalRegistros);
  setText('kpiTotalItens', totalItens);
}

function renderizarTabelaEntradas() {
  const tbody = document.getElementById('tabelaEntrada');
  if (!tbody) return;

  const filtradas = obterEntradasFiltradas();
  const totalPaginas = Math.ceil(filtradas.length / itensPorPagina) || 1;

  if (paginaAtual > totalPaginas) {
    paginaAtual = totalPaginas;
  }

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const pagina = filtradas.slice(inicio, inicio + itensPorPagina);

  tbody.innerHTML = '';

  if (pagina.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-row">
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
    const categoria = extrairTrechoObservacao(m.observacao, 'Categoria:');
    const validade = extrairTrechoObservacao(
      m.observacao,
      'Validade informada:'
    );
    const valorUnitario = extrairTrechoObservacao(
      m.observacao,
      'Valor unitário:'
    );
    const dataEntrada = extrairTrechoObservacao(
      m.observacao,
      'Data da entrada:'
    );

    tr.innerHTML = `
      <td>
        <code>${String(m.medicamento || '').padStart(4, '0')}</code>
      </td>

      <td>
        ${escapeHTML(m.medicamento_nome || '—')}
      </td>

      <td>
        <span class="badge badge-info">${escapeHTML(categoria || '—')}</span>
      </td>

      <td>
        ${Number(m.quantidade || 0)}
      </td>

      <td>
        ${formatarMoeda(valorUnitario)}
      </td>

      <td>
        ${validade ? formatarDataBR(validade) : '—'}
      </td>

      <td>
        ${escapeHTML(fornecedor || '—')}
      </td>

      <td>
        ${dataEntrada ? formatarDataBR(dataEntrada) : formatarDataHora(m.data_movimentacao)}
      </td>

      <td>
        <span class="badge badge-success">Registrada</span>
      </td>
    `;

    tbody.appendChild(tr);
  });

  renderizarPaginacao(totalPaginas);
  criarIcones();
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

window.mudarPaginaEntrada = function (pagina) {
  paginaAtual = pagina;
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

function getTextoSelecionado(id) {
  const select = document.getElementById(id);

  if (!select || select.selectedIndex < 0) {
    return '';
  }

  return select.options[select.selectedIndex]?.text || '';
}

function setText(id, valor) {
  const el = document.getElementById(id);

  if (el) {
    el.textContent = valor;
  }
}

function normalizarTexto(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase();
}

function formatarDataBR(dateStr) {
  if (!dateStr) return '—';

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(dateStr))) {
    return String(dateStr);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) {
    const [ano, mes, dia] = dateStr.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  const d = new Date(dateStr);

  if (isNaN(d.getTime())) {
    return String(dateStr);
  }

  return d.toLocaleDateString('pt-BR');
}

function formatarDataHora(iso) {
  if (!iso) return '—';

  const d = new Date(iso);

  if (isNaN(d.getTime())) {
    return String(iso);
  }

  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatarMoeda(valor) {
  const numero = Number(valor);

  if (Number.isNaN(numero)) {
    return 'R$ 0,00';
  }

  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
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
