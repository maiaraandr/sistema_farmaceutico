(function () {
  const form = document.getElementById('formFornecedor');
  const busca = document.getElementById('buscaFornecedor');

  // estado local para edição
  window.__fornecedorEditandoId = null;
  window.__filtroFornecedorStatus = 'todos';

  // eventos
  if (form) form.addEventListener('submit', onSubmitFornecedor);
  if (busca) busca.addEventListener('input', renderFornecedores);

  // render inicial
  renderFornecedores();

  if (typeof lucide !== 'undefined') lucide.createIcons();
})();

function voltarDashboard() {
  window.location.href = 'dashboard.html';
}

function onSubmitFornecedor(e) {
  e.preventDefault();

  const nome = getVal('nome');
  const cnpj = getVal('cnpj');
  const telefone = getVal('telefone');
  const email = getVal('email');
  const endereco = getVal('endereco');
  const ativo = document.getElementById('ativo')?.value === 'true';

  if (!nome) {
    alert('Informe o nome do fornecedor.');
    return;
  }

  const idEditando = window.__fornecedorEditandoId;

  if (idEditando) {
    // ATUALIZAR
    atualizarFornecedorSafe(idEditando, {
      nome,
      cnpj,
      telefone,
      email,
      endereco,
      ativo,
      atualizadoEm: new Date().toISOString(),
    });
    limparEdicao();
  } else {
    // CRIAR
    if (typeof addFornecedor === 'function') {
      addFornecedor({ nome, cnpj, telefone, email, endereco, ativo });
    } else {
      // fallback se não existir addFornecedor
      const lista = getFornecedoresSafe();
      lista.push({
        id: Date.now(),
        nome,
        cnpj,
        telefone,
        email,
        endereco,
        ativo,
        criadoEm: new Date().toISOString(),
      });
      setFornecedoresSafe(lista);
    }
    resetFormPadrao();
  }

  renderFornecedores();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderFornecedores() {
  const tbody = document.getElementById('tabelaFornecedores');
  if (!tbody) return;

  const termo = (document.getElementById('buscaFornecedor')?.value || '')
    .toLowerCase()
    .trim();

  const filtroStatus = window.__filtroFornecedorStatus || 'todos';

  const fornecedores = getFornecedoresSafe()
    .filter((f) => f)
    .map((f) => ({
      ...f,
      ativo: f.ativo === true || f.ativo === 'true',
    }))
    .filter((f) => {
      if (filtroStatus === 'ativos') return f.ativo === true;
      if (filtroStatus === 'inativos') return f.ativo === false;
      return true;
    })
    .filter((f) => {
      if (!termo) return true;
      const nome = (f.nome || '').toLowerCase();
      const cnpj = (f.cnpj || '').toLowerCase();
      return nome.includes(termo) || cnpj.includes(termo);
    })
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  atualizarKPIs(fornecedores);

  if (fornecedores.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:var(--gray-600);padding:18px;">
          Nenhum fornecedor encontrado.
        </td>
      </tr>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  tbody.innerHTML = fornecedores
    .map(
      (f) => `
      <tr>
        <td>${escapeHtml(f.nome || '—')}</td>
        <td>${escapeHtml(f.cnpj || '—')}</td>
        <td>${escapeHtml(f.telefone || '—')}</td>
        <td>${escapeHtml(f.email || '—')}</td>
        <td>
          <span class="status-pill ${f.ativo ? 'ativo' : 'inativo'}">
            <i data-lucide="${f.ativo ? 'badge-check' : 'badge-x'}" style="width:14px;height:14px;"></i>
            ${f.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" type="button" onclick="editarFornecedor(${Number(f.id)})">
              <i data-lucide="pencil"></i> Editar
            </button>
            <button class="btn btn-danger btn-sm" type="button" onclick="excluirFornecedor(${Number(f.id)})">
              <i data-lucide="trash-2"></i> Excluir
            </button>
          </div>
        </td>
      </tr>
    `
    )
    .join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function atualizarKPIs(listaFiltrada) {
  const lista = Array.isArray(listaFiltrada)
    ? listaFiltrada
    : getFornecedoresSafe();

  const total = lista.length;
  const ativos = lista.filter((f) => f.ativo === true).length;
  const inativos = lista.filter((f) => f.ativo === false).length;

  const elTotal = document.getElementById('kpiTotal');
  const elAtivos = document.getElementById('kpiAtivos');
  const elInativos = document.getElementById('kpiInativos');

  if (elTotal) elTotal.textContent = total;
  if (elAtivos) elAtivos.textContent = ativos;
  if (elInativos) elInativos.textContent = inativos;
}

function editarFornecedor(id) {
  const f = getFornecedoresSafe().find((x) => Number(x.id) === Number(id));
  if (!f) return;

  window.__fornecedorEditandoId = Number(id);

  setVal('nome', f.nome || '');
  setVal('cnpj', f.cnpj || '');
  setVal('telefone', f.telefone || '');
  setVal('email', f.email || '');
  setVal('endereco', f.endereco || '');

  const selAtivo = document.getElementById('ativo');
  if (selAtivo) selAtivo.value = f.ativo === true ? 'true' : 'false';

  // muda botão principal para "Atualizar"
  const btnSubmit = document.querySelector(
    "#formFornecedor button[type='submit']"
  );
  if (btnSubmit)
    btnSubmit.innerHTML = `<i data-lucide="save"></i> Atualizar fornecedor`;

  // coloca um botão "Cancelar edição" se não existir
  garantirBotaoCancelarEdicao();

  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('formFornecedor')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

function garantirBotaoCancelarEdicao() {
  if (document.getElementById('btnCancelarEdicao')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'btnCancelarEdicao';
  btn.className = 'btn btn-outline btn-sm';
  btn.innerHTML = `<i data-lucide="x"></i> Cancelar edição`;

  btn.addEventListener('click', () => {
    limparEdicao();
    renderFornecedores();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  const submit = document.querySelector(
    "#formFornecedor button[type='submit']"
  );
  if (submit?.parentElement) submit.parentElement.insertBefore(btn, submit);
  else document.getElementById('formFornecedor')?.appendChild(btn);
}

function limparEdicao() {
  window.__fornecedorEditandoId = null;
  resetFormPadrao();

  const btnSubmit = document.querySelector(
    "#formFornecedor button[type='submit']"
  );
  if (btnSubmit)
    btnSubmit.innerHTML = `<i data-lucide="check"></i> Salvar fornecedor`;

  const btnCancelar = document.getElementById('btnCancelarEdicao');
  if (btnCancelar) btnCancelar.remove();

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function resetFormPadrao() {
  const form = document.getElementById('formFornecedor');
  if (form) form.reset();

  const ativo = document.getElementById('ativo');
  if (ativo) ativo.value = 'true';
}

function excluirFornecedor(id) {
  if (!confirm('Deseja realmente excluir este fornecedor?')) return;

  if (typeof deleteFornecedor === 'function') {
    deleteFornecedor(id);
  } else {
    const lista = getFornecedoresSafe().filter(
      (x) => Number(x.id) !== Number(id)
    );
    setFornecedoresSafe(lista);
  }

  if (Number(window.__fornecedorEditandoId) === Number(id)) limparEdicao();
  renderFornecedores();

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function exportarFornecedoresCSV() {
  const fornecedores = getFornecedoresSafe();

  const header = [
    'id',
    'nome',
    'cnpj',
    'telefone',
    'email',
    'endereco',
    'ativo',
    'criadoEm',
    'atualizadoEm',
  ];
  const rows = fornecedores.map((f) => [
    f.id,
    f.nome,
    f.cnpj,
    f.telefone,
    f.email,
    f.endereco,
    f.ativo,
    f.criadoEm,
    f.atualizadoEm,
  ]);

  const csv = [header, ...rows]
    .map((r) =>
      r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')
    )
    .join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `fornecedores_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Atualiza fornecedor:
 */
function atualizarFornecedorSafe(id, patch) {
  if (typeof updateFornecedor === 'function') {
    updateFornecedor(id, patch);
    return;
  }

  try {
    const list = getFornecedoresSafe();
    const idx = list.findIndex((x) => Number(x.id) === Number(id));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch };
    } else {
      list.push({ id: Number(id), ...patch });
    }
    setFornecedoresSafe(list);
  } catch (err) {
    console.error(err);
    alert('Não foi possível atualizar o fornecedor. Verifique o Storage.js.');
  }
}

/* ============================
   HELPERS SAFE (Storage)
   ============================ */
function getFornecedoresSafe() {
  if (typeof getFornecedores === 'function') {
    const x = getFornecedores();
    return Array.isArray(x) ? x : [];
  }
  try {
    const raw = localStorage.getItem('farm_fornecedores');
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function setFornecedoresSafe(lista) {
  try {
    localStorage.setItem(
      'farm_fornecedores',
      JSON.stringify(Array.isArray(lista) ? lista : [])
    );
  } catch (err) {
    console.error(err);
  }
}

/* ============================
   HELPERS UI
   ============================ */
function getVal(id) {
  const el = document.getElementById(id);
  return el ? String(el.value).trim() : '';
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
