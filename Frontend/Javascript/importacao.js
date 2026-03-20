(() => {
  const elTipo = document.getElementById('tipoImport');
  const elFile = document.getElementById('fileInput');
  const elDz = document.getElementById('dropzone');
  const elDzName = document.getElementById('dropzoneFileName');

  const elChkAtualizar = document.getElementById('chkAtualizar');
  const elChkSomenteAtivos = document.getElementById('chkSomenteAtivos');

  const btnLimpar = document.getElementById('btnLimpar');
  const btnValidar = document.getElementById('btnValidar');
  const btnAplicar = document.getElementById('btnAplicar');

  const elLog = document.getElementById('log');
  const elPreviewHead = document.getElementById('previewHead');
  const elPreviewBody = document.getElementById('previewBody');

  const kpiArquivo = document.getElementById('kpiArquivo');
  const kpiLinhas = document.getElementById('kpiLinhas');
  const kpiProntas = document.getElementById('kpiProntas');
  const kpiErros = document.getElementById('kpiErros');

  const pillStatus = document.getElementById('pillStatus');
  const pillTipo = document.getElementById('pillTipo');
  const pillPreview = document.getElementById('pillPreview');

  let arquivoAtual = null;
  let linhasLidas = [];
  let resultadoValidacao = null;

  document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacao();

    logInfo('Aguardando arquivo…');
    setPill(pillStatus, 'Aguardando arquivo…');
    setPill(pillTipo, `Tipo: ${labelTipo(elTipo?.value)}`);

    if (btnValidar) btnValidar.disabled = true;
    if (btnAplicar) btnAplicar.disabled = true;

    elTipo?.addEventListener('change', () => {
      setPill(pillTipo, `Tipo: ${labelTipo(elTipo.value)}`);
      resultadoValidacao = null;

      if (btnAplicar) btnAplicar.disabled = true;
      if (btnValidar) btnValidar.disabled = linhasLidas.length === 0;

      if (linhasLidas.length) {
        validarEPreview();
      }
    });

    elFile?.addEventListener('change', async () => {
      arquivoAtual = elFile.files?.[0] || null;
      if (!arquivoAtual) return;

      if (elDzName) {
        elDzName.textContent = arquivoAtual.name;
        elDzName.style.display = 'block';
      }

      if (kpiArquivo) {
        kpiArquivo.textContent =
          arquivoAtual.name.length > 16
            ? arquivoAtual.name.slice(0, 14) + '…'
            : arquivoAtual.name;
      }

      setPill(pillStatus, 'Arquivo carregado');
      logOk(`Arquivo selecionado: ${arquivoAtual.name}`);

      try {
        linhasLidas = await lerArquivoParaLinhas(arquivoAtual);
        atualizarKPIsBasicos();

        if (btnValidar) btnValidar.disabled = linhasLidas.length === 0;
        if (btnAplicar) btnAplicar.disabled = true;
        resultadoValidacao = null;

        if (!linhasLidas.length) {
          logWarn('Nenhuma linha foi lida do arquivo.');
          renderPreviewVazio('Nenhum registro encontrado no arquivo.');
        } else {
          logInfo(`Linhas lidas: ${linhasLidas.length}`);
          renderPreviewBruta(linhasLidas);
          validarEPreview();
        }
      } catch (err) {
        console.warn(err);
        linhasLidas = [];
        atualizarKPIsBasicos();

        if (btnValidar) btnValidar.disabled = true;
        if (btnAplicar) btnAplicar.disabled = true;

        resultadoValidacao = null;

        logError(
          `Falha ao ler arquivo: ${err?.message || 'erro desconhecido'}`
        );
        renderPreviewVazio('Falha ao ler o arquivo.');
      }

      if (typeof lucide !== 'undefined') lucide.createIcons();
    });

    btnLimpar?.addEventListener('click', limparTudo);
    btnValidar?.addEventListener('click', validarEPreview);
    btnAplicar?.addEventListener('click', aplicarImportacao);

    if (elDz) {
      elDz.addEventListener('dragover', (e) => {
        e.preventDefault();
        elDz.classList.add('drag-over');
      });

      elDz.addEventListener('dragleave', () => {
        elDz.classList.remove('drag-over');
      });

      elDz.addEventListener('drop', (e) => {
        e.preventDefault();
        elDz.classList.remove('drag-over');

        if (e.dataTransfer?.files?.length) {
          const arquivo = e.dataTransfer.files[0];
          const nome = (arquivo.name || '').toLowerCase();

          if (
            !nome.endsWith('.csv') &&
            !nome.endsWith('.xlsx') &&
            !nome.endsWith('.xls')
          ) {
            alert('Formato não suportado. Use apenas CSV ou Excel.');
            return;
          }

          elFile.files = e.dataTransfer.files;
          elFile.dispatchEvent(new Event('change'));
        }
      });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  function verificarAutenticacao() {
    const currentUser =
      typeof getCurrentUser === 'function' ? getCurrentUser() : null;

    if (!currentUser) {
      window.location.href = '../html/index.html';
      return;
    }

    const el = document.getElementById('userName');
    if (el) el.textContent = currentUser.nome || 'Usuário';
  }

  async function lerArquivoParaLinhas(file) {
    const name = (file.name || '').toLowerCase();

    if (name.endsWith('.csv')) {
      const text = await file.text();
      return parseCSV(text);
    }

    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      if (typeof XLSX === 'undefined') {
        throw new Error('XLSX (SheetJS) não carregado no HTML.');
      }

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });

      const todasLinhas = [];

      wb.SheetNames.forEach((sheetName) => {
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (Array.isArray(json) && json.length) {
          json.forEach((linha) => {
            todasLinhas.push({
              __aba: sheetName,
              ...linha,
            });
          });
        }
      });

      return todasLinhas;
    }

    throw new Error('Formato não suportado. Use .csv, .xlsx ou .xls');
  }

  function parseCSV(text) {
    const lines = String(text || '')
      .replace(/\r/g, '')
      .split('\n')
      .filter((l) => l.trim().length);

    if (!lines.length) return [];

    const sep = detectCSVSeparator(lines[0]);
    const headers = splitCSVLine(lines[0], sep).map((h) => h.trim());

    const out = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i], sep);
      const row = {};

      headers.forEach((h, idx) => {
        row[h] = (cols[idx] ?? '').trim();
      });

      out.push(row);
    }

    return out;
  }

  function detectCSVSeparator(headerLine) {
    const semi = (headerLine.match(/;/g) || []).length;
    const comma = (headerLine.match(/,/g) || []).length;
    return semi >= comma ? ';' : ',';
  }

  function splitCSVLine(line, sep) {
    const s = String(line ?? '');
    const res = [];
    let cur = '';
    let inQ = false;

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];

      if (ch === '"') {
        if (inQ && s[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
        continue;
      }

      if (!inQ && ch === sep) {
        res.push(cur);
        cur = '';
        continue;
      }

      cur += ch;
    }

    res.push(cur);
    return res;
  }

  function validarEPreview() {
    if (!linhasLidas.length) {
      alert('Carregue um arquivo primeiro.');
      return;
    }

    const tipo = elTipo?.value || 'medicamentos';
    const somenteAtivos = !!elChkSomenteAtivos?.checked;

    const normalizedRows = [];
    const okRows = [];
    const errRows = [];
    const errors = [];

    linhasLidas.forEach((raw, idx) => {
      const norm = normalizarLinha(raw, tipo);

      if (somenteAtivos) {
        const ativo = inferirAtivo(norm, raw);
        if (ativo === false) return;
      }

      const val = validarLinha(norm, tipo);
      normalizedRows.push(norm);

      if (val.ok) {
        okRows.push(norm);
      } else {
        errRows.push(norm);
        errors.push({ linha: idx + 1, erros: val.erros, raw });
      }
    });

    resultadoValidacao = { okRows, errRows, normalizedRows, errors };

    atualizarKPIsBasicos();

    if (kpiProntas) kpiProntas.textContent = String(okRows.length);
    if (kpiErros) kpiErros.textContent = String(errors.length);

    if (errors.length) {
      setPill(pillStatus, 'Há erros de validação', 'warn');
      logWarn(`Validação: ${errors.length} linha(s) com erro.`);

      errors.slice(0, 8).forEach((e) => {
        logError(`Linha ${e.linha}: ${e.erros.join(' | ')}`);
      });
    } else {
      setPill(pillStatus, 'Validação OK', 'ok');
      logOk(`Validação OK. Prontas para aplicar: ${okRows.length}`);
    }

    renderPreviewNormalizada(tipo, okRows, errors);

    if (btnAplicar) btnAplicar.disabled = okRows.length === 0;

    if (pillPreview) {
      pillPreview.style.display = 'inline-flex';
      pillPreview.className =
        'pill ' + (errors.length ? 'status-warn' : 'status-ok');
      pillPreview.textContent = errors.length
        ? `Prévia: ${okRows.length} ok / ${errors.length} erro(s)`
        : `Prévia: ${okRows.length} ok`;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function normalizarLinha(raw, tipo) {
    const obj = {};
    const map = getMapColunas(tipo);

    const rawKeys = Object.keys(raw || {});
    const idx = {};

    rawKeys.forEach((k) => {
      idx[normalizeKey(k)] = k;
    });

    Object.entries(map).forEach(([dest, aliases]) => {
      const found = aliases.find((a) => idx[normalizeKey(a)]);
      if (found) obj[dest] = raw[idx[normalizeKey(found)]];
    });

    const valoresTexto = Object.values(raw || {})
      .map((v) => String(v ?? '').trim())
      .filter(
        (v) =>
          v && v !== '-' && v.toLowerCase() !== 'ok' && v.toLowerCase() !== 'nt'
      );

    const textoPrincipal =
      obj.nome ||
      obj.medicamento ||
      raw.nome ||
      raw.Nome ||
      raw.produto ||
      raw.Produto ||
      raw.item ||
      raw.Item ||
      raw.descricao ||
      raw.Descricao ||
      raw.descrição ||
      raw.Descrição ||
      valoresTexto[0] ||
      '';

    if (!obj.nome) obj.nome = textoPrincipal;
    if (!obj.medicamento) obj.medicamento = textoPrincipal;
    if (!obj.id && raw.id) obj.id = raw.id;

    Object.keys(obj).forEach((k) => {
      if (typeof obj[k] === 'string') obj[k] = obj[k].trim();
    });

    if (tipo === 'medicamentos') {
      obj.stock_atual = isFiniteNumber(toInt(obj.stock_atual))
        ? toInt(obj.stock_atual)
        : 0;
      obj.stock_minimo = isFiniteNumber(toInt(obj.stock_minimo))
        ? toInt(obj.stock_minimo)
        : 0;
      obj.preco = isFiniteNumber(toFloat(obj.preco)) ? toFloat(obj.preco) : 0;
      obj.ativo = inferirAtivo(obj, raw);

      if (!obj.unidade) obj.unidade = 'un';
      if (!obj.categoria) obj.categoria = 'outros';

      if (!obj.descricao) {
        obj.descricao =
          raw.descricao ||
          raw.Descricao ||
          raw.descrição ||
          raw.Descrição ||
          '';
      }

      if (!obj.vencimento) obj.vencimento = '';
      if (!obj.lote) obj.lote = '';
    }

    if (tipo === 'fornecedores') {
      obj.ativo = inferirAtivo(obj, raw);
      if (!obj.nome) obj.nome = textoPrincipal;
    }

    if (tipo === 'entradas') {
      obj.quantidade = isFiniteNumber(toInt(obj.quantidade))
        ? toInt(obj.quantidade)
        : 0;
      if (!obj.medicamento) obj.medicamento = textoPrincipal;
      if (!obj.data) obj.data = new Date().toISOString().slice(0, 10);
      if (!obj.fornecedor) obj.fornecedor = '';
      if (!obj.observacao) obj.observacao = '';
    }

    if (tipo === 'saidas') {
      obj.quantidade = isFiniteNumber(toInt(obj.quantidade))
        ? toInt(obj.quantidade)
        : 0;
      if (!obj.medicamento) obj.medicamento = textoPrincipal;
      if (!obj.data) obj.data = new Date().toISOString().slice(0, 10);
      if (!obj.destino) obj.destino = '';
      if (!obj.responsavel) obj.responsavel = '';
    }

    return obj;
  }

  function validarLinha(row, tipo) {
    const valores = Object.values(row || {})
      .map((v) => String(v ?? '').trim())
      .filter((v) => v !== '');

    if (!valores.length) {
      return { ok: false, erros: ['Linha vazia'] };
    }

    const textoLinha = valores.join(' ').toLowerCase();

    if (
      textoLinha.includes('soma total') ||
      textoLinha.includes('total geral') ||
      textoLinha.includes('valor total')
    ) {
      return { ok: false, erros: ['Linha de resumo/total'] };
    }

    if (tipo === 'medicamentos') {
      if (!row.nome) {
        row.nome = `Item importado ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      }
      if (!row.categoria) row.categoria = 'outros';
      if (!row.unidade) row.unidade = 'un';
      if (!row.descricao) row.descricao = '';
      if (!row.lote) row.lote = '';
      if (!row.vencimento) row.vencimento = '';
      if (!isFiniteNumber(row.stock_atual)) row.stock_atual = 0;
      if (!isFiniteNumber(row.stock_minimo)) row.stock_minimo = 0;
      if (!isFiniteNumber(row.preco)) row.preco = 0;
      if (typeof row.ativo === 'undefined') row.ativo = true;
    }

    if (tipo === 'fornecedores') {
      if (!row.nome) {
        row.nome = `Fornecedor importado ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      }
      if (typeof row.ativo === 'undefined') row.ativo = true;
      if (!row.cnpj) row.cnpj = '';
      if (!row.telefone) row.telefone = '';
      if (!row.email) row.email = '';
    }

    if (tipo === 'entradas') {
      if (!row.medicamento) {
        row.medicamento = `Entrada importada ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      }
      if (!isFiniteNumber(row.quantidade)) row.quantidade = 0;
      if (!row.fornecedor) row.fornecedor = '';
      if (!row.data) row.data = new Date().toISOString().slice(0, 10);
      if (!row.observacao) row.observacao = '';
    }

    if (tipo === 'saidas') {
      if (!row.medicamento) {
        row.medicamento = `Saída importada ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      }
      if (!isFiniteNumber(row.quantidade)) row.quantidade = 0;
      if (!row.destino) row.destino = '';
      if (!row.data) row.data = new Date().toISOString().slice(0, 10);
      if (!row.responsavel) row.responsavel = '';
    }

    return { ok: true, erros: [] };
  }

  function renderPreviewBruta(rows) {
    const sample = rows.slice(0, 30);
    const cols = Object.keys(sample[0] || {});

    renderTable(
      cols,
      sample.map((r) => cols.map((c) => r[c]))
    );
  }

  function renderPreviewNormalizada(tipo, okRows, errors) {
    const sample = okRows.slice(0, 30);
    const cols = previewCols(tipo);

    if (!sample.length) {
      renderPreviewVazio(
        errors.length ? 'Há erros — corrija o arquivo.' : 'Nada para importar.'
      );
      return;
    }

    renderTable(
      cols,
      sample.map((r) => cols.map((c) => r[c] ?? ''))
    );
  }

  function renderPreviewVazio(msg) {
    elPreviewHead.innerHTML = '';
    elPreviewBody.innerHTML = `
      <tr>
        <td class="muted" style="padding:16px;color:var(--gray-500)">${escapeHTML(
          msg
        )}</td>
      </tr>`;
  }

  function renderTable(cols, rows) {
    elPreviewHead.innerHTML = `
      <tr>
        ${cols.map((c) => `<th>${escapeHTML(c)}</th>`).join('')}
      </tr>`;

    elPreviewBody.innerHTML = rows
      .map(
        (r) => `
      <tr>
        ${r.map((v) => `<td>${escapeHTML(v)}</td>`).join('')}
      </tr>`
      )
      .join('');
  }

  function previewCols(tipo) {
    if (tipo === 'fornecedores') {
      return ['nome', 'cnpj', 'telefone', 'email', 'ativo'];
    }

    if (tipo === 'medicamentos') {
      return [
        'nome',
        'descricao',
        'miligrama',
        'unidade',
        'categoria',
        'stock_atual',
        'stock_minimo',
        'preco',
        'vencimento',
        'ativo',
      ];
    }

    if (tipo === 'entradas') {
      return ['medicamento', 'quantidade', 'fornecedor', 'data', 'observacao'];
    }

    if (tipo === 'saidas') {
      return ['medicamento', 'quantidade', 'destino', 'data', 'responsavel'];
    }

    return Object.keys(linhasLidas[0] || {});
  }

  function aplicarImportacao() {
    if (!resultadoValidacao?.okRows?.length) {
      alert('Valide o arquivo antes de aplicar.');
      return;
    }

    const tipo = elTipo?.value || 'medicamentos';
    const atualizar = !!elChkAtualizar?.checked;
    const okRows = resultadoValidacao.okRows;

    try {
      const applied = salvarNoStorage(tipo, okRows, atualizar);

      setPill(pillStatus, 'Importação aplicada', 'ok');
      logOk(`Importação aplicada: ${applied} registro(s).`);

      if (btnAplicar) btnAplicar.disabled = true;
    } catch (err) {
      console.warn(err);
      setPill(pillStatus, 'Falha ao aplicar', 'bad');
      logError(`Falha ao aplicar: ${err?.message || 'erro desconhecido'}`);
      alert('Falha ao aplicar importação. Veja o log.');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function salvarNoStorage(tipo, rows, atualizar) {
    if (tipo === 'medicamentos') {
      return upsertLista(tipo, rows, atualizar, ['sku', 'nome']);
    }

    if (tipo === 'fornecedores') {
      return upsertLista(tipo, rows, atualizar, ['cnpj', 'nome']);
    }

    if (tipo === 'entradas' || tipo === 'saidas') {
      return appendLista(tipo, rows);
    }

    return 0;
  }

  function upsertLista(tipo, rows, atualizar, keysPreferidas) {
    const { getFn, addFn, updateFn, keyLS } = storageAdapter(tipo);
    const lista = getFn();

    let count = 0;

    rows.forEach((r) => {
      const match = acharExistente(lista, r, keysPreferidas);

      if (match && atualizar) {
        if (updateFn) {
          updateFn(match.id, r);
        } else {
          const idx = lista.findIndex((x) => Number(x.id) === Number(match.id));
          if (idx >= 0) {
            lista[idx] = {
              ...lista[idx],
              ...r,
              atualizadoEm: new Date().toISOString(),
            };
          }
        }
        count++;
        return;
      }

      if (!match) {
        if (addFn) {
          addFn({
            ...r,
            id: r.id
              ? Number(r.id)
              : Date.now() + Math.floor(Math.random() * 1000),
            criadoEm: new Date().toISOString(),
          });
        } else {
          lista.push({
            ...r,
            id: r.id
              ? Number(r.id)
              : Date.now() + Math.floor(Math.random() * 1000),
            criadoEm: new Date().toISOString(),
          });
        }
        count++;
      }
    });

    if (!addFn || !updateFn) {
      localStorage.setItem(keyLS, JSON.stringify(lista));
    }

    return count;
  }

  function appendLista(tipo, rows) {
    const { addFn, keyLS } = storageAdapter(tipo);
    const lista = safeGet(keyLS);

    rows.forEach((r) => {
      const item = {
        id: r.id ? Number(r.id) : Date.now() + Math.floor(Math.random() * 1000),
        ...r,
        tipo: tipo === 'entradas' ? 'entrada' : 'saida',
        criadoEm: new Date().toISOString(),
      };

      if (!item.medicamento && item.nome) {
        item.medicamento = item.nome;
      }

      if (addFn) {
        addFn(item);
      } else {
        lista.push(item);
      }
    });

    if (!addFn) {
      localStorage.setItem(keyLS, JSON.stringify(lista));
    }

    return rows.length;
  }

  function acharExistente(lista, row, keysPreferidas) {
    if (!Array.isArray(lista) || !lista.length) return null;

    if (row.id != null && row.id !== '') {
      const idNum = Number(row.id);
      const found = lista.find((x) => Number(x.id) === idNum);
      if (found) return found;
    }

    for (const k of keysPreferidas) {
      const v = (row[k] || '').toString().trim().toLowerCase();
      if (!v) continue;

      const found = lista.find(
        (x) => (x?.[k] || '').toString().trim().toLowerCase() === v
      );

      if (found) return found;
    }

    return null;
  }

  function storageAdapter(tipo) {
    if (tipo === 'medicamentos') {
      return {
        getFn: () =>
          typeof getProdutos === 'function'
            ? getProdutos()
            : safeGet('farm_produtos'),
        addFn: typeof addProduto === 'function' ? addProduto : null,
        updateFn: typeof updateProduto === 'function' ? updateProduto : null,
        keyLS: 'farm_produtos',
      };
    }

    if (tipo === 'fornecedores') {
      return {
        getFn: () =>
          typeof getFornecedores === 'function'
            ? getFornecedores()
            : safeGet('farm_fornecedores'),
        addFn: typeof addFornecedor === 'function' ? addFornecedor : null,
        updateFn:
          typeof updateFornecedor === 'function' ? updateFornecedor : null,
        keyLS: 'farm_fornecedores',
      };
    }

    if (tipo === 'entradas') {
      return {
        getFn: () =>
          typeof getEntradas === 'function'
            ? getEntradas()
            : safeGet('farm_movimentacoes').filter((m) => m.tipo === 'entrada'),
        addFn: typeof addEntrada === 'function' ? addEntrada : null,
        updateFn: null,
        keyLS: 'farm_movimentacoes',
      };
    }

    if (tipo === 'saidas') {
      return {
        getFn: () =>
          typeof getSaidas === 'function'
            ? getSaidas()
            : safeGet('farm_movimentacoes').filter((m) => m.tipo === 'saida'),
        addFn: typeof addSaida === 'function' ? addSaida : null,
        updateFn: null,
        keyLS: 'farm_movimentacoes',
      };
    }

    return {
      getFn: () => [],
      addFn: null,
      updateFn: null,
      keyLS: 'farm_unknown',
    };
  }

  function safeGet(key) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function getMapColunas(tipo) {
    if (tipo === 'fornecedores') {
      return {
        id: ['id', 'codigo', 'código'],
        nome: [
          'nome',
          'fornecedor',
          'razao social',
          'razão social',
          'empresa',
          'descricao',
          'descrição',
        ],
        cnpj: ['cnpj'],
        telefone: ['telefone', 'fone', 'celular', 'contato'],
        email: ['email', 'e-mail'],
        ativo: ['ativo', 'status'],
      };
    }

    if (tipo === 'medicamentos') {
      return {
        id: ['id', 'codigo', 'código', 'item'],
        sku: ['sku', 'codigo sku', 'código sku'],
        nome: [
          'nome',
          'medicamento',
          'produto',
          'item',
          'descricao',
          'descrição',
          'descrição produto',
          'material',
        ],
        categoria: ['categoria', 'classe', 'grupo', 'tipo'],
        lote: ['lote'],
        vencimento: [
          'vencimento',
          'validade',
          'data validade',
          'data de validade',
        ],
        stock_atual: [
          'estoque',
          'stock_atual',
          'quantidade',
          'qtd',
          'est. atual',
          'estoque atual',
          'saldo',
        ],
        stock_minimo: [
          'estoque minimo',
          'estoque mínimo',
          'stock_minimo',
          'mínimo',
          'minimo',
          'necessidade',
        ],
        preco: [
          'preco',
          'preço',
          'valor',
          'valor unit',
          'valor unitario',
          'valor unitário',
          'custo',
          'valor unt',
        ],
        unidade: [
          'unidade',
          'un',
          'und',
          'medida',
          'apresentação',
          'apresentacao',
        ],
        descricao: [
          'descricao',
          'descrição',
          'observacao',
          'observação',
          'descrição produto',
        ],
        ativo: ['ativo', 'status'],
        miligrama: ['miligrama', 'mg', 'dosagem'],
      };
    }

    if (tipo === 'entradas') {
      return {
        id: ['id', 'codigo', 'código', 'item'],
        medicamento: [
          'medicamento',
          'nome',
          'produto',
          'item',
          'descricao',
          'descrição',
          'descrição produto',
          'material',
        ],
        quantidade: [
          'quantidade',
          'qtd',
          'necessidade',
          'nec',
          'saldo',
          'estoque',
        ],
        fornecedor: ['fornecedor', 'origem'],
        data: ['data', 'data entrada', 'data de entrada'],
        observacao: ['observacao', 'observação', 'motivo', 'obs'],
      };
    }

    return {
      id: ['id', 'codigo', 'código', 'item'],
      medicamento: [
        'medicamento',
        'nome',
        'produto',
        'item',
        'descricao',
        'descrição',
        'descrição produto',
        'material',
      ],
      quantidade: [
        'quantidade',
        'qtd',
        'necessidade',
        'nec',
        'saldo',
        'estoque',
      ],
      destino: ['destino', 'motivo', 'setor', 'saida', 'saída'],
      data: ['data', 'data saida', 'data saída', 'data de saída'],
      responsavel: ['responsavel', 'responsável', 'usuario', 'usuário'],
    };
  }

  function normalizeKey(s) {
    return String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  function inferirAtivo(norm, raw) {
    const v =
      norm?.ativo ??
      raw?.ativo ??
      raw?.status ??
      raw?.Ativo ??
      raw?.Status ??
      '';

    const s = String(v).trim().toLowerCase();
    if (!s) return true;

    if (['0', 'false', 'inativo', 'nao', 'não'].includes(s)) return false;
    if (['1', 'true', 'ativo', 'sim'].includes(s)) return true;
    return true;
  }

  function atualizarKPIsBasicos() {
    if (kpiLinhas) kpiLinhas.textContent = String(linhasLidas.length || 0);

    const ok = resultadoValidacao?.okRows?.length ?? 0;
    const err = resultadoValidacao?.errors?.length ?? 0;

    if (kpiProntas) kpiProntas.textContent = String(ok);
    if (kpiErros) kpiErros.textContent = String(err);
  }

  function setPill(el, text, status) {
    if (!el) return;
    el.className = 'pill';
    if (status === 'ok') el.classList.add('status-ok');
    if (status === 'warn') el.classList.add('status-warn');
    if (status === 'bad') el.classList.add('status-bad');
    el.innerHTML = escapeHTML(text);
  }

  function limparTudo() {
    arquivoAtual = null;
    linhasLidas = [];
    resultadoValidacao = null;

    if (elFile) elFile.value = '';
    if (elDzName) {
      elDzName.textContent = '';
      elDzName.style.display = 'none';
    }

    if (kpiArquivo) kpiArquivo.textContent = '—';
    if (kpiLinhas) kpiLinhas.textContent = '0';
    if (kpiProntas) kpiProntas.textContent = '0';
    if (kpiErros) kpiErros.textContent = '0';

    if (btnValidar) btnValidar.disabled = true;
    if (btnAplicar) btnAplicar.disabled = true;

    setPill(pillStatus, 'Aguardando arquivo…');
    setPill(pillTipo, `Tipo: ${labelTipo(elTipo?.value)}`);

    if (pillPreview) {
      pillPreview.style.display = 'none';
      pillPreview.textContent = '';
    }

    logInfo('Limpo. Aguardando novo arquivo…');
    renderPreviewVazio('Nenhum arquivo carregado ainda.');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function labelTipo(v) {
    if (v === 'fornecedores') return 'Fornecedores';
    if (v === 'medicamentos') return 'Medicamentos';
    if (v === 'entradas') return 'Entradas';
    if (v === 'saidas') return 'Saídas';
    return '—';
  }

  function logOk(msg) {
    appendLog('log-ok', msg);
  }

  function logWarn(msg) {
    appendLog('log-warn', msg);
  }

  function logError(msg) {
    appendLog('log-error', msg);
  }

  function logInfo(msg) {
    appendLog('log-info', msg);
  }

  function appendLog(cls, msg) {
    if (!elLog) return;
    const time = new Date().toLocaleTimeString('pt-BR');
    const line = `<span class="${cls}">[${time}] ${escapeHTML(msg)}</span>`;
    const current = elLog.innerHTML.includes('// Log') ? '' : elLog.innerHTML;
    elLog.innerHTML = (current ? current + '\n' : '') + line;
    elLog.scrollTop = elLog.scrollHeight;
  }

  function toInt(v) {
    if (v == null || String(v).trim() === '') return NaN;

    const s = String(v)
      .trim()
      .replace(/[^\d-]/g, '');

    if (!s) return NaN;

    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : NaN;
  }

  function toFloat(v) {
    if (v == null) return NaN;

    const s = String(v).trim();
    const normalized =
      s.includes(',') && !s.includes('.')
        ? s.replace(',', '.')
        : s.replace(/\./g, '').replace(',', '.');

    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : NaN;
  }

  function isFiniteNumber(n) {
    return typeof n === 'number' && Number.isFinite(n);
  }

  function escapeHTML(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
