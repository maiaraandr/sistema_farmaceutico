// api.js - Comunicação com Backend Django
// Mantém compatibilidade com Storage.js como fallback

const API_CONFIG = {
  // ✅ Seus endpoints estão na raiz, não em /api
  BASE_URL: 'http://127.0.0.1:8000',
  TIMEOUT: 10000,
  USE_API: true,
};

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function showError(message, error) {
  console.error(message, error);
}

function showSuccess(message) {
  console.log('✅', message);
}

// ✅ Suporta resposta paginada (DRF pode retornar {count, next, previous, results})
function normalizeListResponse(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

async function apiRequest(endpoint, options = {}) {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

    const response = await fetch(url, {
      ...defaultOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} ${text}`
      );
    }

    if (options.method === 'DELETE') {
      return { success: true };
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Timeout: O servidor demorou muito para responder');
    }
    throw error;
  }
}

// ========================================
// MEDICAMENTOS
// ========================================

async function apiGetMedicamentos() {
  if (!API_CONFIG.USE_API) return getProdutos();

  try {
    const data = await apiRequest('/medicamentos/');
    const list = normalizeListResponse(data);
    console.log('📦 Medicamentos carregados da API:', list.length);
    return list;
  } catch (error) {
    showError('Erro ao buscar medicamentos da API, usando cache local:', error);
    return getProdutos();
  }
}

async function apiGetMedicamentoById(id) {
  if (!API_CONFIG.USE_API) return getProdutoById(id);

  try {
    return await apiRequest(`/medicamentos/${id}/`);
  } catch (error) {
    showError('Erro ao buscar medicamento, usando cache local:', error);
    return getProdutoById(id);
  }
}

async function apiCreateMedicamento(medicamento) {
  if (!API_CONFIG.USE_API) return addProduto(medicamento);

  try {
    const data = await apiRequest('/medicamentos/', {
      method: 'POST',
      body: JSON.stringify(medicamento),
    });
    showSuccess('Medicamento criado com sucesso!');
    return data;
  } catch (error) {
    showError('Erro ao criar medicamento na API, salvando localmente:', error);
    return addProduto(medicamento);
  }
}

async function apiUpdateMedicamento(id, medicamento) {
  if (!API_CONFIG.USE_API) return updateProduto(id, medicamento);

  try {
    const data = await apiRequest(`/medicamentos/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(medicamento),
    });
    showSuccess('Medicamento atualizado com sucesso!');
    return data;
  } catch (error) {
    showError(
      'Erro ao atualizar medicamento na API, salvando localmente:',
      error
    );
    return updateProduto(id, medicamento);
  }
}

async function apiDeleteMedicamento(id) {
  if (!API_CONFIG.USE_API) return deleteProduto(id);

  try {
    await apiRequest(`/medicamentos/${id}/`, { method: 'DELETE' });
    showSuccess('Medicamento deletado com sucesso!');
    return true;
  } catch (error) {
    showError(
      'Erro ao deletar medicamento na API, deletando localmente:',
      error
    );
    return deleteProduto(id);
  }
}

// ========================================
// FORNECEDORES
// ========================================

async function apiGetFornecedores() {
  if (!API_CONFIG.USE_API) return getFornecedores();

  try {
    const data = await apiRequest('/fornecedores/');
    const list = normalizeListResponse(data);
    console.log('🏢 Fornecedores carregados da API:', list.length);
    return list;
  } catch (error) {
    showError('Erro ao buscar fornecedores da API, usando cache local:', error);
    return getFornecedores();
  }
}

async function apiCreateFornecedor(fornecedor) {
  if (!API_CONFIG.USE_API) return addFornecedor(fornecedor);

  try {
    const data = await apiRequest('/fornecedores/', {
      method: 'POST',
      body: JSON.stringify(fornecedor),
    });
    showSuccess('Fornecedor criado com sucesso!');
    return data;
  } catch (error) {
    showError('Erro ao criar fornecedor na API, salvando localmente:', error);
    return addFornecedor(fornecedor);
  }
}

async function apiUpdateFornecedor(id, fornecedor) {
  if (!API_CONFIG.USE_API) return updateFornecedor(id, fornecedor);

  try {
    const data = await apiRequest(`/fornecedores/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(fornecedor),
    });
    showSuccess('Fornecedor atualizado com sucesso!');
    return data;
  } catch (error) {
    showError(
      'Erro ao atualizar fornecedor na API, salvando localmente:',
      error
    );
    return updateFornecedor(id, fornecedor);
  }
}

async function apiDeleteFornecedor(id) {
  if (!API_CONFIG.USE_API) return deleteFornecedor(id);

  try {
    await apiRequest(`/fornecedores/${id}/`, { method: 'DELETE' });
    showSuccess('Fornecedor deletado com sucesso!');
    return true;
  } catch (error) {
    showError(
      'Erro ao deletar fornecedor na API, deletando localmente:',
      error
    );
    return deleteFornecedor(id);
  }
}

// ========================================
// TESTE DE CONEXÃO
// ========================================

async function testarConexaoAPI() {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/medicamentos/`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error(`Status ${response.status}`);

    const data = await response.json();
    const list = normalizeListResponse(data);

    console.log('✅ API Django CONECTADA!');
    console.log(`📦 Total de medicamentos no backend: ${list.length}`);
    API_CONFIG.USE_API = true;
    return true;
  } catch (error) {
    console.warn('⚠️ API Django não está disponível:', error.message);
    console.log('💾 Usando localStorage como fallback');
    API_CONFIG.USE_API = false;
    return false;
  }
}

// ========================================
// INICIALIZAÇÃO
// ========================================

if (typeof window !== 'undefined') {
  testarConexaoAPI();
}
