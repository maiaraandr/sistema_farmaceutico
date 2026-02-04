/**
 * ========================================
 * DASHBOARD - LÓGICA (compatível com dashboard.html enviado)
 * ========================================
 * Depende de: Storage.js + autenticacao.js
 */

(function () {
  // Protege a página (se não tiver logado, volta pro login)
  if (typeof protectPage === "function") protectPage();

  // Garante ícones
  if (typeof lucide !== "undefined") lucide.createIcons();

  // Logout
  const btnLogout = document.getElementById("logoutBtn");
  if (btnLogout && typeof logout === "function") {
    btnLogout.addEventListener("click", logout);
  }

  // Carregar tudo
  loadUserInfo();
  loadDashboardNumbers();
  renderAlerts();
  renderExpiringTable();
})();

/**
 * Carregar nome do usuário no header
 */
function loadUserInfo() {
  const user = typeof getCurrentUser === "function" ? getCurrentUser() : null;
  const el = document.getElementById("userName");
  if (el) el.textContent = user?.nome ? user.nome : "Usuário";
}

/**
 * Preencher os 4 cards do topo (IDs do seu HTML)
 */
function loadDashboardNumbers() {
  const produtos = (typeof getProdutos === "function" ? getProdutos() : []).filter(
    (p) => p.ativo !== false
  );

  const totalProdutos = produtos.length;

  const estoqueBaixo = produtos.filter((p) => {
    const atual = Number(p.stock_atual ?? 0);
    const minimo = Number(p.stock_minimo ?? 0);
    return minimo > 0 ? atual <= minimo : atual <= 0;
  }).length;

  const proximoVencimento = produtos.filter((p) => {
    if (!p.vencimento) return false;
    const dias = calcularDiasRestantes(p.vencimento);
    return dias >= 0 && dias <= 90;
  }).length;

  const valorTotal = produtos.reduce((sum, p) => {
    const preco = Number(p.preco ?? 0);
    const qtd = Number(p.stock_atual ?? 0);
    return sum + preco * qtd;
  }, 0);

  setText("totalProdutos", String(totalProdutos));
  setText("estoqueBaixo", String(estoqueBaixo));
  setText("proximoVencimento", String(proximoVencimento));
  setText("valorTotal", formatarMoeda(valorTotal));
}

/**
 * Renderizar alertas em #alertasContainer (substitui os alertas fixos)
 */
function renderAlerts() {
  const container = document.getElementById("alertasContainer");
  if (!container) return;

  const produtos = (typeof getProdutos === "function" ? getProdutos() : []).filter(
    (p) => p.ativo !== false
  );

  const lowStock = produtos.filter((p) => {
    const atual = Number(p.stock_atual ?? 0);
    const minimo = Number(p.stock_minimo ?? 0);
    return minimo > 0 ? atual <= minimo : atual <= 0;
  });

  const expiring30 = produtos.filter((p) => {
    if (!p.vencimento) return false;
    const dias = calcularDiasRestantes(p.vencimento);
    return dias >= 0 && dias <= 30;
  });

  const hasAny = lowStock.length > 0 || expiring30.length > 0;

  // Se não tiver nada, mostra só “sistema ok”
  if (!hasAny) {
    container.innerHTML = `
      <div class="alert alert-success">
        <div class="alert-icon">
          <i data-lucide="check-circle"></i>
        </div>
        <div class="alert-content">
          <div class="alert-title">Tudo certo</div>
          <div class="alert-message">Nenhum alerta crítico no momento.</div>
        </div>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const html = [];

  if (lowStock.length > 0) {
    html.push(`
      <div class="alert alert-warning">
        <div class="alert-icon">
          <i data-lucide="alert-triangle"></i>
        </div>
        <div class="alert-content">
          <div class="alert-title">Estoque Baixo</div>
          <div class="alert-message">
            ${lowStock.length} medicamento(s) estão com estoque abaixo do mínimo recomendado.
            <a href="produtos.html" class="text-primary font-semibold"> Ver detalhes →</a>
          </div>
        </div>
      </div>
    `);
  }

  if (expiring30.length > 0) {
    html.push(`
      <div class="alert alert-danger">
        <div class="alert-icon">
          <i data-lucide="calendar-x"></i>
        </div>
        <div class="alert-content">
          <div class="alert-title">Medicamentos Vencendo</div>
          <div class="alert-message">
            ${expiring30.length} medicamento(s) vencem nos próximos 30 dias.
            <a href="produtos.html" class="text-primary font-semibold"> Verificar →</a>
          </div>
        </div>
      </div>
    `);
  }

  // “Sistema atualizado” sempre por último
  html.push(`
    <div class="alert alert-success">
      <div class="alert-icon">
        <i data-lucide="check-circle"></i>
      </div>
      <div class="alert-content">
        <div class="alert-title">Sistema Atualizado</div>
        <div class="alert-message">Dados carregados com sucesso.</div>
      </div>
    </div>
  `);

  container.innerHTML = html.join("");
  lucide.createIcons();
}

/**
 * Renderizar tabela "Medicamentos Próximos ao Vencimento" em #vencimentoContainer
 */
function renderExpiringTable() {
  const tbody = document.getElementById("vencimentoContainer");
  if (!tbody) return;

  const produtos = (typeof getProdutos === "function" ? getProdutos() : []).filter(
    (p) => p.ativo !== false && p.vencimento
  );

  const lista = produtos
    .map((p) => ({ ...p, diasRestantes: calcularDiasRestantes(p.vencimento) }))
    .filter((p) => p.diasRestantes >= 0 && p.diasRestantes <= 90)
    .sort((a, b) => a.diasRestantes - b.diasRestantes)
    .slice(0, 6);

  if (lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 18px; color: var(--gray-600);">
          Nenhum medicamento próximo ao vencimento nos próximos 90 dias.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista
    .map((p) => {
      const badgeClass =
        p.diasRestantes <= 30 ? "badge-danger" : p.diasRestantes <= 60 ? "badge-warning" : "badge-primary";

      const categoria = p.categoria ? p.categoria : "—";
      const estoqueTxt = `${Number(p.stock_atual ?? 0)} un`;

      return `
        <tr>
          <td>
            <div class="table-cell-content">
              <div class="table-icon" style="background: var(--primary-100); color: var(--primary);">
                <i data-lucide="pill"></i>
              </div>
              <span class="font-semibold">${escapeHtml(p.nome || "Medicamento")}</span>
            </div>
          </td>
          <td><span class="badge badge-primary">${escapeHtml(categoria)}</span></td>
          <td>${estoqueTxt}</td>
          <td>${formatarData(p.vencimento)}</td>
          <td><span class="badge ${badgeClass}">${p.diasRestantes} dias</span></td>
        </tr>
      `;
    })
    .join("");

  lucide.createIcons();
}

/* ===================== Helpers ===================== */

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function calcularDiasRestantes(dataVencimento) {
  const hoje = new Date();
  const venc = new Date(dataVencimento);
  const diff = venc - hoje;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatarData(dataString) {
  const d = new Date(dataString);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
