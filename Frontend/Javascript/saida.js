const dataSaidaInput = document.getElementById("dataSaida");
dataSaidaInput.value = new Date().toLocaleDateString("pt-BR");

document.getElementById("formSaida").addEventListener("submit", function (e) {
  e.preventDefault();

  const medicamento = document.getElementById("medicamento").value;
  const quantidade = document.getElementById("quantidade").value;
  const destino = document.getElementById("destino").value;
  const dataSaida = dataSaidaInput.value;

  const tabela = document.getElementById("tabelaSaida");

  const linha = document.createElement("tr");
  linha.innerHTML = `
    <td>${medicamento}</td>
    <td>${quantidade}</td>
    <td>${destino}</td>
    <td>${dataSaida}</td>
    <td>
        <button class="btn btn-danger btn-sm" onclick="excluirSaida(this)">
            Excluir
        </button>
    </td>
`;
  tabela.appendChild(linha);

  document.getElementById("formSaida").reset();
  dataSaidaInput.value = new Date().toLocaleDateString("pt-BR");
});
