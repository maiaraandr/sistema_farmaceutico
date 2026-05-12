const API_MEDICAMENTOS = 'https://gestmed.onrender.com/api/medicamentos/';
const API_FORNECEDORES = 'https://gestmed.onrender.com/api/fornecedores/';
const API_MOVIMENTACOES = 'https://gestmed.onrender.com/api/movimentacoes/';

let medicamentosCache = [];
let fornecedoresCache = [];
let historicoEntradas = [];
let paginaAtual = 1;
const itensPorPagina = 10;
let movimentacaoEmEdicao = null;
let entradaExcluindo = null;

document.addEventListener('DOMContentLoaded', async () => {
  verificarAutenticacao();
  preencherUsuario();
  inicializarLogout();
  ajustarCampoData();
  inicializarListeners();

  await carregarFornecedores();
  await carregarMedicamentos();
  await carregarHistoricoEntradas();

  atualizarKPIHoje();
  criarIcones();
});

function criarIcones() {
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function inicializarListeners() {
  document
    .getElementById('formEntrada')
    ?.addEventListener('submit', registrarEntrada);

  document
    .getElementById('searchEntrada')
    ?.addEventListener('input', aplicarFiltros);

  document
    .getElementById('btnLimparEntrada')
    ?.addEventListener('click', function () {
      setTimeout(ajustarCampoData, 0);
    });

  document
    .getElementById('modalEdicaoClose')
    ?.addEventListener('click', fecharModalEdicao);
  document
    .getElementById('modalEdicaoOverlay')
    ?.addEventListener('click', fecharModalEdicao);
  document
    .getElementById('btnCancelarEdicao')
    ?.addEventListener('click', fecharModalEdicao);
  document
    .getElementById('btnSalvarEdicao')
    ?.addEventListener('click', salvarEdicaoEntrada);

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
    ?.addEventListener('click', confirmarExclusao);
}

function inicializarLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', function () {
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
  var el = document.getElementById('userName');
  var currentUser =
    typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (el)
    el.textContent =
      currentUser && currentUser.nome ? currentUser.nome : 'Usuario';
}

function ajustarCampoData() {
  var input = document.getElementById('dataEntrada');
  if (!input) return;
  var hoje = new Date().toISOString().split('T')[0];
  input.max = hoje;
  if (!input.value) input.value = hoje;
}

function atualizarKPIHoje() {
  var el = document.getElementById('kpiHoje');
  if (el) el.textContent = new Date().toLocaleDateString('pt-BR');
}

// ── CARREGAR DADOS ──

async function carregarFornecedores() {
  try {
    var resp = await fetch(API_FORNECEDORES);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    fornecedoresCache = Array.isArray(data) ? data : [];
    preencherSelectFornecedores('fornecedor');
  } catch (err) {
    console.error('Erro fornecedores:', err);
    var sel = document.getElementById('fornecedor');
    if (sel)
      sel.innerHTML = '<option value="">Erro ao carregar fornecedores</option>';
  }
}

