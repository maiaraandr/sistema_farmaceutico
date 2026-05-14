(() => {
  const API_BASE_URL = 'https://gestmed.onrender.com/api';

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

    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', () => {
      if (typeof logout === 'function') {
        logout();
        return;
      }
      localStorage.removeItem('farm_current_user');
      localStorage.removeItem('farm_session_token');
      window.location.href = 'index.html';
    });

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
      if (linhasLidas.length) validarEPreview();
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
      if (typeof XLSX === 'undefined')
        throw new Error('XLSX (SheetJS) não carregado no HTML.');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const todasLinhas = [];
      wb.SheetNames.forEach((sheetName) => {
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (Array.isArray(json) && json.length) {
          json.forEach((linha) =>
            todasLinhas.push({ __aba: sheetName, ...linha })
          );
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

  // ── CONVERSÃO DE DATA SERIAL DO EXCEL ──────────────────────────────────────
  // O Excel armazena datas como número de dias desde 1900-01-01.
  // Ex: 46642 → 2027-09-14
  function converterDataExcel(valor) {
    if (!valor && valor !== 0) return '';

    // Se já é um objeto Date (cellDates: true faz isso)
    if (valor instanceof Date) {
      const ano = valor.getFullYear();
      const mes = String(valor.getMonth() + 1).padStart(2, '0');
      const dia = String(valor.getDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
    }

    const v = String(valor).trim();
    if (!v) return '';

    // Formato ISO completo: 2027-09-14T00:00:00.000Z
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      return v.slice(0, 10);
    }

    // Já está no formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

    // DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      const [d, m, a] = v.split('/');
      return `${a}-${m}-${d}`;
    }

    // DD-MM-YYYY
    if (/^\d{2}-\d{2}-\d{4}$/.test(v)) {
      const [d, m, a] = v.split('-');
      return `${a}-${m}-${d}`;
    }

    // Número serial do Excel (sem cellDates)
    const num = parseInt(v, 10);
    if (!isNaN(num) && num > 40000 && num < 60000) {
      const base = new Date(Date.UTC(1899, 11, 30));
      base.setUTCDate(base.getUTCDate() + num);
      const ano = base.getUTCFullYear();
      const mes = String(base.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(base.getUTCDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
    }

    return v;
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
      errors
        .slice(0, 8)
        .forEach((e) => logError(`Linha ${e.linha}: ${e.erros.join(' | ')}`));
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

  // ── APLICAR IMPORTAÇÃO VIA API ─────────────────────────────────────────────

  async function aplicarImportacao() {
    if (!resultadoValidacao?.okRows?.length) {
      alert('Valide o arquivo antes de aplicar.');
      return;
    }

    const tipo = elTipo?.value || 'medicamentos';
    const atualizar = !!elChkAtualizar?.checked;
    const okRows = resultadoValidacao.okRows;

    if (btnAplicar) {
      btnAplicar.disabled = true;
      btnAplicar.textContent = 'Importando...';
    }

    try {
      const applied = await salvarNaAPI(tipo, okRows, atualizar);
      setPill(pillStatus, 'Importação aplicada', 'ok');
      logOk(`Importação aplicada: ${applied} registro(s).`);
    } catch (err) {
      console.warn(err);
      setPill(pillStatus, 'Falha ao aplicar', 'bad');
      logError(`Falha ao aplicar: ${err?.message || 'erro desconhecido'}`);
      alert('Falha ao aplicar importação. Veja o log.');
    } finally {
      if (btnAplicar) {
        btnAplicar.disabled = false;
        btnAplicar.innerHTML = '<i data-lucide="check"></i> Aplicar importação';
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }

  async function salvarNaAPI(tipo, rows, atualizar) {
    let count = 0;

    if (tipo === 'fornecedores') {
      const resp = await fetch(`${API_BASE_URL}/fornecedores/`);
      const existentes = resp.ok ? await resp.json() : [];

      for (const row of rows) {
        const existente = existentes.find(
          (f) =>
            String(f.nome || '')
              .trim()
              .toLowerCase() ===
            String(row.nome || '')
              .trim()
              .toLowerCase()
        );

        const payload = {
          nome: row.nome || '',
          cnpj: row.cnpj || null,
          telefone: row.telefone || null,
          email: row.email || null,
          ativo: row.ativo !== false,
        };

        if (existente && atualizar) {
          await fetch(`${API_BASE_URL}/fornecedores/${existente.id}/`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } else if (!existente) {
          await fetch(`${API_BASE_URL}/fornecedores/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
        count++;
      }
    }

    if (tipo === 'medicamentos') {
      const respF = await fetch(`${API_BASE_URL}/fornecedores/`);
      const fornecedores = respF.ok ? await respF.json() : [];

      const respM = await fetch(`${API_BASE_URL}/medicamentos/`);
      const existentes = respM.ok ? await respM.json() : [];

      for (const row of rows) {
        const fornecedor = fornecedores.find(
          (f) =>
            String(f.nome || '')
              .trim()
              .toLowerCase() ===
            String(row.fornecedor || '')
              .trim()
              .toLowerCase()
        );

        const existente = existentes.find(
          (m) =>
            String(m.nome || '')
              .trim()
              .toLowerCase() ===
            String(row.nome || '')
              .trim()
              .toLowerCase()
        );

        // Compatível com stock_atual ou quantidade no arquivo
        const qtdMed = Number(row.stock_atual || row.quantidade) || 0;
        const valorMed =
          Number(row.valor_unit || row.valor_unitario || row.valor) || 0;
        const dosagemMed = row.dosagem || row.miligrama || null;

        const payload = {
          nome: row.nome || '',
          miligrama: dosagemMed,
          categoria: row.categoria || 'outros',
          lote: row.lote || '',
          validade: row.vencimento || null,
          quantidade: qtdMed,
          valor_unit: valorMed,
          fornecedor: fornecedor ? fornecedor.id : null,
        };

        logInfo(
          `Enviando medicamento: ${payload.nome} | qtd: ${qtdMed} | valor: ${valorMed}`
        );

        let respMed;
        if (existente && atualizar) {
          respMed = await fetch(
            `${API_BASE_URL}/medicamentos/${existente.id}/`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }
          );
        } else if (!existente) {
          respMed = await fetch(`${API_BASE_URL}/medicamentos/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }

        if (respMed && !respMed.ok) {
          const erroMed = await respMed.text();
          logError(
            `Erro ao salvar "${payload.nome}": HTTP ${respMed.status} — ${erroMed}`
          );
        } else if (respMed) {
          logOk(`Medicamento salvo: ${payload.nome}`);
        }
        count++;
      }
    }

    if (tipo === 'entradas') {
      for (const row of rows) {
        // Compatível com colunas "nome" ou "medicamento" no arquivo
        const nomeMed = row.medicamento || row.nome || '';
        // Compatível com valor_unit, valor_unitario ou valor no arquivo
        const valorUnit =
          Number(row.valor_unitario || row.valor_unit || row.valor) || 0;
        // Compatível com miligrama ou dosagem no arquivo
        const dosagem = row.dosagem || row.miligrama || '';

        const payload = {
          tipo: 'E',
          medicamento_nome: nomeMed,
          dosagem: dosagem,
          categoria: row.categoria || '',
          lote: row.lote || '',
          vencimento: row.vencimento || null,
          quantidade: Number(row.quantidade) || 0,
          valor_unitario: valorUnit,
          fornecedor: row.fornecedor || '',
          data_movimentacao:
            row.data_entrada ||
            row.data ||
            new Date().toISOString().slice(0, 10),
        };

        logInfo(
          `Enviando entrada: ${nomeMed} | qtd: ${payload.quantidade} | valor: ${valorUnit}`
        );

        const resposta = await fetch(`${API_BASE_URL}/movimentacoes/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!resposta.ok) {
          const erro = await resposta.text();
          logError(
            `Erro ao salvar "${nomeMed}": HTTP ${resposta.status} — ${erro}`
          );
        } else {
          logOk(`Entrada salva: ${nomeMed}`);
        }
        count++;
      }
    }

    if (tipo === 'saidas') {
      for (const row of rows) {
        const payload = {
          tipo: 'S',
          medicamento_nome: row.medicamento || '',
          quantidade: Number(row.quantidade) || 0,
          destino: row.destino || '',
          data_movimentacao: row.data || new Date().toISOString().slice(0, 10),
        };

        await fetch(`${API_BASE_URL}/movimentacoes/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        count++;
      }
    }

    return count;
  }

  // ── NORMALIZAÇÃO ───────────────────────────────────────────────────────────

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
      valoresTexto[0] ||
      '';

    if (!obj.nome) obj.nome = textoPrincipal;
    if (!obj.medicamento) obj.medicamento = textoPrincipal;
    if (!obj.id && raw.id) obj.id = raw.id;

    Object.keys(obj).forEach((k) => {
      if (typeof obj[k] === 'string') obj[k] = obj[k].trim();
    });

    // ── MEDICAMENTOS ──
    if (tipo === 'medicamentos') {
      obj.stock_atual = isFiniteNumber(toInt(obj.stock_atual))
        ? toInt(obj.stock_atual)
        : 0;
      obj.valor = isFiniteNumber(toFloat(obj.valor)) ? toFloat(obj.valor) : 0;
      obj.ativo = inferirAtivo(obj, raw);
      if (!obj.categoria) obj.categoria = 'outros';
      if (!obj.dosagem) obj.dosagem = '';
      if (!obj.lote) obj.lote = '';
      if (!obj.fornecedor) obj.fornecedor = '';
      // Converte data serial do Excel para formato legível
      obj.vencimento = converterDataExcel(obj.vencimento || '');
    }

    // ── FORNECEDORES ──
    if (tipo === 'fornecedores') {
      obj.ativo = inferirAtivo(obj, raw);
      if (!obj.nome) obj.nome = textoPrincipal;
    }

    // ── ENTRADAS ──
    if (tipo === 'entradas') {
      obj.quantidade = isFiniteNumber(toInt(obj.quantidade))
        ? toInt(obj.quantidade)
        : 0;

      // Fallback: varre todas as colunas do raw buscando campo de valor caso o
      // mapeamento principal não tenha casado (ex: coluna chamada "Valor Unitario")
      if (!obj.valor_unitario) {
        const rawKeys2 = Object.keys(raw || {});
        for (const k of rawKeys2) {
          const kn = normalizeKey(k);
          if (
            kn.includes('valor') ||
            kn.includes('preco') ||
            kn.includes('preco') ||
            kn.includes('custo')
          ) {
            const v = toFloat(raw[k]);
            if (isFiniteNumber(v)) {
              obj.valor_unitario = v;
              break;
            }
          }
        }
      }
      obj.valor_unitario = isFiniteNumber(toFloat(obj.valor_unitario))
        ? toFloat(obj.valor_unitario)
        : 0;

      // Se arquivo tem coluna "nome" em vez de "medicamento", usa ela
      if (!obj.medicamento) obj.medicamento = obj.nome || textoPrincipal;
      // Compatibilidade: miligrama → dosagem
      if (!obj.dosagem && raw.miligrama)
        obj.dosagem = String(raw.miligrama || '');
      // Converte data serial do Excel para data_entrada e vencimento
      obj.data_entrada = converterDataExcel(obj.data_entrada || '');
      if (!obj.data_entrada)
        obj.data_entrada = new Date().toISOString().slice(0, 10);
      obj.vencimento = converterDataExcel(obj.vencimento || '');
      if (!obj.fornecedor) obj.fornecedor = '';
      if (!obj.dosagem) obj.dosagem = '';
      if (!obj.categoria) obj.categoria = '';
      if (!obj.lote) obj.lote = '';
    }

    // ── SAÍDAS ──
    if (tipo === 'saidas') {
      obj.quantidade = isFiniteNumber(toInt(obj.quantidade))
        ? toInt(obj.quantidade)
        : 0;
      if (!obj.medicamento) obj.medicamento = textoPrincipal;
      // Converte data serial do Excel para data de saída
      obj.data = converterDataExcel(obj.data || '');
      if (!obj.data) obj.data = new Date().toISOString().slice(0, 10);
      if (!obj.destino) obj.destino = '';
    }

    return obj;
  }

  function validarLinha(row, tipo) {
    const valores = Object.values(row || {})
      .map((v) => String(v ?? '').trim())
      .filter((v) => v !== '');
    if (!valores.length) return { ok: false, erros: ['Linha vazia'] };

    const textoLinha = valores.join(' ').toLowerCase();
    if (
      textoLinha.includes('soma total') ||
      textoLinha.includes('total geral') ||
      textoLinha.includes('valor total')
    ) {
      return { ok: false, erros: ['Linha de resumo/total'] };
    }

    if (tipo === 'medicamentos') {
      if (!row.nome) row.nome = `Item importado ${Date.now()}`;
      if (!row.categoria) row.categoria = 'outros';
      if (!row.dosagem) row.dosagem = '';
      if (!row.lote) row.lote = '';
      if (!row.vencimento) row.vencimento = '';
      if (!row.fornecedor) row.fornecedor = '';
      if (!isFiniteNumber(row.stock_atual)) row.stock_atual = 0;
      if (!isFiniteNumber(row.valor)) row.valor = 0;
      if (typeof row.ativo === 'undefined') row.ativo = true;
    }

    if (tipo === 'fornecedores') {
      if (!row.nome) row.nome = `Fornecedor importado ${Date.now()}`;
      if (typeof row.ativo === 'undefined') row.ativo = true;
      if (!row.cnpj) row.cnpj = '';
      if (!row.telefone) row.telefone = '';
      if (!row.email) row.email = '';
    }

    if (tipo === 'entradas') {
      if (!row.medicamento) row.medicamento = `Entrada importada ${Date.now()}`;
      if (!isFiniteNumber(row.quantidade)) row.quantidade = 0;
      if (!isFiniteNumber(row.valor_unitario)) row.valor_unitario = 0;
      if (!row.fornecedor) row.fornecedor = '';
      if (!row.data_entrada)
        row.data_entrada = new Date().toISOString().slice(0, 10);
      if (!row.dosagem) row.dosagem = '';
      if (!row.categoria) row.categoria = '';
      if (!row.lote) row.lote = '';
      if (!row.vencimento) row.vencimento = '';
    }

    if (tipo === 'saidas') {
      if (!row.medicamento) row.medicamento = `Saída importada ${Date.now()}`;
      if (!isFiniteNumber(row.quantidade)) row.quantidade = 0;
      if (!row.destino) row.destino = '';
      if (!row.data) row.data = new Date().toISOString().slice(0, 10);
    }

    return { ok: true, erros: [] };
  }

  // ── PREVIEW ────────────────────────────────────────────────────────────────

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
    elPreviewBody.innerHTML = `<tr><td class="muted" style="padding:16px;color:var(--gray-500)">${escapeHTML(msg)}</td></tr>`;
  }

  function renderTable(cols, rows) {
    elPreviewHead.innerHTML = `<tr>${cols.map((c) => `<th>${escapeHTML(labelColuna(c))}</th>`).join('')}</tr>`;
    elPreviewBody.innerHTML = rows
      .map(
        (r) =>
          `<tr>${r.map((v) => `<td>${escapeHTML(String(v ?? ''))}</td>`).join('')}</tr>`
      )
      .join('');
  }

  // Traduz nomes internos para exibição amigável na prévia
  function labelColuna(chave) {
    const labels = {
      nome: 'Nome',
      medicamento: 'Medicamento',
      dosagem: 'Dosagem',
      categoria: 'Categoria',
      lote: 'Lote',
      vencimento: 'Vencimento',
      stock_atual: 'Estoque',
      valor: 'Valor Unit.',
      fornecedor: 'Fornecedor',
      ativo: 'Ativo',
      quantidade: 'Quantidade',
      valor_unitario: 'Valor Unit.',
      data_entrada: 'Data de Entrada',
      data: 'Data',
      destino: 'Destino',
      cnpj: 'CNPJ',
      telefone: 'Telefone',
      email: 'E-mail',
    };
    return labels[chave] || chave;
  }

  // Colunas exibidas na pré-visualização por tipo
  function previewCols(tipo) {
    if (tipo === 'fornecedores')
      return ['nome', 'cnpj', 'telefone', 'email', 'ativo'];

    if (tipo === 'medicamentos')
      return [
        'nome',
        'dosagem',
        'categoria',
        'lote',
        'vencimento',
        'stock_atual',
        'valor',
        'fornecedor',
        'ativo',
      ];

    if (tipo === 'entradas')
      return [
        'medicamento',
        'dosagem',
        'categoria',
        'lote',
        'vencimento',
        'quantidade',
        'valor_unitario',
        'fornecedor',
        'data_entrada',
      ];

    if (tipo === 'saidas')
      return ['medicamento', 'quantidade', 'destino', 'data'];

    return Object.keys(linhasLidas[0] || {});
  }

  // ── MAPEAMENTO DE COLUNAS DO ARQUIVO ──────────────────────────────────────

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
        nome: [
          'nome',
          'medicamento',
          'produto',
          'item',
          'descricao',
          'descrição',
          'material',
        ],
        dosagem: ['dosagem', 'miligrama', 'mg', 'concentracao', 'concentração'],
        categoria: ['categoria', 'classe', 'grupo', 'tipo'],
        lote: ['lote'],
        vencimento: [
          'vencimento',
          'validade',
          'data validade',
          'data de validade',
          'vencimento_data',
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
        valor: [
          'valor_unit',
          'valor unit',
          'valor unit.',
          'valor',
          'preco',
          'preço',
          'valor unitario',
          'valor unitário',
          'valor_unitario',
          'custo',
          'valor unt',
        ],
        fornecedor: ['fornecedor', 'fabricante', 'distribuidor'],
        ativo: ['ativo', 'status'],
      };
    }

    if (tipo === 'entradas') {
      return {
        medicamento: [
          'medicamento',
          'nome',
          'produto',
          'item',
          'descricao',
          'descrição',
          'material',
        ],
        dosagem: ['dosagem', 'miligrama', 'mg', 'concentracao', 'concentração'],
        categoria: ['categoria', 'classe', 'grupo', 'tipo'],
        lote: ['lote'],
        vencimento: [
          'vencimento',
          'validade',
          'data validade',
          'data de validade',
        ],
        quantidade: [
          'quantidade',
          'qtd',
          'necessidade',
          'nec',
          'saldo',
          'estoque',
          'stock_atual',
        ],
        valor_unitario: [
          'valor_unit',
          'valor unit',
          'valor unit.',
          'valor_unitario',
          'valor unitario',
          'valor unitário',
          'vl unitario',
          'vl unitário',
          'vl_unit',
          'preco unitario',
          'preço unitário',
          'preco unit',
          'preço unit',
          'preco',
          'preço',
          'valor',
          'custo',
        ],
        fornecedor: ['fornecedor', 'origem', 'fabricante'],
        data_entrada: [
          'data_entrada',
          'data entrada',
          'data de entrada',
          'data entrada movimentacao',
          'data',
        ],
      };
    }

    // saidas
    return {
      medicamento: [
        'medicamento',
        'nome',
        'produto',
        'item',
        'descricao',
        'descrição',
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
    };
  }

  // ── HELPERS ────────────────────────────────────────────────────────────────

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
    if (kpiProntas)
      kpiProntas.textContent = String(resultadoValidacao?.okRows?.length ?? 0);
    if (kpiErros)
      kpiErros.textContent = String(resultadoValidacao?.errors?.length ?? 0);
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
    // Se já é número (vindo do Excel via cellDates: true ou SheetJS), usa direto
    if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    const s = String(v).trim();
    if (!s) return NaN;

    let normalized;
    if (s.includes(',') && s.includes('.')) {
      // Formato BR com milhar: "1.500,89" → remove pontos, troca vírgula por ponto
      normalized = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',') && !s.includes('.')) {
      // Decimal com vírgula: "1,89" → troca por ponto
      normalized = s.replace(',', '.');
    } else {
      // Ponto como decimal (padrão internacional): "1.89", "0.89" → usa direto
      normalized = s;
    }

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
