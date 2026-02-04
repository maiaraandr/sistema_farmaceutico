/**
 * ========================================
 * ENTRADA - LÓGICA (LocalStorage + Estoque)
 * ========================================
 * Depende de: Storage.js
 */

(function () {
  // Checagem de dependências
  const depsOk =
    typeof getProdutos === "function" &&
    typeof updateProduto === "function" &&
    typeof addMovimentacao === "function" &&
    typeof getMovimentacoes === "function" &&
    typeof getProdutoById === "function" &&
    typeof saveMovimentacoes === "function";

  if (!depsOk) {
    console.error("❌ Storage.js não foi carregado ou funções ausentes.");
    alert("Erro: Storage.js não carregou. Verifique se ele está antes do entrada.js no HTML.");
    return;
  }

  // Data de entrada (hoje)
  const dataEntradaInput = document.getElementById("dataEntrada");
  if (dataEntradaInput) dataEntradaInput.value = hojeBR();

  // Render inicial
  renderEntradas();

  // Submit
  const form = document.getElementById("formEntrada");
  if (form) form.addEventListener("submit", onSubmitEntrada);

  // Ícones
  if (typeof lucide !== "undefined") lucide.createIcons();
})();

function onSubmitEntrada(e) {
  e.preventDefault();

  const medicamentoDigitado = getValue("medicamento");
  const quantidade = Number(getValue("quantidade"));
  const fornecedor = getValue("fornecedor");
  const validade = getValue("validade");
  const dataEntrada = document.getElementById("dataEntrada")?.value || hojeBR();

  // Validações
  if (!medicamentoDigitado || !fornecedor || !validade || !quantidade || quantidade <= 0) {
    alert("Preencha todos os campos corretamente (quantidade deve ser maior que 0).");
    return;
  }

  // Procurar produto existente (mais tolerante)
  const produtos = getProdutos().filter((p) => p.ativo !== false);

  const buscado = medicamentoDigitado.toLowerCase().trim();

  // tenta match exato; se não achar, tenta por "contém"
  let produto = produtos.find((p) => (p.nome || "").toLowerCase().trim() === buscado);
  if (!produto) {
    produto = produtos.find((p) => (p.nome || "").toLowerCase().includes(buscado));
  }

  if (!produto) {
    alert(
      "Esse medicamento não está cadastrado em PRODUTOS.\n\n" +
      "Dica: cadastre primeiro em Produtos ou digite o nome exatamente igual."
    );
    return;
  }

  // Atualiza estoque + vencimento
  updateProduto(produto.id, {
    stock_atual: Number(produto.stock_atual ?? 0) + quantidade,
    vencimento: validade
  });

  // Salva movimentação
  addMovimentacao({
    tipo: "entrada",
    produto_id: produto.id,
    medicamento: produto.nome,
    quantidade,
    fornecedor,
    validade,
    dataBR: dataEntrada
  });

  // Limpa form e renova data
  document.getElementById("formEntrada")?.reset();
  const dataEntradaInput = document.getElementById("dataEntrada");
  if (dataEntradaInput) dataEntradaInput.value = hojeBR();

  // Atualiza tabela
  renderEntradas();
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function renderEntradas() {
  const tbody = document.getElementById("tabelaEntrada");
  if (!tbody) return;

  const movs = getMovimentacoes()
    .filter((m) => m.tipo === "entrada")
    .sort((a, b) => {
      const da = new Date(a.data || a.criadoEm || 0).getTime();
      const db = new Date(b.data || b.criadoEm || 0).getTime();
      return db - da;
    });

  if (movs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 16px; color: var(--gray-600);">
          Nenhuma entrada registrada ainda.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = movs
    .map((m) => {
      const validade = m.validade ? formatarDataBR(m.validade) : "—";
      const dataEntrada = m.dataBR || formatarDataBR(m.data);

      return `
        <tr>
          <td>${escapeHtml(m.medicamento || "—")}</td>
          <td>${Number(m.quantidade ?? 0)}</td>
          <td>${escapeHtml(m.fornecedor || "—")}</td>
          <td>${validade}</td>
          <td>${dataEntrada}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="excluirEntrada(${m.id})">
              <i data-lucide="trash-2"></i>
              Excluir
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function excluirEntrada(movId) {
  if (!confirm("Deseja realmente excluir esta entrada? Isso também vai ajustar o estoque.")) return;

  const movs = getMovimentacoes();
  const mov = movs.find((m) => m.id === movId);
  if (!mov) return;

  // Reverter estoque
  const produto = getProdutoById(mov.produto_id);
  if (produto) {
    const atual = Number(produto.stock_atual ?? 0);
    const qtd = Number(mov.quantidade ?? 0);
    updateProduto(produto.id, { stock_atual: Math.max(0, atual - qtd) });
  }

  // Remove movimentação
  const atualizados = movs.filter((m) => m.id !== movId);
  saveMovimentacoes(atualizados);

  renderEntradas();
  if (typeof lucide !== "undefined") lucide.createIcons();
}

/* ===================== Helpers ===================== */

function getValue(id) {
  const el = document.getElementById(id);
  return el ? String(el.value).trim() : "";
}

function hojeBR() {
  return new Date().toLocaleDateString("pt-BR");
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
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