function preencherSelectFornecedores(selectId, selecionadoNome) {
  var select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">Selecione...</option>';
  fornecedoresCache
    .filter(function (f) {
      return f.ativo !== false;
    })
    .sort(function (a, b) {
      return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    })
    .forEach(function (f) {
      var opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.nome || 'Fornecedor';
      if (
        selecionadoNome &&
        String(f.nome).trim() === String(selecionadoNome).trim()
      ) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
}

async function carregarMedicamentos() {
  try {
    var resp = await fetch(API_MEDICAMENTOS);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    medicamentosCache = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Erro medicamentos:', err);
    medicamentosCache = [];
  }
}

async function carregarHistoricoEntradas() {
  try {
    var resp = await fetch(API_MOVIMENTACOES);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    historicoEntradas = Array.isArray(data)
      ? data.filter(function (m) {
          return m.tipo === 'E';
        })
      : [];
    renderizarTabelaEntradas();
    atualizarKPIsEntradas();
  } catch (err) {
    console.error('Erro historico:', err);
    alert('Nao foi possivel carregar o historico de entradas.');
  }
}

// ── REGISTRAR ENTRADA ──

async function registrarEntrada(event) {
  event.preventDefault();

  var nome = getValue('nomeMedicamento');
  var miligrama = getValue('miligrama');
  var categoria = getValue('categoria');
  var lote = getValue('lote');
  var quantidade = Number(getValue('quantidade'));
  var valorUnitario = Number(getValue('valorUnitario'));
  var validade = getValue('validade');
  var fornecedorId = Number(getValue('fornecedor'));
  var fornecedorNome = getTextoSelecionado('fornecedor');
  var dataEntrada = getValue('dataEntrada');

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
    alert('Informe uma quantidade valida.');
    return;
  }
  if (valorUnitario < 0 || isNaN(valorUnitario)) {
    alert('Informe um valor unitario valido.');
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
    var existente = encontrarMedicamentoExistente(nome, lote, miligrama);
    var salvo;
    if (existente) {
      salvo = await atualizarMedicamentoExistente(existente, {
        nome: nome,
        miligrama: miligrama,
        categoria: categoria,
        lote: lote,
        validade: validade,
        quantidade: quantidade,
        valorUnitario: valorUnitario,
        fornecedorId: fornecedorId,
      });
    } else {
      salvo = await criarMedicamento({
        nome: nome,
        miligrama: miligrama,
        categoria: categoria,
        lote: lote,
        validade: validade,
        quantidade: quantidade,
        valorUnitario: valorUnitario,
        fornecedorId: fornecedorId,
      });
    }

    await registrarMovimentacaoEntrada({
      medicamentoId: salvo.id,
      quantidade: quantidade,
      fornecedorNome: fornecedorNome,
      categoria: categoria,
      lote: lote,
      validade: validade,
      valorUnitario: valorUnitario,
      dataEntrada: dataEntrada,
    });

    alert('Entrada registrada com sucesso.');
    document.getElementById('formEntrada').reset();
    ajustarCampoData();
    await carregarMedicamentos();
    await carregarHistoricoEntradas();
  } catch (err) {
    console.error('Erro registrar entrada:', err);
    alert('Nao foi possivel registrar a entrada.');
  }
}

function encontrarMedicamentoExistente(nome, lote, miligrama) {
  var n = norm(nome),
    l = norm(lote),
    m = norm(miligrama);
  return medicamentosCache.find(function (med) {
    return (
      norm(med.nome) === n && norm(med.lote) === l && norm(med.miligrama) === m
    );
  });
}

async function criarMedicamento(d) {
  var resp = await fetch(API_MEDICAMENTOS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: d.nome,
      miligrama: d.miligrama || null,
      categoria: d.categoria,
      lote: d.lote,
      validade: d.validade,
      quantidade: d.quantidade,
      valor_unit: d.valorUnitario,
      fornecedor: d.fornecedorId,
    }),
  });
  if (!resp.ok) throw new Error('Erro ao criar medicamento.');
  return resp.json();
}

async function atualizarMedicamentoExistente(med, d) {
  var novaQtd = Number(med.quantidade || 0) + Number(d.quantidade || 0);
  var resp = await fetch(API_MEDICAMENTOS + med.id + '/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: d.nome,
      miligrama: d.miligrama || null,
      categoria: d.categoria,
      lote: d.lote,
      validade: d.validade,
      quantidade: novaQtd,
      valor_unit: d.valorUnitario,
      descricao: med.descricao || '',
      fornecedor: d.fornecedorId,
    }),
  });
  if (!resp.ok) throw new Error('Erro ao atualizar medicamento.');
  return resp.json();
}

async function registrarMovimentacaoEntrada(d) {
  var obs = [
    'Fornecedor: ' + d.fornecedorNome,
    'Categoria: ' + d.categoria,
    'Lote: ' + d.lote,
    'Validade informada: ' + d.validade,
    'Valor unitario: ' + d.valorUnitario,
    'Data da entrada: ' + d.dataEntrada,
  ].join(' | ');

  var resp = await fetch(API_MOVIMENTACOES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medicamento: d.medicamentoId,
      tipo: 'E',
      quantidade: d.quantidade,
      observacao: obs,
    }),
  });
  if (!resp.ok) throw new Error('Erro ao registrar movimentacao.');
  return resp.json();
}

// ── EDITAR ──

