/**
 * ==========================================
 * GERENCIAMENTO DE MEDICAMENTOS (INTEGRADO)
 * ==========================================
 * Depende de: Storage.js + autenticacao.js (getCurrentUser)
 *
 * Padrão salvo no storage (compatível com dashboard.js):
 *  - preco
 *  - stock_atual
 *  - stock_minimo
 *  - vencimento
 *  - ativo
 */

// Estado
let produtos = [];
let produtoEditando = null;
let produtoExcluindo = null;

let paginaAtual = 1;
const itensPorPagina = 10;

// Expor lista filtrada (export/KPIs)
window.produtosFiltrados = [];

// ==========================================
// INIT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  verificarAutenticacao();

  carregarProdutos();
  renderizarTabela();
  inicializarEventListeners();

  if (typeof lucide !== "undefined") lucide.createIcons();
});

// ==========================================
// STORAGE (usa o Storage.js)
// ==========================================
function carregarProdutos() {
  // Puxa do Storage.js
  produtos = (typeof getProdutos === "function" ? getProdutos() : []).filter((p) => p.ativo !== false);

  // Se não tiver nada, deixa o sample do Storage.js cuidar (initializeSampleData)
  // Só garante que a tabela não quebra
  if (!Array.isArray(produtos)) produtos = [];
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function inicializarEventListeners() {
  document.getElementById("btnNovoProduto")?.addEventListener("click", abrirModalNovo);

  document.getElementById("btnExportarCSV")?.addEventListener("click", () => {
    exportarCSV(window.produtosFiltrados || []);
  });

  // Modal - fechar
  document.getElementById("modalClose")?.addEventListener("click", fecharModal);
  document.getElementById("modalOverlay")?.addEventListener("click", fecharModal);
  document.getElementById("btnCancelar")?.addEventListener("click", fecharModal);

  // Form submit
  document.getElementById("formProduto")?.addEventListener("submit", salvarProduto);

  // Busca / filtros
  document.getElementById("searchInput")?.addEventListener("input", aplicarFiltros);
  document.getElementById("filterCategoria")?.addEventListener("change", aplicarFiltros);
  document.getElementById("filterEstoque")?.addEventListener("change", aplicarFiltros);

  // Modal excluir
  document.getElementById("modalExcluirClose")?.addEventListener("click", fecharModalExcluir);
  document.getElementById("modalExcluirOverlay")?.addEventListener("click", fecharModalExcluir);
  document.getElementById("btnCancelarExcluir")?.addEventListener("click", fecharModalExcluir);

  // Confirmar excluir (soft delete)
  document.getElementById("btnConfirmarExcluir")?.addEventListener("click", () => {
    if (!produtoExcluindo) return;

    // Soft delete (compatível com Storage.js + dashboard)
    if (typeof updateProduto === "function") {
      updateProduto(produtoExcluindo.id, { ativo: false, atualizadoEm: new Date().toISOString() });
    } else {
      // fallback (não deveria acontecer se Storage.js estiver carregado)
      produtos = produtos.map((p) => (p.id === produtoExcluindo.id ? { ...p, ativo: false } : p));
      localStorage.setItem("farm_produtos", JSON.stringify(produtos));
    }

    // Recarrega e renderiza
    carregarProdutos();

    // Ajuste de pagina
    const total = obterProdutosFiltrados().length;
    if ((paginaAtual - 1) * itensPorPagina >= total && paginaAtual > 1) paginaAtual--;

    renderizarTabela();
    fecharModalExcluir();

    alert("Medicamento excluído com sucesso!");
  });
}

// ==========================================
// FILTROS (agora com campos do padrão certo)
// ==========================================
function obterProdutosFiltrados() {
  const search = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
  const filterCategoria = document.getElementById("filterCategoria")?.value || "";
  const filterEstoque = document.getElementById("filterEstoque")?.value || "";

  // sempre trabalha com a lista atual em memória
  return produtos.filter((p) => {
    const nome = (p.nome || "").toLowerCase();
    const categoria = (p.categoria || "").toLowerCase();
    const principioAtivo = (p.principioAtivo || "").toLowerCase();
    const sku = (p.sku || "").toLowerCase();

    const matchSearch =
      nome.includes(search) ||
      categoria.includes(search) ||
      principioAtivo.includes(search) ||
      sku.includes(search);

    const matchCategoria = !filterCategoria || p.categoria === filterCategoria;

    let matchEstoque = true;
    const atual = Number(p.stock_atual ?? 0);
    const minimo = Number(p.stock_minimo ?? 0);

    if (filterEstoque === "baixo") {
      matchEstoque = atual < minimo;
    } else if (filterEstoque === "ok") {
      matchEstoque = atual >= minimo;
    } else if (filterEstoque === "vencendo") {
      const dias = calcularDiasParaVencer(p.vencimento);
      matchEstoque = dias <= 90 && dias > 0;
    }

    return matchSearch && matchCategoria && matchEstoque;
  });
}

// ==========================================
// KPIs (compatível com dashboard)
// ==========================================
function atualizarKPIs(lista) {
  const elTotal = document.getElementById("kpiTotal");
  const elBaixo = document.getElementById("kpiBaixo");
  const elVencendo = document.getElementById("kpiVencendo");
  const elValor = document.getElementById("kpiValor");

  if (!elTotal && !elBaixo && !elVencendo && !elValor) return;

  const total = lista.length;

  const baixo = lista.filter((m) => Number(m.stock_atual ?? 0) < Number(m.stock_minimo ?? 0)).length;

  // vencendo = até 30 dias
  const vencendo = lista.filter((m) => {
    const dias = calcularDiasParaVencer(m.vencimento);
    return dias > 0 && dias <= 30;
  }).length;

  const valor = lista.reduce((acc, m) => {
    const q = Number(m.stock_atual ?? 0);
    const vu = Number(m.preco ?? 0);
    return acc + q * vu;
  }, 0);

  if (elTotal) elTotal.textContent = total;
  if (elBaixo) elBaixo.textContent = baixo;
  if (elVencendo) elVencendo.textContent = vencendo;
  if (elValor) elValor.textContent = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ==========================================
// RENDER
// ==========================================
function renderizarTabela() {
  const tbody = document.getElementById("tabelaProdutos");
  if (!tbody) return;

  const filtrados = obterProdutosFiltrados();
  window.produtosFiltrados = filtrados;

  atualizarKPIs(filtrados);

  const totalPaginas = Math.ceil(filtrados.length / itensPorPagina) || 1;
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const fim = inicio + itensPorPagina;
  const produtosPagina = filtrados.slice(inicio, fim);

  tbody.innerHTML = "";

  if (produtosPagina.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;padding:40px;color:var(--gray-500);">
          <i data-lucide="inbox" style="width:48px;height:48px;margin-bottom:10px;"></i>
          <p>Nenhum medicamento encontrado</p>
        </td>
      </tr>
    `;
    renderizarPaginacao(1);
    if (typeof lucide !== "undefined") lucide.createIcons();
    return;
  }

  produtosPagina.forEach((produto) => {
    const tr = document.createElement("tr");

    const status = getStatusProduto(produto);
    const diasParaVencer = calcularDiasParaVencer(produto.vencimento);

    tr.innerHTML = `
      <td><code>${String(produto.id).padStart(4, "0")}</code></td>
      <td>
        <strong>${escapeHTML(produto.nome)}</strong>
        ${produto.principioAtivo ? `<br><small style="color: var(--gray-500);">${escapeHTML(produto.principioAtivo)}</small>` : ""}
      </td>
      <td><span class="badge badge-info">${escapeHTML(produto.categoria || "-")}</span></td>
      <td>${Number(produto.stock_atual ?? 0)} ${escapeHTML(produto.unidade || "un")}</td>
      <td>${Number(produto.stock_minimo ?? 0)} ${escapeHTML(produto.unidade || "un")}</td>
      <td>R$ ${Number(produto.preco ?? 0).toFixed(2)}</td>
      <td>
        ${formatarData(produto.vencimento)}
        ${
          diasParaVencer <= 90 && diasParaVencer > 0
            ? `<br><small style="color:#f59e0b;">${diasParaVencer} dias</small>`
            : ""
        }
      </td>
      <td>${renderizarBadgeStatus(status)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon btn-icon-primary" onclick="editarProduto(${produto.id})" title="Editar">
            <i data-lucide="edit"></i>
          </button>
          <button class="btn-icon btn-icon-danger" onclick="confirmarExclusao(${produto.id})" title="Excluir">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  renderizarPaginacao(totalPaginas);
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function getStatusProduto(produto) {
  const diasParaVencer = calcularDiasParaVencer(produto.vencimento);
  const atual = Number(produto.stock_atual ?? 0);
  const minimo = Number(produto.stock_minimo ?? 0);

  if (diasParaVencer < 0) return { type: "vencido", text: "Vencido" };
  if (diasParaVencer <= 30) return { type: "critico", text: "Vence em breve" };
  if (diasParaVencer <= 90) return { type: "alerta", text: "Próximo vencimento" };
  if (atual < minimo) return { type: "baixo", text: "Estoque baixo" };
  return { type: "ok", text: "Normal" };
}

function renderizarBadgeStatus(status) {
  const classes = {
    vencido: "badge-danger",
    critico: "badge-danger",
    alerta: "badge-warning",
    baixo: "badge-warning",
    ok: "badge-success",
  };
  return `<span class="badge ${classes[status.type] || "badge-secondary"}">${status.text}</span>`;
}

function calcularDiasParaVencer(vencimento) {
  if (!vencimento) return 999999;
  const hoje = new Date();
  const data = new Date(vencimento);
  const diff = data - hoje;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatarData(data) {
  if (!data) return "-";
  const d = new Date(data);
  if (isNaN(d.getTime())) return String(data);
  return d.toLocaleDateString("pt-BR");
}

// ==========================================
// PAGINAÇÃO / FILTROS
// ==========================================
function renderizarPaginacao(totalPaginas) {
  const paginacao = document.getElementById("pagination");
  if (!paginacao) return;

  if (totalPaginas <= 1) {
    paginacao.innerHTML = "";
    return;
  }

  let html = `
    <button class="pagination-btn" ${paginaAtual === 1 ? "disabled" : ""} onclick="mudarPagina(${paginaAtual - 1})">
      <i data-lucide="chevron-left"></i>
    </button>
  `;

  for (let i = 1; i <= totalPaginas; i++) {
    html += `
      <button class="pagination-btn ${i === paginaAtual ? "active" : ""}" onclick="mudarPagina(${i})">
        ${i}
      </button>
    `;
  }

  html += `
    <button class="pagination-btn" ${paginaAtual === totalPaginas ? "disabled" : ""} onclick="mudarPagina(${paginaAtual + 1})">
      <i data-lucide="chevron-right"></i>
    </button>
  `;

  paginacao.innerHTML = html;
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function mudarPagina(pagina) {
  paginaAtual = pagina;
  renderizarTabela();
}

function aplicarFiltros() {
  paginaAtual = 1;
  renderizarTabela();
}

// ==========================================
// MODAL - NOVO/EDITAR
// ==========================================
function abrirModalNovo() {
  produtoEditando = null;

  document.getElementById("modalTitle").innerHTML = '<i data-lucide="package-plus"></i> Novo Medicamento';
  document.getElementById("formProduto")?.reset();
  document.getElementById("produtoId").value = "";

  const hoje = new Date().toISOString().split("T")[0];
  const validade = document.getElementById("validade");
  if (validade) validade.setAttribute("min", hoje);

  document.getElementById("modalProduto")?.classList.add("active");
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function editarProduto(id) {
  const produto = produtos.find((p) => p.id === id);
  if (!produto) return;

  produtoEditando = produto;

  document.getElementById("modalTitle").innerHTML = '<i data-lucide="edit"></i> Editar Medicamento';
  document.getElementById("produtoId").value = produto.id;

  // Preenche conforme seu HTML (ids atuais)
  document.getElementById("nome").value = produto.nome || "";
  document.getElementById("categoria").value = produto.categoria || "";
  document.getElementById("principioAtivo").value = produto.principioAtivo || "";
  document.getElementById("fabricante").value = produto.fabricante || "";
  document.getElementById("lote").value = produto.lote || "";
  document.getElementById("validade").value = produto.vencimento || "";
  document.getElementById("quantidade").value = Number(produto.stock_atual ?? 0);
  document.getElementById("quantidadeMinima").value = Number(produto.stock_minimo ?? 0);
  document.getElementById("valorUnitario").value = Number(produto.preco ?? 0);
  document.getElementById("unidade").value = produto.unidade || "un";
  document.getElementById("descricao").value = produto.descricao || "";

  document.getElementById("modalProduto")?.classList.add("active");
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function fecharModal() {
  document.getElementById("modalProduto")?.classList.remove("active");
  produtoEditando = null;
}

function salvarProduto(e) {
  e.preventDefault();

  const id = document.getElementById("produtoId")?.value;

  // Lê do seu form (ids atuais) e converte para o padrão do Storage
  const produtoPadrao = {
    nome: document.getElementById("nome").value.trim(),
    categoria: document.getElementById("categoria").value,
    principioAtivo: document.getElementById("principioAtivo").value.trim(),
    fabricante: document.getElementById("fabricante").value.trim(),
    lote: document.getElementById("lote").value.trim(),
    vencimento: document.getElementById("validade").value, // <-- padrão do dashboard
    stock_atual: parseInt(document.getElementById("quantidade").value, 10),
    stock_minimo: parseInt(document.getElementById("quantidadeMinima").value, 10),
    preco: parseFloat(document.getElementById("valorUnitario").value),
    unidade: document.getElementById("unidade").value,
    descricao: document.getElementById("descricao").value.trim(),
    ativo: true,
  };

  // Validações simples
  if (!produtoPadrao.nome) return alert("Informe o nome.");
  if (!produtoPadrao.categoria) return alert("Selecione a categoria.");
  if (!produtoPadrao.vencimento) return alert("Informe a validade.");
  if (Number.isNaN(produtoPadrao.stock_atual)) return alert("Quantidade inválida.");
  if (Number.isNaN(produtoPadrao.stock_minimo)) return alert("Quantidade mínima inválida.");
  if (Number.isNaN(produtoPadrao.preco)) return alert("Valor unitário inválido.");

  if (id) {
    // Update via Storage.js
    if (typeof updateProduto === "function") {
      updateProduto(Number(id), { ...produtoPadrao, atualizadoEm: new Date().toISOString() });
    } else {
      // fallback
      const lista = getProdutos();
      const idx = lista.findIndex((p) => p.id === Number(id));
      if (idx >= 0) {
        lista[idx] = { ...lista[idx], ...produtoPadrao, atualizadoEm: new Date().toISOString() };
        localStorage.setItem("farm_produtos", JSON.stringify(lista));
      }
    }
  } else {
    // Add via Storage.js (ele já seta id/criadoEm/ativo no Storage.js)
    if (typeof addProduto === "function") {
      addProduto(produtoPadrao);
    } else {
      // fallback
      const lista = getProdutos();
      lista.push({ id: Date.now(), ...produtoPadrao, criadoEm: new Date().toISOString() });
      localStorage.setItem("farm_produtos", JSON.stringify(lista));
    }
  }

  carregarProdutos();
  renderizarTabela();
  fecharModal();

  alert(id ? "Medicamento atualizado com sucesso!" : "Medicamento cadastrado com sucesso!");
}

// ==========================================
// MODAL - EXCLUIR
// ==========================================
function confirmarExclusao(id) {
  const produto = produtos.find((p) => p.id === id);
  if (!produto) return;

  produtoExcluindo = produto;
  document.getElementById("nomeProdutoExcluir").textContent = produto.nome || "Medicamento";
  document.getElementById("modalExcluir")?.classList.add("active");
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function fecharModalExcluir() {
  document.getElementById("modalExcluir")?.classList.remove("active");
  produtoExcluindo = null;
}

// ==========================================
// EXPORT CSV (padrão compatível)
// ==========================================
function exportarCSV(lista) {
  const data = Array.isArray(lista) ? lista : [];

  const header = ["id", "sku", "nome", "categoria", "principioAtivo", "fabricante", "lote", "vencimento", "stock_atual", "stock_minimo", "preco", "unidade"];
  const rows = data.map((m) => [
    m.id ?? "",
    m.sku ?? "",
    m.nome ?? "",
    m.categoria ?? "",
    m.principioAtivo ?? "",
    m.fabricante ?? "",
    m.lote ?? "",
    m.vencimento ?? "",
    m.stock_atual ?? 0,
    m.stock_minimo ?? 0,
    m.preco ?? 0,
    m.unidade ?? "",
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `medicamentos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function verificarAutenticacao() {
  const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : null;

  if (!currentUser) {
    window.location.href = "../html/index.html";
    return;
  }

  const el = document.getElementById("userName");
  if (el) el.textContent = currentUser.nome || "Usuário";
}
