const API_FORNECEDORES =
  'https://sistema-farmaceutico.onrender.com/api/fornecedores/';

let fornecedoresCache = [];
window.__fornecedorEditandoId = null;
window.__filtroFornecedorStatus = 'todos';

document.addEventListener('DOMContentLoaded', () => {
  inicializarPagina();
});

function inicializarPagina() {
  if (typeof protectPage === 'function') {
    protectPage();
  }

  preencherUsuario();
  inicializarEventos();
  carregarFornecedores();
  monitorarModoEdicao();
  criarIcones();
}

function criarIcones() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function preencherUsuario() {
  const userName = document.getElementById('userName');
  const currentUser =
    typeof getCurrentUser === 'function' ? getCurrentUser() : null;

  if (userName) {
    userName.textContent = currentUser?.nome || 'Usuário';
  }
}

function inicializarEventos() {
  const form = document.getElementById('formFornecedor');
  const busca = document.getElementById('buscaFornecedor');
  const btnLimpar = document.getElementById('btnLimpar');
  const logoutBtn = document.getElementById('logoutBtn');

  if (form) {
    form.addEventListener('submit', onSubmitFornecedor);
  }

  if (busca) {
    busca.addEventListener('input', renderFornecedores);
  }

  if (btnLimpar) {
    btnLimpar.addEventListener('click', () => {
      setTimeout(() => {
        if (!window.__fornecedorEditandoId) {
          resetFormPadrao();
        }
      }, 0);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (typeof logout === 'function') {
        logout();
        return;
      }

      localStorage.removeItem('farm_current_user');
      localStorage.removeItem('farm_session_token');
      window.location.href = 'index.html';
    });
  }

  document.querySelectorAll('.kpi-card-mini').forEach((card) => {
    card.addEventListener('click', () => {
      const jaAtivo = card.classList.contains('active');
      const filtro = card.dataset.filtro || 'todos';

      document
        .querySelectorAll('.kpi-card-mini')
        .forEach((c) => c.classList.remove('active', 'pulse'));

      if (jaAtivo) {
        window.__filtroFornecedorStatus = 'todos';
      } else {
        window.__filtroFornecedorStatus = filtro;
        card.classList.add('active');
        card.classList.add('pulse');
        setTimeout(() => card.classList.remove('pulse'), 500);
      }

      renderFornecedores();
    });
  });
}

async function carregarFornecedores() {
  try {
    const resp = await fetch(API_FORNECEDORES);
    if (!resp.ok) throw new Error('Erro ao carregar fornecedores.');

    const data = await resp.json();

    fornecedoresCache = Array.isArray(data)
      ? data.map((f) => ({
          ...f,
          ativo: f.ativo !== false,
          endereco: f.endereco || '',
        }))
      : [];

    renderFornecedores();
  } catch (err) {
    console.error(err);
    alert('Não foi possível carregar os fornecedores da API.');
  }
}

