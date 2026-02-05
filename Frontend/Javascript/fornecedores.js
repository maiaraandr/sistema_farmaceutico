(function () {
  const form = document.getElementById("formFornecedor");
  const busca = document.getElementById("buscaFornecedor");

  // estado local para edição
  window.__fornecedorEditandoId = null;

  renderFornecedores();

  if (form) form.addEventListener("submit", onSubmitFornecedor);
  if (busca) busca.addEventListener("input", renderFornecedores);

  if (typeof lucide !== "undefined") lucide.createIcons();
})();

function voltarDashboard() {
  window.location.href = "dashboard.html";
}

function onSubmitFornecedor(e) {
  e.preventDefault();

  const nome = getVal("nome");
  const cnpj = getVal("cnpj");
  const telefone = getVal("telefone");
  const email = getVal("email");
  const endereco = getVal("endereco");
  const ativo = document.getElementById("ativo").value === "true";

  if (!nome) {
    alert("Informe o nome do fornecedor.");
    return;
  }

  const idEditando = window.__fornecedorEditandoId;

  if (idEditando) {
    // ATUALIZAR
    atualizarFornecedorSafe(idEditando, { nome, cnpj, telefone, email, endereco, ativo });
    limparEdicao();
  } else {
    // CRIAR
    addFornecedor({ nome, cnpj, telefone, email, endereco, ativo });
    resetFormPadrao();
  }

  renderFornecedores();
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function renderFornecedores() {
  const tbody = document.getElementById("tabelaFornecedores");
  if (!tbody) return;

  const termo = (document.getElementById("buscaFornecedor")?.value || "")
    .toLowerCase()
    .trim();

  const fornecedores = getFornecedores()
    .filter(f => f && f.ativo !== undefined)
    .filter(f => {
      if (!termo) return true;
      const nome = (f.nome || "").toLowerCase();
      const cnpj = (f.cnpj || "").toLowerCase();
      return nome.includes(termo) || cnpj.includes(termo);
    })
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

  atualizarKPIs();

  if (fornecedores.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:var(--gray-600);padding:18px;">
          Nenhum fornecedor encontrado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = fornecedores.map(f => `
    <tr>
      <td>${escapeHtml(f.nome || "—")}</td>
      <td>${escapeHtml(f.cnpj || "—")}</td>
      <td>${escapeHtml(f.telefone || "—")}</td>
      <td>${escapeHtml(f.email || "—")}</td>
      <td>
        <span class="status-pill ${f.ativo ? "ativo" : "inativo"}">
          <i data-lucide="${f.ativo ? "badge-check" : "badge-x"}" style="width:14px;height:14px;"></i>
          ${f.ativo ? "Ativo" : "Inativo"}
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
  `).join("");

  if (typeof lucide !== "undefined") lucide.createIcons();
}

function atualizarKPIs() {
  const todos = getFornecedores().filter(f => f && f.ativo !== undefined);

  const total = todos.length;
  const ativos = todos.filter(f => f.ativo === true).length;
  const inativos = todos.filter(f => f.ativo === false).length;

  const elTotal = document.getElementById("kpiTotal");
  const elAtivos = document.getElementById("kpiAtivos");
  const elInativos = document.getElementById("kpiInativos");

  if (elTotal) elTotal.textContent = total;
  if (elAtivos) elAtivos.textContent = ativos;
  if (elInativos) elInativos.textContent = inativos;
}

function editarFornecedor(id) {
  const f = getFornecedores().find(x => Number(x.id) === Number(id));
  if (!f) return;

  window.__fornecedorEditandoId = Number(id);

  setVal("nome", f.nome || "");
  setVal("cnpj", f.cnpj || "");
  setVal("telefone", f.telefone || "");
  setVal("email", f.email || "");
  setVal("endereco", f.endereco || "");
  document.getElementById("ativo").value = (f.ativo === true) ? "true" : "false";

  // muda botão principal para "Atualizar"
  const btnSubmit = document.querySelector("#formFornecedor button[type='submit']");
  if (btnSubmit) {
    btnSubmit.innerHTML = `<i data-lucide="save"></i> Atualizar fornecedor`;
    btnSubmit.classList.add("btn-primary");
  }

  // coloca um botão "Cancelar edição" se não existir
  garantirBotaoCancelarEdicao();

  if (typeof lucide !== "undefined") lucide.createIcons();

  // rola até o topo do formulário
  document.getElementById("formFornecedor")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function garantirBotaoCancelarEdicao() {
  const actionsArea = document.querySelector("#formFornecedor .col-9") || document.querySelector("#formFornecedor");
  if (!actionsArea) return;

  if (document.getElementById("btnCancelarEdicao")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "btnCancelarEdicao";
  btn.className = "btn btn-outline btn-sm";
  btn.style.marginRight = "6px";
  btn.innerHTML = `<i data-lucide="x"></i> Cancelar edição`;
  btn.addEventListener("click", () => {
    limparEdicao();
    renderFornecedores();
    if (typeof lucide !== "undefined") lucide.createIcons();
  });

  // insere antes do submit (se achar)
  const submit = document.querySelector("#formFornecedor button[type='submit']");
  if (submit && submit.parentElement) {
    submit.parentElement.insertBefore(btn, submit);
  } else {
    actionsArea.appendChild(btn);
  }
}

function limparEdicao() {
  window.__fornecedorEditandoId = null;
  resetFormPadrao();

  const btnSubmit = document.querySelector("#formFornecedor button[type='submit']");
  if (btnSubmit) {
    btnSubmit.innerHTML = `<i data-lucide="check"></i> Salvar fornecedor`;
  }

  const btnCancelar = document.getElementById("btnCancelarEdicao");
  if (btnCancelar) btnCancelar.remove();

  if (typeof lucide !== "undefined") lucide.createIcons();
}

function resetFormPadrao() {
  const form = document.getElementById("formFornecedor");
  if (form) form.reset();
  const ativo = document.getElementById("ativo");
  if (ativo) ativo.value = "true";
}

function excluirFornecedor(id) {
  if (!confirm("Deseja realmente excluir este fornecedor?")) return;
  deleteFornecedor(id);
  // se estava editando o mesmo, limpa
  if (Number(window.__fornecedorEditandoId) === Number(id)) limparEdicao();
  renderFornecedores();
}

function exportarFornecedoresCSV() {
  const fornecedores = getFornecedores();

  const header = ["id", "nome", "cnpj", "telefone", "email", "endereco", "ativo", "criadoEm"];
  const rows = fornecedores.map(f => [
    f.id, f.nome, f.cnpj, f.telefone, f.email, f.endereco, f.ativo, f.criadoEm
  ]);

  const csv = [header, ...rows]
    .map(r => r.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `fornecedores_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Atualiza fornecedor:
 * - se existir updateFornecedor(id, patch) -> usa
 * - senão tenta atualizar via Storage (localStorage) com chave "fornecedores"
 */
function atualizarFornecedorSafe(id, patch) {
  if (typeof updateFornecedor === "function") {
    updateFornecedor(id, patch);
    return;
  }

  // fallback simples: atualiza lista no localStorage (ajuste a chave se a sua for outra)
  try {
    const key = "fornecedores";
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(x => Number(x.id) === Number(id));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch };
      localStorage.setItem(key, JSON.stringify(list));
    } else {
      // se não achar, cria (evita travar)
      list.push({ id: Number(id), ...patch });
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch (err) {
    console.error(err);
    alert("Não foi possível atualizar o fornecedor. Verifique o Storage.js.");
  }
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? String(el.value).trim() : "";
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
