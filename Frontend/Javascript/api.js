const API_CONFIG = {
  BASE_URL: 'https://gestmed.onrender.com/api',
  TIMEOUT: 10000,
  USE_API: true,
};

function showError(message, error) {
  console.error(message, error);
}

function showSuccess(message) {
  console.log('✅', message);
}

function normalizeListResponse(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

function hasFn(name) {
  return typeof window !== 'undefined' && typeof window[name] === 'function';
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

    if (defaultOptions.method === 'DELETE') {
      return { success: true };
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Timeout: o servidor demorou muito para responder.');
    }
    throw error;
  }
}

async function apiGetMedicamentos() {
  if (!API_CONFIG.USE_API) {
    return hasFn('getProdutos') ? getProdutos() : [];
  }

  try {
    const data = await apiRequest('/medicamentos/');
    const list = normalizeListResponse(data);
    showSuccess(`Medicamentos carregados da API: ${list.length}`);
    return list;
  } catch (error) {
    showError(
      'Erro ao buscar medicamentos da API. Usando fallback local.',
      error
    );
    return hasFn('getProdutos') ? getProdutos() : [];
  }
}

async function apiGetMedicamentoById(id) {
  if (!API_CONFIG.USE_API) {
    return hasFn('getProdutoById') ? getProdutoById(id) : null;
  }

  try {
    return await apiRequest(`/medicamentos/${id}/`);
  } catch (error) {
    showError(
      'Erro ao buscar medicamento na API. Usando fallback local.',
      error
    );
    return hasFn('getProdutoById') ? getProdutoById(id) : null;
  }
}

async function apiCreateMedicamento(medicamento) {
  if (!API_CONFIG.USE_API) {
    return hasFn('addProduto') ? addProduto(medicamento) : null;
  }

  try {
    const data = await apiRequest('/medicamentos/', {
      method: 'POST',
      body: JSON.stringify(medicamento),
    });
    showSuccess('Medicamento criado com sucesso!');
    return data;
  } catch (error) {
    showError(
      'Erro ao criar medicamento na API. Usando fallback local.',
      error
    );
    return hasFn('addProduto') ? addProduto(medicamento) : null;
  }
}

async function apiUpdateMedicamento(id, medicamento) {
  if (!API_CONFIG.USE_API) {
    return hasFn('updateProduto') ? updateProduto(id, medicamento) : null;
  }

  try {
    const data = await apiRequest(`/medicamentos/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(medicamento),
    });
    showSuccess('Medicamento atualizado com sucesso!');
    return data;
  } catch (error) {
    showError(
      'Erro ao atualizar medicamento na API. Usando fallback local.',
      error
    );
    return hasFn('updateProduto') ? updateProduto(id, medicamento) : null;
  }
}

async function apiDeleteMedicamento(id) {
  if (!API_CONFIG.USE_API) {
    return hasFn('deleteProduto') ? deleteProduto(id) : false;
  }

  try {
    await apiRequest(`/medicamentos/${id}/`, { method: 'DELETE' });
    showSuccess('Medicamento deletado com sucesso!');
    return true;
  } catch (error) {
    showError(
      'Erro ao deletar medicamento na API. Usando fallback local.',
      error
    );
    return hasFn('deleteProduto') ? deleteProduto(id) : false;
  }
}

async function apiGetFornecedores() {
  if (!API_CONFIG.USE_API) {
    return hasFn('getFornecedores') ? getFornecedores() : [];
  }

  try {
    const data = await apiRequest('/fornecedores/');
    const list = normalizeListResponse(data);
    showSuccess(`Fornecedores carregados da API: ${list.length}`);
    return list;
  } catch (error) {
    showError(
      'Erro ao buscar fornecedores da API. Usando fallback local.',
      error
    );
    return hasFn('getFornecedores') ? getFornecedores() : [];
  }
}

async function apiGetFornecedorById(id) {
  if (!API_CONFIG.USE_API) {
    const lista = hasFn('getFornecedores') ? getFornecedores() : [];
    return Array.isArray(lista)
      ? lista.find((f) => Number(f.id) === Number(id)) || null
      : null;
  }

  try {
    return await apiRequest(`/fornecedores/${id}/`);
  } catch (error) {
    showError(
      'Erro ao buscar fornecedor na API. Usando fallback local.',
      error
    );
    const lista = hasFn('getFornecedores') ? getFornecedores() : [];
    return Array.isArray(lista)
      ? lista.find((f) => Number(f.id) === Number(id)) || null
      : null;
  }
}

async function apiCreateFornecedor(fornecedor) {
  if (!API_CONFIG.USE_API) {
    return hasFn('addFornecedor') ? addFornecedor(fornecedor) : null;
  }

  try {
    const data = await apiRequest('/fornecedores/', {
      method: 'POST',
      body: JSON.stringify(fornecedor),
    });
    showSuccess('Fornecedor criado com sucesso!');
    return data;
  } catch (error) {
    showError('Erro ao criar fornecedor na API. Usando fallback local.', error);
    return hasFn('addFornecedor') ? addFornecedor(fornecedor) : null;
  }
}

async function apiUpdateFornecedor(id, fornecedor) {
  if (!API_CONFIG.USE_API) {
    return hasFn('updateFornecedor') ? updateFornecedor(id, fornecedor) : null;
  }

  try {
    const data = await apiRequest(`/fornecedores/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(fornecedor),
    });
    showSuccess('Fornecedor atualizado com sucesso!');
    return data;
  } catch (error) {
    showError(
      'Erro ao atualizar fornecedor na API. Usando fallback local.',
      error
    );
    return hasFn('updateFornecedor') ? updateFornecedor(id, fornecedor) : null;
  }
}

