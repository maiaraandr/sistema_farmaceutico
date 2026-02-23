// Verifica dependências do Storage.js
const depsOk =
  typeof getProdutos === 'function' &&
  typeof updateProduto === 'function' &&
  typeof addMovimentacao === 'function' &&
  typeof getMovimentacoes === 'function' &&
  typeof getProdutoById === 'function' &&
  typeof saveMovimentacoes === 'function';

if (!depsOk) {
  console.error('Storage.js não foi carregado ou funções ausentes.');
  alert(
    'Erro: Storage.js não carregou. Verifique se ele está antes do entrada.js no HTML.'
  );
}

// Bloqueia datas futuras
const dataEntradaInput = document.getElementById('dataEntrada');
if (dataEntradaInput) {
  dataEntradaInput.max = new Date().toISOString().split('T')[0];
}

const form = document.getElementById('formEntrada');
if (form) form.addEventListener('submit', onSubmitEntrada);

const searchInput = document.getElementById('searchEntrada');
if (searchInput) searchInput.addEventListener('input', renderEntradas);

renderEntradas();
if (typeof lucide !== 'undefined') lucide.createIcons();

// ── Submit ──
function onSubmitEntrada(e) {
  e.preventDefault();

  const medicamentoDigitado = getValue('medicamento');
  const quantidade = Number(getValue('quantidade'));
  const fornecedor = getValue('fornecedor');
  const validade = getValue('validade');
  const dataEntrada = getValue('dataEntrada');

  if (
    !medicamentoDigitado ||
    !fornecedor ||
    !validade ||
    !dataEntrada ||
    !quantidade ||
    quantidade <= 0
  ) {
    alert(
      'Preencha todos os campos corretamente (quantidade deve ser maior que 0).'
    );
    return;
  }

  const produtos = getProdutos();
  const buscado = medicamentoDigitado.toLowerCase().trim();

  // Busca medicamento existente
  let produto = produtos.find(
    (p) => (p.nome || '').toLowerCase().trim() === buscado
  );
  if (!produto) {
    produto = produtos.find((p) =>
      (p.nome || '').toLowerCase().includes(buscado)
    );
  }

  if (produto) {
    // ✅ Já existe: só atualiza o estoque
    updateProduto(produto.id, {
      stock_atual: Number(produto.stock_atual ?? 0) + quantidade,
      vencimento: validade,
    });
  } else {
    // ✅ Não existe: cria automaticamente em Medicamentos
    const novoId = Date.now();
    const novoProduto = {
      id: novoId,
      nome: medicamentoDigitado,
      categoria: '',
      stock_atual: quantidade,
      stock_minimo: 0,
      preco: 0,
      vencimento: validade,
      fornecedor_id: null,
      ativo: true,
      criadoEm: new Date().toISOString(),
    };

    // Usa addProduto se existir, senão salva direto no localStorage
    if (typeof addProduto === 'function') {
      addProduto(novoProduto);
    } else {
      const lista = getProdutos();
      lista.push(novoProduto);
      localStorage.setItem('produtos', JSON.stringify(lista));
    }

    produto = novoProduto;
  }

  // Registra movimentação
  addMovimentacao({
    tipo: 'entrada',
    produto_id: produto.id,
    medicamento: produto.nome,
    quantidade,
    fornecedor,
    validade,
    dataBR: dataEntrada,
  });

  document.getElementById('formEntrada')?.reset();
  const di = document.getElementById('dataEntrada');
  if (di) di.max = new Date().toISOString().split('T')[0];

  renderEntradas();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Render tabela ──
function renderEntradas() {
  atualizarKPIs();

  const tbody = document.getElementById('tabelaEntrada');
  if (!tbody) return;

  const termo = (document.getElementById('searchEntrada')?.value || '')
    .toLowerCase()
    .trim();

  const movs = getMovimentacoes()
    .filter((m) => m.tipo === 'entrada')
    .filter((m) => {
      if (!termo) return true;
      return (
        (m.medicamento || '').toLowerCase().includes(termo) ||
        (m.fornecedor || '').toLowerCase().includes(termo)
      );
    })
    .sort((a, b) => {
      const da = new Date(a.data || a.criadoEm || 0).getTime();
      const db = new Date(b.data || b.criadoEm || 0).getTime();
      return db - da;
    });

  if (movs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:16px;color:var(--gray-600,#4b5563);text-align:center">
          Nenhuma entrada registrada ainda.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = movs
    .map((m) => {
      const validade = m.validade ? formatarDataBR(m.validade) : '—';
      const dataEntrada = m.dataBR
        ? formatarDataBR(m.dataBR)
        : m.data
          ? formatarDataBR(m.data)
          : '—';

      return `
      <tr>
        <td>${escapeHtml(m.medicamento || '—')}</td>
        <td>${Number(m.quantidade ?? 0)}</td>
        <td>${escapeHtml(m.fornecedor || '—')}</td>
        <td>${validade}</td>
        <td>${dataEntrada}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="excluirEntrada(${m.id})">
            <i data-lucide="trash-2"></i> Excluir
          </button>
        </td>
      </tr>`;
    })
    .join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Excluir entrada ──
function excluirEntrada(movId) {
  if (
    !confirm('Deseja realmente excluir esta entrada? O estoque será ajustado.')
  )
    return;

  const movs = getMovimentacoes();
  const mov = movs.find((m) => m.id === movId);
  if (!mov) return;

  const produto = getProdutoById(mov.produto_id);
  if (produto) {
    const atual = Number(produto.stock_atual ?? 0);
    const qtd = Number(mov.quantidade ?? 0);
    updateProduto(produto.id, { stock_atual: Math.max(0, atual - qtd) });
  }

  saveMovimentacoes(movs.filter((m) => m.id !== movId));
  renderEntradas();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── KPIs ──
function atualizarKPIs() {
  const entradas = getMovimentacoes().filter((m) => m.tipo === 'entrada');
  const totalEntradas = entradas.length;
  const totalItens = entradas.reduce(
    (acc, m) => acc + Number(m.quantidade ?? 0),
    0
  );

  const elTotal = document.getElementById('kpiTotalEntradas');
  const elItens = document.getElementById('kpiTotalItens');
  if (elTotal) elTotal.textContent = totalEntradas;
  if (elItens) elItens.textContent = totalItens;
}

// ── Helpers ──
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
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// entrada.js — agora registra ENTRADA via /movimentacoes/ (tipo = "E")

let medicamentosCache = [];
let paginaAtual = 1;
const itensPorPagina = 10;
window.movEntradaFiltradas = [];

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacao();

  await carregarMedicamentosNoSelect();
  await carregarHistoricoEntradas();

  inicializarListeners();
  if (typeof lucide !== 'undefined') lucide.createIcons();
});

function inicializarListeners() {
  document
    .getElementById('formEntrada')
    ?.addEventListener('submit', registrarEntrada);
  document
    .getElementById('searchEntrada')
    ?.addEventListener('input', aplicarFiltros);
}

// =============================
// CARREGAR MEDICAMENTOS (SELECT)
// =============================
async function carregarMedicamentosNoSelect() {
  const select = document.getElementById('medicamento');
  if (!select) return;

  let meds = [];
  if (typeof apiGetMedicamentos === 'function') {
    meds = await apiGetMedicamentos();
  } else if (typeof getProdutos === 'function') {
    meds = getProdutos();
  }

  if (!Array.isArray(meds)) meds = [];
  medicamentosCache = meds;

  // limpa e monta opções
  select.innerHTML = `<option value="">Selecione...</option>`;

  meds
    .filter((m) => m.ativo !== false)
    .sort((a, b) =>
      String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
    )
    .forEach((m) => {
      const label = `${m.nome || 'Sem nome'}${m.miligrama ? ' ' + m.miligrama : ''}`;
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = label;
      select.appendChild(opt);
    });
}

// =============================
// REGISTRAR ENTRADA (API)
// =============================
async function registrarEntrada(e) {
  e.preventDefault();

  const medicId = Number(document.getElementById('medicamento')?.value);
  const qtd = Number(document.getElementById('quantidade')?.value);
  const validade = document.getElementById('validade')?.value || '';
  const fornecedor = document.getElementById('fornecedor')?.value || '';
  const dataEntrada = document.getElementById('dataEntrada')?.value || '';

  if (!medicId) return alert('Selecione um medicamento.');
  if (!qtd || qtd <= 0) return alert('Informe uma quantidade válida.');

  // Observação guarda detalhes extras que sua tela tem (sem mexer no model agora)
  const observacao = [
    fornecedor ? `Fornecedor: ${fornecedor}` : null,
    validade ? `Validade informada: ${validade}` : null,
    dataEntrada ? `Data entrada: ${dataEntrada}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const payload = {
    medicamento: medicId,
    tipo: 'E',
    quantidade: qtd,
    observacao: observacao || 'Entrada',
  };

  try {
    if (typeof apiCreateMovimentacao === 'function') {
      await apiCreateMovimentacao(payload);
    } else {
      // fallback localStorage (se existir)
      if (typeof addMovimentacao === 'function') {
        addMovimentacao({
          ...payload,
          id: Date.now(),
          data_movimentacao: new Date().toISOString(),
        });
      } else {
        return alert('API e fallback local não disponíveis.');
      }
    }

    alert('Entrada registrada com sucesso!');
    document.getElementById('formEntrada')?.reset();

    await carregarHistoricoEntradas();
  } catch (err) {
    console.error(err);
    alert(`Erro ao registrar entrada: ${err.message || err}`);
  }
}

// =============================
// HISTÓRICO (somente ENTRADAS)
// =============================
let historicoEntradas = [];

async function carregarHistoricoEntradas() {
  let movs = [];
  if (typeof apiGetMovimentacoes === 'function') {
    movs = await apiGetMovimentacoes();
  } else if (typeof getMovimentacoes === 'function') {
    movs = getMovimentacoes();
  }

  if (!Array.isArray(movs)) movs = [];
  historicoEntradas = movs.filter((m) => m.tipo === 'E');

  renderizarTabelaEntradas();
  atualizarKPIsEntradas();
}

function obterEntradasFiltradas() {
  const search = (document.getElementById('searchEntrada')?.value || '')
    .toLowerCase()
    .trim();

  return historicoEntradas.filter((m) => {
    const nome = String(m.medicamento_nome || '').toLowerCase();
    const obs = String(m.observacao || '').toLowerCase();
    return !search || nome.includes(search) || obs.includes(search);
  });
}

// =============================
// KPI simples (se você tiver ids)
// =============================
function atualizarKPIsEntradas() {
  const totalRegistros = historicoEntradas.length;
  const totalItens = historicoEntradas.reduce(
    (acc, m) => acc + Number(m.quantidade || 0),
    0
  );

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // Se você não tiver esses ids na tela, não dá erro (só ignora)
  set('kpiTotalEntradas', totalRegistros);
  set('kpiItensRecebidos', totalItens);
  set('kpiHoje', new Date().toLocaleDateString('pt-BR'));
}

// =============================
// TABELA
// =============================
function renderizarTabelaEntradas() {
  const tbody = document.getElementById('tabelaEntradas');
  if (!tbody) return;

  const filtradas = obterEntradasFiltradas();
  window.movEntradaFiltradas = filtradas;

  const totalPaginas = Math.ceil(filtradas.length / itensPorPagina) || 1;
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const pagina = filtradas.slice(inicio, inicio + itensPorPagina);

  tbody.innerHTML = '';

  if (pagina.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:#666">
      Nenhuma entrada encontrada
    </td></tr>`;
    renderizarPaginacaoEntradas(1);
    return;
  }

  pagina.forEach((m) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${String(m.id ?? '').padStart(4, '0')}</code></td>
      <td>${escapeHTML(m.medicamento_nome || '-')}</td>
      <td>${Number(m.quantidade || 0)}</td>
      <td>${formatarDataHora(m.data_movimentacao)}</td>
      <td>${escapeHTML(m.observacao || '-')}</td>
    `;
    tbody.appendChild(tr);
  });

  renderizarPaginacaoEntradas(totalPaginas);
}

function renderizarPaginacaoEntradas(totalPaginas) {
  const el = document.getElementById('paginationEntradas');
  if (!el) return;
  if (totalPaginas <= 1) {
    el.innerHTML = '';
    return;
  }

  let html = `<button ${paginaAtual === 1 ? 'disabled' : ''} onclick="mudarPaginaEntradas(${paginaAtual - 1})">‹</button>`;
  for (let i = 1; i <= totalPaginas; i++) {
    html += `<button class="${i === paginaAtual ? 'active' : ''}" onclick="mudarPaginaEntradas(${i})">${i}</button>`;
  }
  html += `<button ${paginaAtual === totalPaginas ? 'disabled' : ''} onclick="mudarPaginaEntradas(${paginaAtual + 1})">›</button>`;
  el.innerHTML = html;
}

window.mudarPaginaEntradas = function (p) {
  paginaAtual = p;
  renderizarTabelaEntradas();
};

function aplicarFiltros() {
  paginaAtual = 1;
  renderizarTabelaEntradas();
}

// =============================
// HELPERS
// =============================
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

function formatarDataHora(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