window.abrirModalEdicao = function (movimentacaoId) {
  var id = Number(movimentacaoId);
  var mov = null;
  for (var i = 0; i < historicoEntradas.length; i++) {
    if (Number(historicoEntradas[i].id) === id) {
      mov = historicoEntradas[i];
      break;
    }
  }
  if (!mov) {
    alert('Entrada nao encontrada.');
    return;
  }

  movimentacaoEmEdicao = mov;

  var fornecedorNome = extrair(mov.observacao, 'Fornecedor:');
  var categoria = extrair(mov.observacao, 'Categoria:');
  var lote = extrair(mov.observacao, 'Lote:');
  var validadeObs = extrair(mov.observacao, 'Validade informada:');
  var valorUnitario = extrair(mov.observacao, 'Valor unitario:');

  if (!valorUnitario)
    valorUnitario = extrair(mov.observacao, 'Valor unit\u00e1rio:');

  var med = null;
  for (var j = 0; j < medicamentosCache.length; j++) {
    if (Number(medicamentosCache[j].id) === Number(mov.medicamento)) {
      med = medicamentosCache[j];
      break;
    }
  }

  setVal('editNome', med ? med.nome : mov.medicamento_nome || '');
  setVal('editDosagem', med ? med.miligrama || '' : '');
  setVal('editLote', lote || (med ? med.lote || '' : ''));
  setVal('editQuantidade', String(mov.quantidade || ''));
  setVal(
    'editValorUnitario',
    valorUnitario || (med ? String(med.valor_unit || '') : '')
  );
  setVal(
    'editValidade',
    toInputDate(validadeObs || (med ? med.validade || '' : ''))
  );

  var selCat = document.getElementById('editCategoria');
  if (selCat) selCat.value = categoria || (med ? med.categoria || '' : '');

  preencherSelectFornecedores('editFornecedor', fornecedorNome);

  document.getElementById('modalEdicaoEntrada').classList.add('active');
  criarIcones();

  document.body.style.overflow = 'hidden';
};

function fecharModalEdicao() {
  document.getElementById('modalEdicaoEntrada').classList.remove('active');
  document.body.style.overflow = 'auto';
  movimentacaoEmEdicao = null;
}

async function salvarEdicaoEntrada() {
  if (!movimentacaoEmEdicao) return;

  var nome = getValue('editNome');
  var miligrama = getValue('editDosagem');
  var categoria = getValue('editCategoria');
  var lote = getValue('editLote');
  var quantidade = Number(getValue('editQuantidade'));
  var valorUnitario = Number(getValue('editValorUnitario'));
  var validade = getValue('editValidade');
  var selForn = document.getElementById('editFornecedor');
  var fornecedorId = Number(selForn ? selForn.value : 0);
  var fornecedorNome =
    selForn && selForn.selectedIndex >= 0
      ? selForn.options[selForn.selectedIndex].text
      : '';

  if (!nome || !lote || !quantidade || !validade || !fornecedorId) {
    alert('Preencha todos os campos obrigatorios.');
    return;
  }

  var med = null;
  for (var i = 0; i < medicamentosCache.length; i++) {
    if (
      Number(medicamentosCache[i].id) ===
      Number(movimentacaoEmEdicao.medicamento)
    ) {
      med = medicamentosCache[i];
      break;
    }
  }

  if (!med) {
    alert('Medicamento nao encontrado no cache.');
    return;
  }

  var qtdAnterior = Number(movimentacaoEmEdicao.quantidade || 0);
  var estoqueAtual = Number(med.quantidade || 0);
  var novoEstoque = estoqueAtual - qtdAnterior + quantidade;
  var dataEntradaOriginal = extrair(
    movimentacaoEmEdicao.observacao,
    'Data da entrada:'
  );
  var fornecedorIdMed =
    typeof med.fornecedor === 'object' ? med.fornecedor.id : med.fornecedor;

  try {
    var respMed = await fetch(API_MEDICAMENTOS + med.id + '/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: nome,
        miligrama: miligrama || null,
        categoria: categoria,
        lote: lote,
        validade: validade,
        quantidade: novoEstoque,
        valor_unit: valorUnitario,
        descricao: med.descricao || '',
        fornecedor: fornecedorId,
      }),
    });

    if (!respMed.ok) {
      var errMed = await respMed.json().catch(function () {
        return {};
      });
      console.error('Erro PUT medicamento:', errMed);
      alert('Erro ao atualizar medicamento: ' + JSON.stringify(errMed));
      return;
    }

    var novaObs = [
      'Fornecedor: ' + fornecedorNome,
      'Categoria: ' + categoria,
      'Lote: ' + lote,
      'Validade informada: ' + validade,
      'Valor unitario: ' + valorUnitario,
      'Data da entrada: ' + dataEntradaOriginal,
    ].join(' | ');

    var respMov = await fetch(
      API_MOVIMENTACOES + movimentacaoEmEdicao.id + '/',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicamento: Number(movimentacaoEmEdicao.medicamento),
          tipo: 'E',
          quantidade: quantidade,
          observacao: novaObs,
        }),
      }
    );

    if (!respMov.ok) {
      var errMov = await respMov.json().catch(function () {
        return {};
      });
      console.error('Erro PUT movimentacao:', errMov);
      alert('Erro ao atualizar movimentacao: ' + JSON.stringify(errMov));
      return;
    }

    fecharModalEdicao();
    await carregarMedicamentos();
    await carregarHistoricoEntradas();
    alert('Entrada atualizada com sucesso.');
  } catch (err) {
    console.error('Erro salvar edicao:', err);
    alert('Erro de conexao: ' + err.message);
  }
}

