const dataEntradaInput = document.getElementById('dataEntrada');
dataEntradaInput.value = new Date().toLocaleDateString('pt-BR');

document.getElementById('formEntrada').addEventListener('submit', function (e) {
  e.preventDefault();

  const medicamento = document.getElementById('medicamento').value;
  const quantidade = document.getElementById('quantidade').value;
  const fornecedor = document.getElementById('fornecedor').value;
  const validade = document.getElementById('validade').value;
  const dataEntrada = dataEntradaInput.value;

  const tabela = document.getElementById('tabelaEntrada');
  const linha = document.createElement('tr');

  linha.innerHTML = `
    <td>${medicamento}</td>
    <td>${quantidade}</td>
    <td>${fornecedor}</td>
    <td>${validade}</td>
    <td>${dataEntrada}</td>
    <td>
      <button class="btn btn-danger btn-sm" onclick="excluirEntrada(this)">
        Excluir
      </button>
    </td>
  `;

  tabela.appendChild(linha);
  document.getElementById('formEntrada').reset();
  dataEntradaInput.value = new Date().toLocaleDateString('pt-BR');
});

function excluirEntrada(botao) {
  if (confirm('Deseja realmente excluir esta entrada?')) {
    botao.closest('tr').remove();
  }
}
