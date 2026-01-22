const entradas = [
  { medicamento: 'Dipirona', quantidade: 50, fornecedor: 'Fornecedor A', data: '10/01/2026' },
  { medicamento: 'Paracetamol', quantidade: 30, fornecedor: 'Fornecedor B', data: '12/01/2026' }
];

const saidas = [
  { medicamento: 'Dipirona', quantidade: 10, destino: 'Venda', data: '15/01/2026' }
];

const tabela = document.getElementById('tabelaRelatorios');

let totalEntradas = 0;
let totalSaidas = 0;

// Entradas
entradas.forEach(e => {
  totalEntradas += e.quantidade;

  tabela.innerHTML += `
    <tr>
      <td>Entrada</td>
      <td>${e.medicamento}</td>
      <td>${e.quantidade}</td>
      <td>${e.fornecedor}</td>
      <td>${e.data}</td>
    </tr>
  `;
});

// Saídas
saidas.forEach(s => {
  totalSaidas += s.quantidade;

  tabela.innerHTML += `
    <tr>
      <td>Saída</td>
      <td>${s.medicamento}</td>
      <td>${s.quantidade}</td>
      <td>${s.destino}</td>
      <td>${s.data}</td>
    </tr>
  `;
});

document.getElementById('totalEntradas').textContent = totalEntradas;
document.getElementById('totalSaidas').textContent = totalSaidas;
document.getElementById('saldo').textContent = totalEntradas - totalSaidas;
