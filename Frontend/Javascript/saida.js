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
    alert("Erro: Storage.js não carregou. Verifique se ele está antes do saida.js no HTML.");
    return;
  }

  // Data de saída (hoje)
  const dataSaidaInput = document.getElementById("dataSaida");
  if (dataSaidaInput) dataSaidaInput.value = hojeBR();

  renderSaidas();

  const form = document.getElementById("formSaida");
  if (form) form.addEventListener("submit", onSubmitSaida);

  if (typeof lucide !== "undefined") lucide.createIcons();
})();

function onSubmitSaida(e) {
  e.preventDefault();

  const medicamentoDigitado = getValue("medicamento");
  const quantidade = Number(getValue("quantidade"));
  const destino = getValue("destino");
  const dataSaida = document.getElementById("dataSaida")?.value || hojeBR();

  if (!medicamentoDigitado || !destino || !quantidade || quantidade <= 0) {
    alert("Preencha todos os campos corretamente (quantidade deve ser maior que 0).");
    return;
  }

  // Procurar produto existente 
  const produtos = getProdutos().filter((p) => p.ativo !== false);

  const buscado = medicamentoDigitado.toLowerCase().trim();

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
    stock_atual: estoqueAtual - quantidade
  });

  // Salva movimentação
  addMovimentacao({
    tipo: "saida",
    produto_id: produto.id,
    medicamento: produto.nome,
    quantidade,
    destino,
    dataBR: dataSaida
  });

  document.getElementById("formSaida")?.reset();
  const dataSaidaInput = document.getElementById("dataSaida");
  if (dataSaidaInput) dataSaidaInput.value = hojeBR();

  renderSaidas();
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function renderSaidas() {
  const tbody = document.getElementById("tabelaSaida");
  if (!tbody) return;

  const movs = getMovimentacoes()
    .filter((m) => m.tipo === "saida")
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
          <td>${escapeHtml(m.medicamento || "—")}</td>
          <td>${Number(m.quantidade ?? 0)}</td>
          <td>${escapeHtml(m.destino || "—")}</td>
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
    .join("");
}

function excluirSaida(movId) {
  if (!confirm("Deseja realmente excluir esta saída? Isso também vai ajustar o estoque.")) return;

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
  if (typeof lucide !== "undefined") lucide.createIcons();
}

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
