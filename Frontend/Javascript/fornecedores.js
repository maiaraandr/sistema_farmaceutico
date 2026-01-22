const dataCadastroInput = document.getElementById('dataCadastro');
dataCadastroInput.value = new Date().toLocaleDateString('pt-BR');

document.getElementById('formFornecedor').addEventListener('submit', function (e) {
  e.preventDefault();

  const nome = document.getElementById('nome').value;
  const cnpj = document.getElementById('cnpj').value;
  const telefone = document.getElementById('telefone').value;
  const email = document.getElementById('email').value;
  const dataCadastro = dataCadastroInput.value;

  const tabela = document.getElementById('tabelaFornecedores');
  const linha = document.createElement('tr');

  linha.innerHTML = `
    <td>${nome}</td>
    <td>${cnpj}</td>
    <td>${telefone}</td>
    <td>${email}</td>
    <td>${dataCadastro}</td>
    <td>
      <button class="btn btn-danger btn-sm" onclick="excluirFornecedor(this)">
        Excluir
      </button>
    </td>
  `;

  tabela.appendChild(linha);
  document.getElementById('formFornecedor').reset();
  dataCadastroInput.value = new Date().toLocaleDateString('pt-BR');
});

function excluirFornecedor(botao) {
  if (confirm('Deseja realmente excluir este fornecedor?')) {
    botao.closest('tr').remove();
  }
}