window.abrirModalExcluir = function (movimentacaoId) {
  var id = Number(movimentacaoId);
  var mov = null;
  for (var i = 0; i < historicoEntradas.length; i++) {
    if (Number(historicoEntradas[i].id) === id) {
      mov = historicoEntradas[i];
      break;
    }
  }
  if (!mov) {
    alert('Entrada nao encontrada.');
    return;
  }

  entradaExcluindo = mov;

  var nomeEl = document.getElementById('nomeEntradaExcluir');
  if (nomeEl) nomeEl.textContent = mov.medicamento_nome || 'Medicamento';

  document.getElementById('modalExcluirEntrada').classList.add('active');
  criarIcones();
};

function fecharModalExcluir() {
  document.getElementById('modalExcluirEntrada').classList.remove('active');
  entradaExcluindo = null;
}
async function confirmarExclusao() {
  if (!entradaExcluindo) return;

  try {
    const respMov = await fetch(API_MOVIMENTACOES + entradaExcluindo.id + '/', {
      method: 'DELETE',
    });

    if (!respMov.ok) {
      alert('Erro ao excluir movimentação.');
      return;
    }

    const med = medicamentosCache.find(
      (m) => Number(m.id) === Number(entradaExcluindo.medicamento)
    );

    if (med) {
      const respMed = await fetch(API_MEDICAMENTOS + med.id + '/', {
        method: 'DELETE',
      });

      if (!respMed.ok) {
        alert('Erro ao excluir medicamento.');
        return;
      }
    }

    fecharModalExcluir();

    await carregarMedicamentos();
    await carregarHistoricoEntradas();

    alert('Medicamento excluído permanentemente.');
  } catch (err) {
    console.error(err);
    alert('Erro ao excluir.');
  }
}

function aplicarFiltros() {
  paginaAtual = 1;
  renderizarTabelaEntradas();
}

function atualizarKPIsEntradas() {
  setText('kpiTotalEntradas', historicoEntradas.length);
  var total = 0;
  historicoEntradas.forEach(function (m) {
    total += Number(m.quantidade || 0);
  });
  setText('kpiTotalItens', total);
}

