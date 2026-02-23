(function () {
  // Checagem de dependências
  const depsOk =
    typeof getProdutos === 'function' &&
    typeof updateProduto === 'function' &&
    typeof addMovimentacao === 'function' &&
    typeof getMovimentacoes === 'function' &&
    typeof getProdutoById === 'function' &&
    typeof saveMovimentacoes === 'function';

  if (!depsOk) {
    console.error('❌ Storage.js não foi carregado ou funções ausentes.');
    alert(
      'Erro: Storage.js não carregou. Verifique se ele está antes do saida.js no HTML.'
    );
    return;
  }

  // Data de saída (hoje)
  const dataSaidaInput = document.getElementById('dataSaida');
  if (dataSaidaInput) dataSaidaInput.value = hojeBR();

  renderSaidas();

  const form = document.getElementById('formSaida');
  if (form) form.addEventListener('submit', onSubmitSaida);

  if (typeof lucide !== 'undefined') lucide.createIcons();
})();

function onSubmitSaida(e) {
  e.preventDefault();

  const medicamentoDigitado = getValue('medicamento');
  const quantidade = Number(getValue('quantidade'));
  const destino = getValue('destino');
  const dataSaida = document.getElementById('dataSaida')?.value || hojeBR();

  if (!medicamentoDigitado || !destino || !quantidade || quantidade <= 0) {
    alert(
      'Preencha todos os campos corretamente (quantidade deve ser maior que 0).'
    );
    return;
  }

  // Procurar produto existente
  const produtos = getProdutos().filter((p) => p.ativo !== false);

  const buscado = medicamentoDigitado.toLowerCase().trim();

  let produto = produtos.find(
    (p) => (p.nome || '').toLowerCase().trim() === buscado
  );
  if (!produto) {
    produto = produtos.find((p) =>
      (p.nome || '').toLowerCase().includes(buscado)
    );
  }

  if (!produto) {
    alert(
      'Esse medicamento não está cadastrado em PRODUTOS.\n\n' +
        'Dica: cadastre primeiro em Produtos ou digite o nome exatamente igual.'
    );
    return;
  }

  const estoqueAtual = Number(produto.stock_atual ?? 0);

  // Checar estoque
  if (quantidade > estoqueAtual) {
    alert(
      `Estoque insuficiente!\n\n` +
        `Disponível: ${estoqueAtual}\n` +
        `Você tentou retirar: ${quantidade}`
    );
    return;
  }

  // Atualiza estoque
  updateProduto(produto.id, {
    stock_atual: estoqueAtual - quantidade,
  });

  // Salva movimentação
  addMovimentacao({
    tipo: 'saida',
    produto_id: produto.id,
    medicamento: produto.nome,
    quantidade,
    destino,
    dataBR: dataSaida,
  });

  document.getElementById('formSaida')?.reset();
  const dataSaidaInput = document.getElementById('dataSaida');
  if (dataSaidaInput) dataSaidaInput.value = hojeBR();

  renderSaidas();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderSaidas() {
  const tbody = document.getElementById('tabelaSaida');
  if (!tbody) return;

  const movs = getMovimentacoes()
    .filter((m) => m.tipo === 'saida')
    .sort((a, b) => {
      const da = new Date(a.data || a.criadoEm || 0).getTime();
      const db = new Date(b.data || b.criadoEm || 0).getTime();
      return db - da;
    });

  if (movs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 16px; color: var(--gray-600);">
          Nenhuma saída registrada ainda.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = movs
    .map((m) => {
      const dataSaida = m.dataBR || formatarDataBR(m.data);

      return `
        <tr>
          <td>${escapeHtml(m.medicamento || '—')}</td>
          <td>${Number(m.quantidade ?? 0)}</td>
          <td>${escapeHtml(m.destino || '—')}</td>
          <td>${dataSaida}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="excluirSaida(${m.id})">
              <i data-lucide="trash-2"></i>
              Excluir
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function excluirSaida(movId) {
  if (
    !confirm(
      'Deseja realmente excluir esta saída? Isso também vai ajustar o estoque.'
    )
  )
    return;

  const movs = getMovimentacoes();
  const mov = movs.find((m) => m.id === movId);
  if (!mov) return;

  const produto = getProdutoById(mov.produto_id);
  if (produto) {
    const atual = Number(produto.stock_atual ?? 0);
    const qtd = Number(mov.quantidade ?? 0);
    updateProduto(produto.id, { stock_atual: atual + qtd });
  }

  const atualizados = movs.filter((m) => m.id !== movId);
  saveMovimentacoes(atualizados);

  renderSaidas();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? String(el.value).trim() : '';
}

function hojeBR() {
  return new Date().toLocaleDateString('pt-BR');
}

function formatarDataBR(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// saida.js — registra SAÍDA via /movimentacoes/ (tipo = "S")

let medicamentosCache = [];
let historicoSaidas = [];
let paginaAtual = 1;
const itensPorPagina = 10;

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacao();

  await carregarMedicamentosNoSelect();
  await carregarHistoricoSaidas();

  inicializarListeners();
  if (typeof lucide !== 'undefined') lucide.createIcons();
});

function inicializarListeners() {
  document
    .getElementById('formSaida')
    ?.addEventListener('submit', registrarSaida);
  document
    .getElementById('searchSaida')
    ?.addEventListener('input', aplicarFiltros);
}

// =============================
// SELECT MEDICAMENTOS
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
// REGISTRAR SAÍDA
// =============================
async function registrarSaida(e) {
  e.preventDefault();

  const medicId = Number(document.getElementById('medicamento')?.value);
  const qtd = Number(document.getElementById('quantidade')?.value);
  const motivo = document.getElementById('motivo')?.value?.trim() || '';
  const dataSaida = document.getElementById('dataSaida')?.value || '';

  if (!medicId) return alert('Selecione um medicamento.');
  if (!qtd || qtd <= 0) return alert('Informe uma quantidade válida.');

  const observacao = [
    motivo ? `Destino/Motivo: ${motivo}` : null,
    dataSaida ? `Data saída: ${dataSaida}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const payload = {
    medicamento: medicId,
    tipo: 'S',
    quantidade: qtd,
    observacao: observacao || 'Saída',
  };

  try {
    if (typeof apiCreateMovimentacao === 'function') {
      await apiCreateMovimentacao(payload);
    } else {
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

    alert('Saída registrada com sucesso!');
    document.getElementById('formSaida')?.reset();

    await carregarHistoricoSaidas();
  } catch (err) {
    // aqui você vai ver o erro “Estoque insuficiente” quando tentar tirar mais do que tem
    const msg = err?.message || String(err);
    console.error(err);
    alert(`Erro ao registrar saída: ${msg}`);
  }
}

// =============================
// HISTÓRICO (somente SAÍDAS)
// =============================
async function carregarHistoricoSaidas() {
  let movs = [];
  if (typeof apiGetMovimentacoes === 'function') {
    movs = await apiGetMovimentacoes();
  } else if (typeof getMovimentacoes === 'function') {
    movs = getMovimentacoes();
  }

  if (!Array.isArray(movs)) movs = [];
  historicoSaidas = movs.filter((m) => m.tipo === 'S');

  renderizarTabelaSaidas();
}

function obterSaidasFiltradas() {
  const search = (document.getElementById('searchSaida')?.value || '')
    .toLowerCase()
    .trim();

  return historicoSaidas.filter((m) => {
    const nome = String(m.medicamento_nome || '').toLowerCase();
    const obs = String(m.observacao || '').toLowerCase();
    return !search || nome.includes(search) || obs.includes(search);
  });
}

// =============================
// TABELA
// =============================
function renderizarTabelaSaidas() {
  const tbody = document.getElementById('tabelaSaidas');
  if (!tbody) return;

  const filtradas = obterSaidasFiltradas();

  const totalPaginas = Math.ceil(filtradas.length / itensPorPagina) || 1;
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const pagina = filtradas.slice(inicio, inicio + itensPorPagina);

  tbody.innerHTML = '';

  if (pagina.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:#666">
      Nenhuma saída encontrada
    </td></tr>`;
    renderizarPaginacaoSaidas(1);
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

  renderizarPaginacaoSaidas(totalPaginas);
}

function renderizarPaginacaoSaidas(totalPaginas) {
  const el = document.getElementById('paginationSaidas');
  if (!el) return;
  if (totalPaginas <= 1) {
    el.innerHTML = '';
    return;
  }

  let html = `<button ${paginaAtual === 1 ? 'disabled' : ''} onclick="mudarPaginaSaidas(${paginaAtual - 1})">‹</button>`;
  for (let i = 1; i <= totalPaginas; i++) {
    html += `<button class="${i === paginaAtual ? 'active' : ''}" onclick="mudarPaginaSaidas(${i})">${i}</button>`;
  }
  html += `<button ${paginaAtual === totalPaginas ? 'disabled' : ''} onclick="mudarPaginaSaidas(${paginaAtual + 1})">›</button>`;
  el.innerHTML = html;
}

window.mudarPaginaSaidas = function (p) {
  paginaAtual = p;
  renderizarTabelaSaidas();
};

function aplicarFiltros() {
  paginaAtual = 1;
  renderizarTabelaSaidas();
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
