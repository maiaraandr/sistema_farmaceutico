/**
 * ==========================================
 * GERENCIAMENTO DE PRODUTOS/MEDICAMENTOS
 * ==========================================
 */

// Variáveis globais
let produtos = [];
let produtoEditando = null;
let paginaAtual = 1;
const itensPorPagina = 10;

// ==========================================
// INICIALIZAÇÃO
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticação
    verificarAutenticacao();
    
    // Carregar produtos
    carregarProdutos();
    
    // Renderizar tabela
    renderizarTabela();
    
    // Event Listeners
    inicializarEventListeners();
    
    // Inicializar ícones
    lucide.createIcons();
});

// ==========================================
// STORAGE - PRODUTOS
// ==========================================

function getProdutos() {
    const data = localStorage.getItem('farm_produtos');
    return data ? JSON.parse(data) : [];
}

function saveProdutos(produtos) {
    localStorage.setItem('farm_produtos', JSON.stringify(produtos));
}

function carregarProdutos() {
    produtos = getProdutos();
    
    // Se não tiver produtos, criar alguns exemplos
    if (produtos.length === 0) {
        produtos = [
            {
                id: 1,
                nome: 'Paracetamol 500mg',
                categoria: 'analgésico',
                principioAtivo: 'Paracetamol',
                fabricante: 'EMS',
                lote: 'LOT001',
                validade: '2026-12-31',
                quantidade: 150,
                quantidadeMinima: 50,
                valorUnitario: 0.50,
                unidade: 'cp',
                descricao: 'Analgésico e antitérmico',
                criadoEm: new Date().toISOString()
            },
            {
                id: 2,
                nome: 'Dipirona 500mg',
                categoria: 'analgésico',
                principioAtivo: 'Dipirona Sódica',
                fabricante: 'Medley',
                lote: 'LOT002',
                validade: '2025-06-30',
                quantidade: 80,
                quantidadeMinima: 40,
                valorUnitario: 0.45,
                unidade: 'cp',
                descricao: 'Analgésico e antitérmico',
                criadoEm: new Date().toISOString()
            },
            {
                id: 3,
                nome: 'Amoxicilina 500mg',
                categoria: 'antibiótico',
                principioAtivo: 'Amoxicilina',
                fabricante: 'Eurofarma',
                lote: 'LOT003',
                validade: '2026-03-15',
                quantidade: 120,
                quantidadeMinima: 60,
                valorUnitario: 1.20,
                unidade: 'cp',
                descricao: 'Antibiótico de amplo espectro',
                criadoEm: new Date().toISOString()
            },
            {
                id: 4,
                nome: 'Ibuprofeno 600mg',
                categoria: 'anti-inflamatório',
                principioAtivo: 'Ibuprofeno',
                fabricante: 'Aché',
                lote: 'LOT004',
                validade: '2025-02-28',
                quantidade: 35,
                quantidadeMinima: 50,
                valorUnitario: 0.80,
                unidade: 'cp',
                descricao: 'Anti-inflamatório não esteroidal',
                criadoEm: new Date().toISOString()
            }
        ];
        saveProdutos(produtos);
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function inicializarEventListeners() {
    // Botão Novo Produto
    document.getElementById('btnNovoProduto').addEventListener('click', abrirModalNovo);
    
    // Modal - Fechar
    document.getElementById('modalClose').addEventListener('click', fecharModal);
    document.getElementById('modalOverlay').addEventListener('click', fecharModal);
    document.getElementById('btnCancelar').addEventListener('click', fecharModal);
    
    // Form - Submit
    document.getElementById('formProduto').addEventListener('submit', salvarProduto);
    
    // Busca
    document.getElementById('searchInput').addEventListener('input', aplicarFiltros);
    
    // Filtros
    document.getElementById('filterCategoria').addEventListener('change', aplicarFiltros);
    document.getElementById('filterEstoque').addEventListener('change', aplicarFiltros);
    
    // Modal Excluir
    document.getElementById('modalExcluirClose').addEventListener('click', fecharModalExcluir);
    document.getElementById('modalExcluirOverlay').addEventListener('click', fecharModalExcluir);
    document.getElementById('btnCancelarExcluir').addEventListener('click', fecharModalExcluir);
}

// ==========================================
// RENDERIZAÇÃO
// ==========================================

function renderizarTabela() {
    const tbody = document.getElementById('tabelaProdutos');
    const search = document.getElementById('searchInput').value.toLowerCase();
    const filterCategoria = document.getElementById('filterCategoria').value;
    const filterEstoque = document.getElementById('filterEstoque').value;
    
    // Filtrar produtos
    let produtosFiltrados = produtos.filter(p => {
        const matchSearch = p.nome.toLowerCase().includes(search) || 
                           p.categoria.toLowerCase().includes(search) ||
                           p.principioAtivo?.toLowerCase().includes(search);
        
        const matchCategoria = !filterCategoria || p.categoria === filterCategoria;
        
        let matchEstoque = true;
        if (filterEstoque === 'baixo') {
            matchEstoque = p.quantidade < p.quantidadeMinima;
        } else if (filterEstoque === 'ok') {
            matchEstoque = p.quantidade >= p.quantidadeMinima;
        } else if (filterEstoque === 'vencendo') {
            const diasParaVencer = calcularDiasParaVencer(p.validade);
            matchEstoque = diasParaVencer <= 90 && diasParaVencer > 0;
        }
        
        return matchSearch && matchCategoria && matchEstoque;
    });
    
    // Paginação
    const totalPaginas = Math.ceil(produtosFiltrados.length / itensPorPagina);
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const produtosPagina = produtosFiltrados.slice(inicio, fim);
    
    // Limpar tabela
    tbody.innerHTML = '';
    
    if (produtosPagina.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: var(--gray-500);">
                    <i data-lucide="inbox" style="width: 48px; height: 48px; margin-bottom: 10px;"></i>
                    <p>Nenhum medicamento encontrado</p>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }
    
    // Renderizar linhas
    produtosPagina.forEach(produto => {
        const tr = document.createElement('tr');
        
        const status = getStatusProduto(produto);
        const diasParaVencer = calcularDiasParaVencer(produto.validade);
        
        tr.innerHTML = `
            <td><code>${String(produto.id).padStart(4, '0')}</code></td>
            <td>
                <strong>${produto.nome}</strong>
                ${produto.principioAtivo ? `<br><small style="color: var(--gray-500);">${produto.principioAtivo}</small>` : ''}
            </td>
            <td><span class="badge badge-info">${produto.categoria}</span></td>
            <td>${produto.quantidade} ${produto.unidade}</td>
            <td>${produto.quantidadeMinima} ${produto.unidade}</td>
            <td>R$ ${produto.valorUnitario.toFixed(2)}</td>
            <td>
                ${formatarData(produto.validade)}
                ${diasParaVencer <= 90 && diasParaVencer > 0 ? `<br><small style="color: #f59e0b;">${diasParaVencer} dias</small>` : ''}
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
    
    // Renderizar paginação
    renderizarPaginacao(totalPaginas);
    
    // Reinicializar ícones
    lucide.createIcons();
}

function getStatusProduto(produto) {
    const diasParaVencer = calcularDiasParaVencer(produto.validade);
    
    if (diasParaVencer < 0) return { type: 'vencido', text: 'Vencido' };
    if (diasParaVencer <= 30) return { type: 'critico', text: 'Vence em breve' };
    if (diasParaVencer <= 90) return { type: 'alerta', text: 'Próximo vencimento' };
    if (produto.quantidade < produto.quantidadeMinima) return { type: 'baixo', text: 'Estoque baixo' };
    return { type: 'ok', text: 'Normal' };
}

function renderizarBadgeStatus(status) {
    const classes = {
        'vencido': 'badge-danger',
        'critico': 'badge-danger',
        'alerta': 'badge-warning',
        'baixo': 'badge-warning',
        'ok': 'badge-success'
    };
    
    return `<span class="badge ${classes[status.type]}">${status.text}</span>`;
}

function calcularDiasParaVencer(validade) {
    const hoje = new Date();
    const dataValidade = new Date(validade);
    const diff = dataValidade - hoje;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatarData(data) {
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR');
}

function renderizarPaginacao(totalPaginas) {
    const paginacao = document.getElementById('pagination');
    
    if (totalPaginas <= 1) {
        paginacao.innerHTML = '';
        return;
    }
    
    let html = `
        <button class="pagination-btn" ${paginaAtual === 1 ? 'disabled' : ''} onclick="mudarPagina(${paginaAtual - 1})">
            <i data-lucide="chevron-left"></i>
        </button>
    `;
    
    for (let i = 1; i <= totalPaginas; i++) {
        html += `
            <button class="pagination-btn ${i === paginaAtual ? 'active' : ''}" onclick="mudarPagina(${i})">
                ${i}
            </button>
        `;
    }
    
    html += `
        <button class="pagination-btn" ${paginaAtual === totalPaginas ? 'disabled' : ''} onclick="mudarPagina(${paginaAtual + 1})">
            <i data-lucide="chevron-right"></i>
        </button>
    `;
    
    paginacao.innerHTML = html;
    lucide.createIcons();
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
    document.getElementById('modalTitle').innerHTML = '<i data-lucide="package-plus"></i> Novo Medicamento';
    document.getElementById('formProduto').reset();
    document.getElementById('produtoId').value = '';
    
    // Data mínima (hoje)
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('validade').setAttribute('min', hoje);
    
    document.getElementById('modalProduto').classList.add('active');
    lucide.createIcons();
}

function editarProduto(id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;
    
    produtoEditando = produto;
    
    document.getElementById('modalTitle').innerHTML = '<i data-lucide="edit"></i> Editar Medicamento';
    document.getElementById('produtoId').value = produto.id;
    document.getElementById('nome').value = produto.nome;
    document.getElementById('categoria').value = produto.categoria;
    document.getElementById('principioAtivo').value = produto.principioAtivo || '';
    document.getElementById('fabricante').value = produto.fabricante || '';
    document.getElementById('lote').value = produto.lote || '';
    document.getElementById('validade').value = produto.validade;
    document.getElementById('quantidade').value = produto.quantidade;
    document.getElementById('quantidadeMinima').value = produto.quantidadeMinima;
    document.getElementById('valorUnitario').value = produto.valorUnitario;
    document.getElementById('unidade').value = produto.unidade;
    document.getElementById('descricao').value = produto.descricao || '';
    
    document.getElementById('modalProduto').classList.add('active');
    lucide.createIcons();
}

function fecharModal() {
    document.getElementById('modalProduto').classList.remove('active');
    produtoEditando = null;
}

function salvarProduto(e) {
    e.preventDefault();
    
    const id = document.getElementById('produtoId').value;
    const produto = {
        nome: document.getElementById('nome').value,
        categoria: document.getElementById('categoria').value,
        principioAtivo: document.getElementById('principioAtivo').value,
        fabricante: document.getElementById('fabricante').value,
        lote: document.getElementById('lote').value,
        validade: document.getElementById('validade').value,
        quantidade: parseInt(document.getElementById('quantidade').value),
        quantidadeMinima: parseInt(document.getElementById('quantidadeMinima').value),
        valorUnitario: parseFloat(document.getElementById('valorUnitario').value),
        unidade: document.getElementById('unidade').value,
        descricao: document.getElementById('descricao').value
    };
    
    if (id) {
        // Editar
        const index = produtos.findIndex(p => p.id == id);
        produtos[index] = { ...produtos[index], ...produto, atualizadoEm: new Date().toISOString() };
    } else {
        // Novo
        produto.id = Date.now();
        produto.criadoEm = new Date().toISOString();
        produtos.push(produto);
    }
    
    saveProdutos(produtos);
    renderizarTabela();
    fecharModal();
    
    // Mostrar mensagem de sucesso
    alert(id ? 'Medicamento atualizado com sucesso!' : 'Medicamento cadastrado com sucesso!');
}

// ==========================================
// MODAL - EXCLUIR
// ==========================================

let produtoExcluindo = null;

function confirmarExclusao(id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;
    
    produtoExcluindo = produto;
    document.getElementById('nomeProdutoExcluir').textContent = produto.nome;
    document.getElementById('modalExcluir').classList.add('active');
    lucide.createIcons();
}

function fecharModalExcluir() {
    document.getElementById('modalExcluir').classList.remove('active');
    produtoExcluindo = null;
}

document.getElementById('btnConfirmarExcluir').addEventListener('click', () => {
    if (!produtoExcluindo) return;
    
    produtos = produtos.filter(p => p.id !== produtoExcluindo.id);
    saveProdutos(produtos);
    renderizarTabela();
    fecharModalExcluir();
    
    alert('Medicamento excluído com sucesso!');
});

// ==========================================
// VERIFICAÇÃO DE AUTENTICAÇÃO
// ==========================================

function verificarAutenticacao() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = '../html/index.html';
        return;
    }
    
    document.getElementById('userName').textContent = currentUser.nome;
}