async function apiDeleteFornecedor(id) {
  if (!API_CONFIG.USE_API) {
    return hasFn('deleteFornecedor') ? deleteFornecedor(id) : false;
  }

  try {
    await apiRequest(`/fornecedores/${id}/`, { method: 'DELETE' });
    showSuccess('Fornecedor deletado com sucesso!');
    return true;
  } catch (error) {
    showError(
      'Erro ao deletar fornecedor na API. Usando fallback local.',
      error
    );
    return hasFn('deleteFornecedor') ? deleteFornecedor(id) : false;
  }
}

async function apiGetMovimentacoes() {
  if (!API_CONFIG.USE_API) {
    return hasFn('getMovimentacoes') ? getMovimentacoes() : [];
  }

  try {
    const data = await apiRequest('/movimentacoes/');
    const list = normalizeListResponse(data);
    showSuccess(`Movimentações carregadas da API: ${list.length}`);
    return list;
  } catch (error) {
    showError(
      'Erro ao buscar movimentações da API. Usando fallback local.',
      error
    );
    return hasFn('getMovimentacoes') ? getMovimentacoes() : [];
  }
}

async function apiCreateMovimentacao(movimentacao) {
  if (!API_CONFIG.USE_API) {
    return hasFn('addMovimentacao') ? addMovimentacao(movimentacao) : null;
  }

  try {
    const data = await apiRequest('/movimentacoes/', {
      method: 'POST',
      body: JSON.stringify(movimentacao),
    });
    showSuccess('Movimentação criada com sucesso!');
    return data;
  } catch (error) {
    showError(
      'Erro ao criar movimentação na API. Usando fallback local.',
      error
    );
    return hasFn('addMovimentacao') ? addMovimentacao(movimentacao) : null;
  }
}

async function apiGetRelatorioGeral(dataInicio = '', dataFim = '') {
  if (!API_CONFIG.USE_API) {
    return null;
  }

  try {
    const params = new URLSearchParams();
    if (dataInicio) params.append('data_inicio', dataInicio);
    if (dataFim) params.append('data_fim', dataFim);

    const query = params.toString() ? `?${params.toString()}` : '';
    return await apiRequest(`/movimentacoes/relatorio-geral/${query}`);
  } catch (error) {
    showError('Erro ao buscar relatório geral na API.', error);
    return null;
  }
}

async function apiSolicitarRecuperacaoSenha(email) {
  return await apiRequest('/recuperar-senha/', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

async function apiRedefinirSenha(uid, token, novaSenha) {
  return await apiRequest('/redefinir-senha/', {
    method: 'POST',
    body: JSON.stringify({
      uid,
      token,
      nova_senha: novaSenha,
    }),
  });
}

async function testarConexaoAPI() {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/medicamentos/`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error(`Status ${response.status}`);

    const data = await response.json();
    const list = normalizeListResponse(data);

    console.log('API Django conectada!');
    console.log(`Total de medicamentos no backend: ${list.length}`);
    API_CONFIG.USE_API = true;
    return true;
  } catch (error) {
    console.warn('API Django não está disponível:', error.message);
    console.log('Usando localStorage como fallback');
    API_CONFIG.USE_API = false;
    return false;
  }
}

if (typeof window !== 'undefined') {
  testarConexaoAPI();
}