async function onSubmitFornecedor(e) {
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

  const payload = {
    nome,
    cnpj: cnpj || null,
    telefone: telefone || null,
    email: email || null,
    endereco: endereco || null,
    ativo,
  };

  try {
    const idEditando = window.__fornecedorEditandoId;

    if (idEditando) {
      const resp = await fetch(`${API_FORNECEDORES}${idEditando}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const erro = await safeJson(resp);
        console.error(erro);
        alert('Não foi possível atualizar o fornecedor.');
        return;
      }

      limparEdicao();
    } else {
      const resp = await fetch(API_FORNECEDORES, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const erro = await safeJson(resp);
        console.error(erro);
        alert('Não foi possível cadastrar o fornecedor.');
        return;
      }

      resetFormPadrao();
    }

    await carregarFornecedores();
    criarIcones();
  } catch (err) {
    console.error(err);
    alert('Erro de conexão com a API.');
  }
}

function renderFornecedores() {
  const tbody = document.getElementById('tabelaFornecedores');
  if (!tbody) return;

  const termo = (document.getElementById('buscaFornecedor')?.value || '')
    .toLowerCase()
    .trim();

  const filtroStatus = window.__filtroFornecedorStatus || 'todos';

  const fornecedores = fornecedoresCache
    .filter((f) => f)
    .map((f) => ({
      ...f,
      ativo: f.ativo === true || f.ativo === 'true' || f.ativo == null,
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
        <td colspan="6" class="empty-row">
          Nenhum fornecedor encontrado.
        </td>
      </tr>
    `;
    criarIcones();
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
            <i data-lucide="${f.ativo ? 'badge-check' : 'badge-x'}"></i>
            ${f.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn btn-outline btn-sm" type="button" onclick="editarFornecedor(${Number(
              f.id
            )})">
              <i data-lucide="pencil"></i>
              Editar
            </button>
            <button class="btn btn-danger btn-sm" type="button" onclick="excluirFornecedor(${Number(
              f.id
            )})">
              <i data-lucide="trash-2"></i>
              Excluir
            </button>
          </div>
        </td>
      </tr>
    `
    )
    .join('');

  criarIcones();
}

function atualizarKPIs(listaFiltrada) {
  const lista = Array.isArray(listaFiltrada)
    ? listaFiltrada
    : fornecedoresCache;

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
  const f = fornecedoresCache.find((x) => Number(x.id) === Number(id));
  if (!f) return;

  window.__fornecedorEditandoId = Number(id);

  setVal('nome', f.nome || '');
  setVal('cnpj', f.cnpj || '');
  setVal('telefone', f.telefone || '');
  setVal('email', f.email || '');
  setVal('endereco', f.endereco || '');

  const selAtivo = document.getElementById('ativo');
  if (selAtivo) selAtivo.value = f.ativo === true ? 'true' : 'false';

  const btnSubmit = document.getElementById('btnSubmitFornecedor');
  if (btnSubmit) {
    btnSubmit.innerHTML = `
      <i data-lucide="save"></i>
      Atualizar fornecedor
    `;
  }

  garantirBotaoCancelarEdicao();
  criarIcones();

  document.getElementById('formFornecedor')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

function garantirBotaoCancelarEdicao() {
  let btnCancelar = document.getElementById('btnCancelarEdicao');
  const wrap = document.querySelector('.form-actions-wrap');

  if (!wrap || btnCancelar) return;

  btnCancelar = document.createElement('button');
  btnCancelar.type = 'button';
  btnCancelar.id = 'btnCancelarEdicao';
  btnCancelar.className = 'btn btn-outline';
  btnCancelar.innerHTML = `
    <i data-lucide="x"></i>
    Cancelar edição
  `;

  btnCancelar.addEventListener('click', limparEdicao);
  wrap.prepend(btnCancelar);
  criarIcones();
}

function limparEdicao() {
  window.__fornecedorEditandoId = null;
  resetFormPadrao();

  const btnSubmit = document.getElementById('btnSubmitFornecedor');
  if (btnSubmit) {
    btnSubmit.innerHTML = `
      <i data-lucide="check"></i>
      Salvar fornecedor
    `;
  }

  const btnCancelar = document.getElementById('btnCancelarEdicao');
  if (btnCancelar) btnCancelar.remove();

  criarIcones();
}

function resetFormPadrao() {
  const form = document.getElementById('formFornecedor');
  if (form) form.reset();

  const ativo = document.getElementById('ativo');
  if (ativo) ativo.value = 'true';
}

async function excluirFornecedor(id) {
  if (!confirm('Deseja realmente excluir este fornecedor?')) return;

  try {
    const resp = await fetch(`${API_FORNECEDORES}${id}/`, {
      method: 'DELETE',
    });

    if (!resp.ok) {
      const erro = await safeJson(resp);
      console.error(erro);
      alert('Não foi possível excluir o fornecedor.');
      return;
    }

    if (Number(window.__fornecedorEditandoId) === Number(id)) {
      limparEdicao();
    }

    await carregarFornecedores();
    criarIcones();
  } catch (err) {
    console.error(err);
    alert('Erro de conexão com a API.');
  }
}

function monitorarModoEdicao() {
  const cardForm = document.getElementById('cardFormulario');
  const tituloForm = document.getElementById('tituloFormulario');
  const btnSubmit = document.getElementById('btnSubmitFornecedor');

  if (!btnSubmit) return;

  const observer = new MutationObserver(() => {
    const emEdicao = btnSubmit.textContent.includes('Atualizar');

    cardForm?.classList.toggle('form-editando', !!emEdicao);

    if (tituloForm) {
      tituloForm.textContent = emEdicao
        ? 'Editar fornecedor'
        : 'Cadastrar fornecedor';
    }
  });

  observer.observe(btnSubmit, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

async function safeJson(resp) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

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
