/**
 * ========================================
 * DASHBOARD - LÓGICA
 * ========================================
 */

/**
 * Carregar informações do usuário
 */
function loadUserInfo() {
    const user = getCurrentUser();
    
    if (user) {
        document.getElementById('userName').textContent = user.nome;
        document.getElementById('userRole').textContent = user.tipo === 'admin' ? 'Administrador' : 'Caixa';
        
        // Avatar com primeira letra do nome
        const firstLetter = user.nome.charAt(0).toUpperCase();
        document.getElementById('userAvatar').textContent = firstLetter;
    }
}

/**
 * Carregar estatísticas do dashboard
 */
function loadStatistics() {
    const produtos = getProdutos().filter(p => p.ativo);
    const fornecedores = getFornecedores().filter(f => f.ativo);
    
    // Calcular estatísticas
    const totalProdutos = produtos.length;
    const produtosEstoqueBaixo = produtos.filter(p => p.stock_atual <= p.stock_minimo).length;
    const produtosAVencer = produtos.filter(p => {
        if (!p.vencimento) return false;
        const diasRestantes = calcularDiasRestantes(p.vencimento);
        return diasRestantes <= 90 && diasRestantes >= 0;
    }).length;
    const valorTotalEstoque = produtos.reduce((sum, p) => sum + (p.preco * p.stock_atual), 0);
    
    // Renderizar cards
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon primary">
                <i data-lucide="package"></i>
            </div>
            <div class="stat-value">${totalProdutos}</div>
            <div class="stat-label">Produtos Cadastrados</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon warning">
                <i data-lucide="alert-triangle"></i>
            </div>
            <div class="stat-value">${produtosEstoqueBaixo}</div>
            <div class="stat-label">Estoque Baixo</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon error">
                <i data-lucide="calendar-clock"></i>
            </div>
            <div class="stat-value">${produtosAVencer}</div>
            <div class="stat-label">A Vencer (90 dias)</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon success">
                <i data-lucide="dollar-sign"></i>
            </div>
            <div class="stat-value">R$ ${valorTotalEstoque.toFixed(2)}</div>
            <div class="stat-label">Valor em Estoque</div>
        </div>
    `;
    
    // Reinicializar ícones
    lucide.createIcons();
}

/**
 * Carregar alertas de estoque baixo
 */
function loadLowStockAlerts() {
    const produtos = getProdutos().filter(p => p.ativo);
    const produtosEstoqueBaixo = produtos
        .filter(p => p.stock_atual <= p.stock_minimo)
        .sort((a, b) => {
            const percentA = (a.stock_atual / a.stock_minimo) * 100;
            const percentB = (b.stock_atual / b.stock_minimo) * 100;
            return percentA - percentB;
        })
        .slice(0, 5); // Mostrar apenas os 5 primeiros
    
    const container = document.getElementById('lowStockList');
    
    if (produtosEstoqueBaixo.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="check-circle" class="empty-icon"></i>
                <h3 class="empty-title">Tudo certo!</h3>
                <p class="empty-description">Nenhum produto com estoque baixo no momento.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    container.innerHTML = produtosEstoqueBaixo.map(produto => {
        const percentual = (produto.stock_atual / produto.stock_minimo * 100).toFixed(0);
        const status = produto.stock_atual === 0 ? 'critical' : 
                      percentual < 50 ? 'critical' : 'warning';
        const statusText = produto.stock_atual === 0 ? 'SEM ESTOQUE' : 
                          percentual < 50 ? 'CRÍTICO' : 'BAIXO';
        
        return `
            <div class="alert-item">
                <div class="alert-icon-wrapper ${status}">
                    <i data-lucide="alert-triangle"></i>
                </div>
                <div class="alert-details">
                    <div class="alert-product-name">${produto.nome}</div>
                    <div class="alert-product-info">
                        Estoque: ${produto.stock_atual} / Mínimo: ${produto.stock_minimo} • 
                        <span class="badge badge-${status === 'critical' ? 'danger' : 'warning'}">${statusText}</span>
                    </div>
                </div>
                <div class="alert-action">
                    <button class="btn btn-sm btn-primary" onclick="window.location.href='produtos.html'">
                        Ver Produto
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    lucide.createIcons();
}

/**
 * Carregar produtos próximos ao vencimento
 */
function loadExpiringProducts() {
    const produtos = getProdutos().filter(p => p.ativo && p.vencimento);
    const hoje = new Date();
    
    const produtosAVencer = produtos
        .map(p => ({
            ...p,
            diasRestantes: calcularDiasRestantes(p.vencimento)
        }))
        .filter(p => p.diasRestantes <= 90 && p.diasRestantes >= 0)
        .sort((a, b) => a.diasRestantes - b.diasRestantes)
        .slice(0, 5); // Mostrar apenas os 5 primeiros
    
    const container = document.getElementById('expiringList');
    
    if (produtosAVencer.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="check-circle" class="empty-icon"></i>
                <h3 class="empty-title">Tudo certo!</h3>
                <p class="empty-description">Nenhum produto próximo ao vencimento nos próximos 90 dias.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    container.innerHTML = produtosAVencer.map(produto => {
        const status = produto.diasRestantes <= 30 ? 'critical' : 
                      produto.diasRestantes <= 60 ? 'warning' : 'info';
        const statusText = produto.diasRestantes <= 30 ? 'URGENTE' : 
                          produto.diasRestantes <= 60 ? 'ATENÇÃO' : 'AVISAR';
        
        return `
            <div class="alert-item">
                <div class="alert-icon-wrapper ${status}">
                    <i data-lucide="calendar-clock"></i>
                </div>
                <div class="alert-details">
                    <div class="alert-product-name">${produto.nome}</div>
                    <div class="alert-product-info">
                        Vence em ${produto.diasRestantes} dia${produto.diasRestantes !== 1 ? 's' : ''} 
                        (${formatarData(produto.vencimento)}) • 
                        <span class="badge badge-${status === 'critical' ? 'danger' : status === 'warning' ? 'warning' : 'primary'}">${statusText}</span>
                    </div>
                </div>
                <div class="alert-action">
                    <button class="btn btn-sm btn-outline" onclick="window.location.href='produtos.html'">
                        Ver Detalhes
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    lucide.createIcons();
}

/**
 * Calcular dias restantes até o vencimento
 */
function calcularDiasRestantes(dataVencimento) {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diffTime = vencimento - hoje;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

/**
 * Formatar data para exibição
 */
function formatarData(dataString) {
    const data = new Date(dataString);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

/**
 * Formatar moeda
 */
function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}