function renderizarTabelaEntradas() {
  var tbody = document.getElementById('tabelaEntrada');
  if (!tbody) return;

  var termo = (
    document.getElementById('searchEntrada')
      ? document.getElementById('searchEntrada').value
      : ''
  )
    .toLowerCase()
    .trim();

  var filtradas = historicoEntradas.filter(function (m) {
    if (!termo) return true;
    return (
      String(m.medicamento_nome || '')
        .toLowerCase()
        .indexOf(termo) >= 0 ||
      String(m.observacao || '')
        .toLowerCase()
        .indexOf(termo) >= 0
    );
  });

  var totalPaginas = Math.ceil(filtradas.length / itensPorPagina) || 1;
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  var inicio = (paginaAtual - 1) * itensPorPagina;
  var pagina = filtradas.slice(inicio, inicio + itensPorPagina);

  tbody.innerHTML = '';

  if (pagina.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="10" class="empty-row">Nenhuma entrada registrada ainda.</td></tr>';
    renderizarPaginacao(totalPaginas);
    return;
  }

  pagina.forEach(function (m) {
    var fornecedor = extrair(m.observacao, 'Fornecedor:');
    var categoria = extrair(m.observacao, 'Categoria:');
    var validade = extrair(m.observacao, 'Validade informada:');
    var valorUnitario = extrair(m.observacao, 'Valor unitario:');
    if (!valorUnitario)
      valorUnitario = extrair(m.observacao, 'Valor unit\u00e1rio:');
    var dataEntrada = extrair(m.observacao, 'Data da entrada:');

    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><code>' +
      String(m.medicamento || '').padStart(4, '0') +
      '</code></td>' +
      '<td>' +
      esc(m.medicamento_nome || '\u2014') +
      '</td>' +
      '<td><span class="badge badge-info">' +
      esc(categoria || '\u2014') +
      '</span></td>' +
      '<td>' +
      Number(m.quantidade || 0) +
      '</td>' +
      '<td>' +
      fmtMoeda(valorUnitario) +
      '</td>' +
      '<td>' +
      (validade ? fmtDataBR(validade) : '\u2014') +
      '</td>' +
      '<td>' +
      esc(fornecedor || '\u2014') +
      '</td>' +
      '<td>' +
      (dataEntrada
        ? fmtDataBR(dataEntrada)
        : fmtDataHora(m.data_movimentacao)) +
      '</td>' +
      '<td><span class="badge badge-success">Registrada</span></td>' +
      '<td>' +
      '<div class="table-actions">' +
      '<button class="btn btn-outline btn-sm" type="button" onclick="abrirModalEdicao(' +
      m.id +
      ')">' +
      '<i data-lucide="pencil"></i> Editar' +
      '</button>' +
      '<button class="btn btn-danger btn-sm" type="button" onclick="abrirModalExcluir(' +
      m.id +
      ')">' +
      '<i data-lucide="trash-2"></i> Excluir' +
      '</button>' +
      '</div>' +
      '</td>';
    tbody.appendChild(tr);
  });

  renderizarPaginacao(totalPaginas);
  criarIcones();
}

function renderizarPaginacao(totalPaginas) {
  var el = document.getElementById('paginationEntrada');
  if (!el) return;
  if (totalPaginas <= 1) {
    el.innerHTML = '';
    return;
  }

  var html =
    '<button class="pagination-btn" ' +
    (paginaAtual === 1 ? 'disabled' : '') +
    ' onclick="mudarPaginaEntrada(' +
    (paginaAtual - 1) +
    ')" type="button">\u2039</button>';
  for (var i = 1; i <= totalPaginas; i++) {
    html +=
      '<button class="pagination-btn ' +
      (i === paginaAtual ? 'active' : '') +
      '" onclick="mudarPaginaEntrada(' +
      i +
      ')" type="button">' +
      i +
      '</button>';
  }
  html +=
    '<button class="pagination-btn" ' +
    (paginaAtual === totalPaginas ? 'disabled' : '') +
    ' onclick="mudarPaginaEntrada(' +
    (paginaAtual + 1) +
    ')" type="button">\u203a</button>';
  el.innerHTML = html;
}

window.mudarPaginaEntrada = function (p) {
  paginaAtual = p;
  renderizarTabelaEntradas();
};

function extrair(obs, prefixo) {
  if (!obs) return '';
  var partes = String(obs).split('|');
  for (var i = 0; i < partes.length; i++) {
    var p = partes[i].trim();
    if (p.indexOf(prefixo) === 0) return p.slice(prefixo.length).trim();
  }
  return '';
}

function toInputDate(valor) {
  if (!valor) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
    var parts = valor.split('/');
    return parts[2] + '-' + parts[1] + '-' + parts[0];
  }
  return valor;
}

function getValue(id) {
  var el = document.getElementById(id);
  return el ? String(el.value).trim() : '';
}

function setVal(id, val) {
  var el = document.getElementById(id);
  if (el) el.value = val;
}

function getTextoSelecionado(id) {
  var sel = document.getElementById(id);
  if (!sel || sel.selectedIndex < 0) return '';
  return sel.options[sel.selectedIndex]
    ? sel.options[sel.selectedIndex].text
    : '';
}

function setText(id, valor) {
  var el = document.getElementById(id);
  if (el) el.textContent = valor;
}

function norm(v) {
  return String(v || '')
    .trim()
    .toLowerCase();
}

function fmtDataBR(s) {
  if (!s) return '\u2014';
  var str = String(s);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    var p = str.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  var dt = new Date(s);
  return isNaN(dt.getTime()) ? str : dt.toLocaleDateString('pt-BR');
}

function fmtDataHora(iso) {
  if (!iso) return '\u2014';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return (
    d.toLocaleDateString('pt-BR') +
    ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
}

function fmtMoeda(v) {
  var n = Number(v);
  if (isNaN(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function verificarAutenticacao() {
  var u = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!u) window.location.href = '../html/index.html';
}
