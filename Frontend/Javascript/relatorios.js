document.addEventListener("DOMContentLoaded", () => {
  if (
    typeof getMovimentacoes !== "function"
  ) {
    console.error("❌ Storage.js não carregado.");
    alert("Erro: Storage.js não foi carregado antes de relatorios.js");
    return;
  }

  carregarRelatorio();

  if (typeof lucide !== "undefined") lucide.createIcons();
});

function carregarRelatorio() {
  const tabela = document.getElementById("tabelaRelatorios");

  if (!tabela) return;

  const movs = getMovimentacoes().sort((a, b) => {
    const da = new Date(a.data || 0).getTime();
    const db = new Date(b.data || 0).getTime();
    return db - da;
  });

  let totalEntradas = 0;
  let totalSaidas = 0;

  tabela.innerHTML = "";

  if (movs.length === 0) {
    tabela.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 16px; color: var(--gray-600); text-align:center;">
          Nenhuma movimentação registrada ainda.
        </td>
      </tr>
    `;

    atualizarResumo(0, 0);
    return;
  }

  movs.forEach((m) => {
    const tipo = m.tipo === "entrada" ? "Entrada" : "Saída";

    if (m.tipo === "entrada") {
      totalEntradas += Number(m.quantidade ?? 0);
    } else if (m.tipo === "saida") {
      totalSaidas += Number(m.quantidade ?? 0);
    }

    const parceiro = m.tipo === "entrada"
      ? (m.fornecedor || "—")
      : (m.destino || "—");

    const data = m.dataBR || formatarDataBR(m.data);

    tabela.innerHTML += `
      <tr>
        <td>${tipo}</td>
        <td>${escapeHtml(m.medicamento || "—")}</td>
        <td>${Number(m.quantidade ?? 0)}</td>
        <td>${escapeHtml(parceiro)}</td>
        <td>${data}</td>
      </tr>
    `;
  });

  atualizarResumo(totalEntradas, totalSaidas);
}

function atualizarResumo(entradas, saidas) {
  document.getElementById("totalEntradas").textContent = entradas;
  document.getElementById("totalSaidas").textContent = saidas;
  document.getElementById("saldo").textContent = entradas - saidas;
}

function formatarDataBR(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);

  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();

  return `${dia}/${mes}/${ano}`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
