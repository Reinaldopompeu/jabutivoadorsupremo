const crypto = require('crypto');
const { google } = require('googleapis');

const APP_CONFIG = {
  APP_NAME: 'Pinguim Financeiro',
  VERSION: '1.0.0',
  TIMEZONE: 'America/Sao_Paulo',
  SHEETS: {
    CONFIG: 'Configuracoes',
    USERS: 'Usuarios',
    HISTORY: 'Historico',
    TRANSACTIONS: 'Lancamentos',
    ACCOUNTS: 'Contas',
    CATEGORIES: 'Categorias',
    CLIENTS: 'Clientes',
    SUPPLIERS: 'Fornecedores'
  }
};

const SHEET_HEADERS = {
  Configuracoes: ['Chave', 'Valor', 'Descricao'],
  Usuarios: ['ID', 'Nome', 'Email', 'Perfil', 'Ativo', 'CriadoEm', 'AtualizadoEm'],
  Historico: ['ID', 'Entidade', 'RegistroID', 'Acao', 'Usuario', 'DataHora', 'Antes', 'Depois'],
  Lancamentos: ['ID', 'Data', 'Fluxo', 'Origem', 'Destino', 'Valor', 'Historico', 'Categoria', 'Subcategoria', 'Status', 'CriadoPor', 'CriadoEm', 'AtualizadoPor', 'AtualizadoEm', 'Excluido'],
  Contas: ['ID', 'Nome', 'Tipo', 'Banco', 'Agencia', 'Numero', 'SaldoInicial', 'Ativo', 'CriadoEm', 'AtualizadoEm', 'Excluido'],
  Categorias: ['ID', 'Tipo', 'Codigo', 'Categoria', 'Subcodigo', 'Subcategoria', 'Ativo', 'CriadoEm', 'AtualizadoEm', 'Excluido'],
  Clientes: ['ID', 'Nome', 'Documento', 'Email', 'Telefone', 'Ativo', 'CriadoEm', 'AtualizadoEm', 'Excluido'],
  Fornecedores: ['ID', 'Nome', 'Documento', 'Email', 'Telefone', 'Ativo', 'CriadoEm', 'AtualizadoEm', 'Excluido']
};

const ENTITY_SHEETS = {
  lancamentos: APP_CONFIG.SHEETS.TRANSACTIONS,
  contas: APP_CONFIG.SHEETS.ACCOUNTS,
  categorias: APP_CONFIG.SHEETS.CATEGORIES,
  clientes: APP_CONFIG.SHEETS.CLIENTS,
  fornecedores: APP_CONFIG.SHEETS.SUPPLIERS,
  usuarios: APP_CONFIG.SHEETS.USERS
};

const DEFAULT_ACCOUNTS = [
  ['Nubank', 'Banco', 'Nubank', '', '', 0],
  ['Banco do Brasil', 'Banco', 'Banco do Brasil', '', '', 0],
  ['Itaú', 'Banco', 'Itaú', '', '', 0],
  ['Caixa físico', 'Caixa', '', '', '', 0]
];

const DEFAULT_CATEGORIES = [
  ['Receita', '2', 'Vendas', '2.1', 'Online'],
  ['Receita', '2', 'Vendas', '2.2', 'Serviços'],
  ['Receita', '2', 'Vendas', '2.3', 'Mensalidades'],
  ['Receita', '4', 'Outras receitas', '4.1', 'Créditos diversos'],
  ['Receita', '4', 'Outras receitas', '4.2', 'Resgate de aplicação'],
  ['Receita', '5', 'Recebimento de empréstimos', '5.1', 'Empréstimo'],
  ['Receita', '9', 'Patrimônio', '9.1', 'Saldo inicial'],
  ['Despesa', '1', 'Compras', '1.1', 'Mercadorias'],
  ['Despesa', '1', 'Compras', '1.2', 'Consumo interno'],
  ['Despesa', '2', 'Despesas administrativas', '2.1', 'Aluguéis'],
  ['Despesa', '2', 'Despesas administrativas', '2.2', 'Energia'],
  ['Despesa', '2', 'Despesas administrativas', '2.3', 'Internet'],
  ['Despesa', '2', 'Despesas administrativas', '2.4', 'Serviços contábeis'],
  ['Despesa', '3', 'Pessoal', '3.1', 'Folha de pagamento'],
  ['Despesa', '3', 'Pessoal', '3.2', 'Comissões'],
  ['Transferência', '7', 'Transferências internas', '7.1', 'Entre contas e agências'],
  ['Despesa', '8', 'Despesas financeiras', '8.1', 'Tarifas bancárias'],
  ['Despesa', '8', 'Despesas financeiras', '8.2', 'Juros e multas'],
  ['Despesa', '10', 'Outras despesas', '10.1', 'Manutenção'],
  ['Despesa', '10', 'Outras despesas', '10.2', 'Equipamentos']
];

const readySpreadsheets = new Set();
let sheetsClientPromise = null;

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Use POST.' });
    return;
  }

  try {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    const args = Array.isArray(body.args) ? body.args : [];
    if (!name) throw new Error('Informe a funcao da API.');

    const data = await callApi(name, args);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    res.status(500).json({ ok: false, error: error && error.message ? error.message : String(error) });
  }
};

async function callApi(name, args) {
  await ensureDatabase();

  if (name === 'setupSistema' || name === 'setupSystem') return setupSystem();
  if (name === 'appShellBootstrap') return appShellBootstrap();
  if (name === 'appBootstrap') return appBootstrap();
  if (name === 'obterDashboard') return buildDashboard();
  if (name === 'listarLancamentos') return listTransactions(args[0] || {});
  if (name === 'salvarLancamento') return saveTransaction(args[0] || {});
  if (name === 'excluirLancamento') return softDelete(APP_CONFIG.SHEETS.TRANSACTIONS, args[0]);
  if (name === 'obterLivroCaixa') return buildCashBook(args[0] || {});
  if (name === 'listarEntidade') return listEntity(args[0]);
  if (name === 'salvarEntidade') return saveEntity(args[0], args[1] || {});
  if (name === 'excluirEntidade') return softDelete(getSheetNameForEntity(args[0]), args[1]);

  throw new Error(`Funcao nao reconhecida: ${name}`);
}

async function setupSystem() {
  return {
    spreadsheetId: spreadsheetId(),
    spreadsheetUrl: spreadsheetUrl(),
    message: 'Planilha vinculada e base configurada com sucesso.'
  };
}

async function appShellBootstrap() {
  const config = await getConfig();
  return {
    app: {
      name: config.EMPRESA_NOME || appCompanyName(),
      version: APP_CONFIG.VERSION,
      spreadsheetUrl: spreadsheetUrl()
    },
    user: getCurrentUser(),
    catalogs: await getCatalogs()
  };
}

async function appBootstrap() {
  const transactions = await listTransactions({});
  const shell = await appShellBootstrap();
  return {
    ...shell,
    dashboard: await buildDashboard(transactions),
    transactions,
    recent: transactions.slice(0, 8)
  };
}

async function buildDashboard(transactionsOverride) {
  const catalogs = await getCatalogs();
  const transactions = transactionsOverride || await listTransactions({});
  const balances = calculateAccountBalances(catalogs.accounts, transactions);
  const saldo = balances.reduce((sum, item) => sum + Number(item.Saldo || 0), 0);
  const entradas = transactions.filter(item => item.Fluxo === 'Entrada').reduce(sumValue, 0);
  const saidas = transactions.filter(item => item.Fluxo === 'Saida' || item.Fluxo === 'Saída').reduce(sumValue, 0);
  const transferencias = transactions.filter(item => item.Fluxo === 'Transferencia' || item.Fluxo === 'Transferência').reduce(sumValue, 0);
  const byMonth = {};

  transactions.forEach(item => {
    const key = String(item.Data || '').slice(0, 7);
    if (!key) return;
    if (!byMonth[key]) byMonth[key] = { Mes: key, Entrada: 0, Saida: 0, Transferencia: 0, Resultado: 0 };
    if (item.Fluxo === 'Entrada') byMonth[key].Entrada += Number(item.Valor || 0);
    if (item.Fluxo === 'Saida' || item.Fluxo === 'Saída') byMonth[key].Saida += Number(item.Valor || 0);
    if (item.Fluxo === 'Transferencia' || item.Fluxo === 'Transferência') byMonth[key].Transferencia += Number(item.Valor || 0);
    byMonth[key].Resultado = byMonth[key].Entrada - byMonth[key].Saida;
  });

  return {
    metrics: {
      saldo,
      entradas,
      saidas,
      transferencias,
      resultado: entradas - saidas,
      quantidade: transactions.length
    },
    accounts: balances,
    monthly: Object.keys(byMonth).sort().map(key => byMonth[key]),
    recent: transactions.slice(0, 6)
  };
}

async function listTransactions(filters) {
  filters = filters || {};
  let items = (await readObjects(APP_CONFIG.SHEETS.TRANSACTIONS))
    .filter(row => !isDeleted(row))
    .map(normalizeTransaction);

  if (filters.search) {
    const q = normalizeSearch(filters.search);
    items = items.filter(item => {
      const haystack = [
        item.Data,
        dateBr(item.Data),
        item.ID,
        numberFor(item),
        item.Historico
      ].map(normalizeSearch).join(' ');
      return haystack.includes(q);
    });
  }

  if (filters.start) items = items.filter(item => String(item.Data) >= String(normalizeDateValue(filters.start)));
  if (filters.end) items = items.filter(item => String(item.Data) <= String(normalizeDateValue(filters.end)));
  if (filters.fluxo) items = items.filter(item => item.Fluxo === filters.fluxo);
  if (filters.categoria) items = items.filter(item => item.Categoria === filters.categoria);
  if (filters.subcategoria) items = items.filter(item => item.Subcategoria === filters.subcategoria);

  items.sort((a, b) => String(b.Data).localeCompare(String(a.Data)) || String(b.CriadoEm).localeCompare(String(a.CriadoEm)));
  if (filters.limit) items = items.slice(0, Number(filters.limit));
  return items;
}

async function saveTransaction(payload) {
  validateTransaction(payload);
  const user = getCurrentUser();
  const old = payload.ID ? await findById(APP_CONFIG.SHEETS.TRANSACTIONS, payload.ID) : null;
  const now = nowIso();
  const normalized = normalizePayloadTransaction(payload);
  const record = {
    ...(old || {}),
    ...normalized,
    ID: payload.ID || makeId('LAN'),
    Status: 'Realizado',
    CriadoPor: old ? old.CriadoPor : user.Email,
    CriadoEm: old ? old.CriadoEm : now,
    AtualizadoPor: user.Email,
    AtualizadoEm: now,
    Excluido: false
  };

  if (old) await updateObject(APP_CONFIG.SHEETS.TRANSACTIONS, record.ID, record);
  else await appendObject(APP_CONFIG.SHEETS.TRANSACTIONS, record);

  await addHistory(APP_CONFIG.SHEETS.TRANSACTIONS, record.ID, old ? 'Atualizado' : 'Criado', old || {}, record);
  return normalizeTransaction(record);
}

function validateTransaction(payload) {
  if (!payload.Data) throw new Error('Informe a data da movimentacao.');
  const data = normalizeDateValue(payload.Data);
  if (data < '2026-01-01' || data > '2036-12-31') throw new Error('A data do lancamento deve estar entre 01/01/2026 e 31/12/2036.');
  if (!payload.Fluxo) throw new Error('Informe o fluxo da movimentacao.');
  if (!payload.Historico) throw new Error('Informe o historico.');
  if (parseMoney(payload.Valor) <= 0) throw new Error('Informe um valor maior que zero.');
  if (payload.Fluxo === 'Entrada' && !payload.Destino) throw new Error('Entrada precisa de uma conta de destino.');
  if ((payload.Fluxo === 'Saida' || payload.Fluxo === 'Saída') && !payload.Origem) throw new Error('Saida precisa de uma conta de origem.');
  if ((payload.Fluxo === 'Transferencia' || payload.Fluxo === 'Transferência') && (!payload.Origem || !payload.Destino || payload.Origem === payload.Destino)) {
    throw new Error('Transferencia precisa de origem e destino diferentes.');
  }
  if (payload.Fluxo !== 'Transferencia' && payload.Fluxo !== 'Transferência' && (!payload.Categoria || !payload.Subcategoria)) {
    throw new Error('Informe categoria e subcategoria.');
  }
}

function normalizePayloadTransaction(payload) {
  const fluxo = normalizeFlow(payload.Fluxo);
  const categoria = fluxo === 'Transferência' ? 'Transferências internas' : String(payload.Categoria || '').trim();
  const subcategoria = fluxo === 'Transferência' ? 'Entre contas e agências' : String(payload.Subcategoria || '').trim();
  const categoriaConta = categoria && subcategoria ? `${categoria} / ${subcategoria}` : categoria;
  return {
    Data: normalizeDateValue(payload.Data),
    Fluxo: fluxo,
    Origem: fluxo === 'Entrada' ? categoriaConta : String(payload.Origem || '').trim(),
    Destino: fluxo === 'Saída' ? categoriaConta : String(payload.Destino || '').trim(),
    Valor: parseMoney(payload.Valor),
    Historico: String(payload.Historico || '').trim(),
    Categoria: categoria,
    Subcategoria: subcategoria
  };
}

function normalizeTransaction(item) {
  const normalized = { ...item };
  normalized.Data = normalizeDateValue(normalized.Data);
  normalized.Fluxo = normalizeFlow(normalized.Fluxo);
  normalized.Valor = parseMoney(normalized.Valor);
  normalized.Excluido = toBool(normalized.Excluido);
  return normalized;
}

function calculateAccountBalances(accounts, transactions) {
  const map = {};
  accounts.forEach(account => {
    map[account.Nome] = {
      ID: account.ID,
      Nome: account.Nome,
      Tipo: account.Tipo,
      SaldoInicial: parseMoney(account.SaldoInicial),
      Saldo: parseMoney(account.SaldoInicial)
    };
  });

  transactions.forEach(item => {
    const value = Number(item.Valor || 0);
    if (item.Fluxo === 'Entrada' && map[item.Destino]) map[item.Destino].Saldo += value;
    if (item.Fluxo === 'Saída' && map[item.Origem]) map[item.Origem].Saldo -= value;
    if (item.Fluxo === 'Transferência') {
      if (map[item.Origem]) map[item.Origem].Saldo -= value;
      if (map[item.Destino]) map[item.Destino].Saldo += value;
    }
  });

  return Object.keys(map).map(name => map[name]);
}

async function buildCashBook(filters) {
  filters = filters || {};
  const catalogs = await getCatalogs();
  const accounts = filters.account
    ? catalogs.accounts.filter(account => account.Nome === filters.account)
    : catalogs.accounts;
  const transactions = (await listTransactions({ start: filters.start, end: filters.end }))
    .sort((a, b) => String(a.Data).localeCompare(String(b.Data)) || String(a.CriadoEm).localeCompare(String(b.CriadoEm)));
  const allTransactions = await listTransactions({});
  const start = filters.start || firstDayOfCurrentYear();
  const openingDate = previousDay(start);
  const openingLabel = `SALDO ANTERIOR - ${monthYearLabel(openingDate)}`;
  const accountSections = accounts.map((account, index) => buildAccountSection(account, index + 1, start, openingDate, openingLabel, transactions, allTransactions));
  const categorySections = buildCategorySections(catalogs.categories, start, openingDate, openingLabel, transactions, allTransactions);
  const totalEntrada = accountSections.reduce((sum, section) => sum + section.totalEntrada, 0);
  const totalSaida = accountSections.reduce((sum, section) => sum + section.totalSaida, 0);
  const totalSaldo = accountSections.reduce((sum, section) => sum + section.saldoFinal, 0);

  return {
    periodo: { start, end: filters.end || todayIso(), openingDate, openingLabel },
    accounts: accountSections,
    categories: categorySections,
    totals: { entrada: totalEntrada, saida: totalSaida, saldo: totalSaldo }
  };
}

function buildAccountSection(account, order, start, openingDate, openingLabel, transactions, allTransactions) {
  let opening = parseMoney(account.SaldoInicial);
  allTransactions.forEach(item => {
    if (String(item.Data) >= String(start)) return;
    opening += accountDelta(account.Nome, item);
  });

  let saldo = opening;
  let totalEntrada = 0;
  let totalSaida = 0;
  const rows = transactions
    .map(item => {
      const leg = accountLeg(account.Nome, item);
      if (!leg) return null;
      saldo += leg.entrada - leg.saida;
      totalEntrada += leg.entrada;
      totalSaida += leg.saida;
      return {
        data: item.Data,
        numero: numberFor(item),
        historico: item.Historico,
        categoria: item.Categoria,
        subcategoria: item.Subcategoria,
        entrada: leg.entrada,
        saida: leg.saida,
        saldo
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));

  return {
    codigo: `1.${order}`,
    titulo: account.Nome,
    openingDate,
    openingLabel,
    opening,
    rows,
    totalEntrada,
    totalSaida,
    saldoFinal: saldo
  };
}

function buildCategorySections(categories, start, openingDate, openingLabel, transactions, allTransactions) {
  const grouped = {};
  activeRows(categories).forEach(cat => {
    const key = `${cat.Codigo}|${cat.Categoria}|${cat.Subcodigo}|${cat.Subcategoria}`;
    grouped[key] = {
      codigo: cat.Codigo,
      titulo: cat.Categoria,
      subcodigo: cat.Subcodigo,
      subtitulo: cat.Subcategoria,
      openingDate,
      openingLabel,
      opening: 0,
      rows: [],
      totalEntrada: 0,
      totalSaida: 0,
      saldoFinal: 0
    };
  });

  allTransactions.forEach(item => {
    const key = categoryKey(item, categories);
    if (!grouped[key]) return;
    if (String(item.Data) < String(start)) grouped[key].opening += categoryDelta(item);
  });
  Object.keys(grouped).forEach(key => {
    grouped[key].saldoFinal = grouped[key].opening;
  });
  transactions.forEach(item => {
    const key = categoryKey(item, categories);
    if (!grouped[key]) return;
    const section = grouped[key];
    const entrada = item.Fluxo === 'Entrada' ? Number(item.Valor || 0) : 0;
    const saida = item.Fluxo === 'Saída' ? Number(item.Valor || 0) : 0;
    section.saldoFinal += entrada - saida;
    section.totalEntrada += entrada;
    section.totalSaida += saida;
    section.rows.push({
      data: item.Data,
      numero: numberFor(item),
      historico: item.Historico,
      destino: item.Destino,
      origem: item.Origem,
      entrada,
      saida,
      saldo: section.saldoFinal
    });
  });

  return Object.keys(grouped)
    .map(key => grouped[key])
    .filter(section => section.rows.length || section.opening !== 0)
    .sort((a, b) => Number(a.codigo) - Number(b.codigo) || String(a.subcodigo).localeCompare(String(b.subcodigo)));
}

function accountDelta(accountName, item) {
  const leg = accountLeg(accountName, item);
  return leg ? leg.entrada - leg.saida : 0;
}

function accountLeg(accountName, item) {
  const value = Number(item.Valor || 0);
  if (item.Fluxo === 'Entrada' && item.Destino === accountName) return { entrada: value, saida: 0 };
  if (item.Fluxo === 'Saída' && item.Origem === accountName) return { entrada: 0, saida: value };
  if (item.Fluxo === 'Transferência' && item.Origem === accountName) return { entrada: 0, saida: value };
  if (item.Fluxo === 'Transferência' && item.Destino === accountName) return { entrada: value, saida: 0 };
  return null;
}

function categoryDelta(item) {
  if (item.Fluxo === 'Entrada') return Number(item.Valor || 0);
  if (item.Fluxo === 'Saída') return -Number(item.Valor || 0);
  return 0;
}

function categoryKey(item, categories) {
  const found = (categories || []).find(cat => cat.Categoria === item.Categoria && cat.Subcategoria === item.Subcategoria);
  if (found) return `${found.Codigo}|${found.Categoria}|${found.Subcodigo}|${found.Subcategoria}`;
  return `0|${item.Categoria}|0.0|${item.Subcategoria}`;
}

async function listEntity(entity) {
  return activeRows(await readObjects(getSheetNameForEntity(entity)));
}

async function saveEntity(entity, payload) {
  const sheetName = getSheetNameForEntity(entity);
  const old = payload.ID ? await findById(sheetName, payload.ID) : null;
  const now = nowIso();
  const prefix = String(entity || 'REG').substring(0, 3).toUpperCase();
  const record = {
    ...(old || {}),
    ...payload,
    ID: payload.ID || makeId(prefix),
    AtualizadoEm: now,
    Excluido: false
  };
  if (!old) record.CriadoEm = now;
  if (record.Ativo === undefined || record.Ativo === '') record.Ativo = true;
  if (sheetName === APP_CONFIG.SHEETS.USERS && !record.Perfil) record.Perfil = 'Usuario';

  if (old) await updateObject(sheetName, record.ID, record);
  else await appendObject(sheetName, record);
  await addHistory(sheetName, record.ID, old ? 'Atualizado' : 'Criado', old || {}, record);
  return cleanInternal(record);
}

async function softDelete(sheetName, id) {
  const old = await findById(sheetName, id);
  if (!old) throw new Error('Registro nao encontrado.');
  const record = { ...old, Excluido: true, AtualizadoPor: getCurrentUser().Email, AtualizadoEm: nowIso() };
  await updateObject(sheetName, id, record);
  await addHistory(sheetName, id, 'Excluido', old, record);
  return { id };
}

function getSheetNameForEntity(entity) {
  const sheetName = ENTITY_SHEETS[String(entity || '').toLowerCase()];
  if (!sheetName) throw new Error(`Entidade nao reconhecida: ${entity}`);
  return sheetName;
}

async function getCatalogs() {
  return {
    accounts: activeRows(await readObjects(APP_CONFIG.SHEETS.ACCOUNTS)),
    categories: activeRows(await readObjects(APP_CONFIG.SHEETS.CATEGORIES)),
    clients: activeRows(await readObjects(APP_CONFIG.SHEETS.CLIENTS)),
    suppliers: activeRows(await readObjects(APP_CONFIG.SHEETS.SUPPLIERS)),
    users: activeRows(await readObjects(APP_CONFIG.SHEETS.USERS))
  };
}

async function getConfig() {
  const config = {};
  (await readObjects(APP_CONFIG.SHEETS.CONFIG)).forEach(row => {
    if (row.Chave) config[row.Chave] = row.Valor;
  });
  return config;
}

async function ensureDatabase() {
  const id = spreadsheetId();
  if (readySpreadsheets.has(id)) return;
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: id,
    fields: 'sheets.properties.title'
  });
  const existing = new Set((meta.data.sheets || []).map(sheet => sheet.properties.title));
  const requests = Object.keys(SHEET_HEADERS)
    .filter(name => !existing.has(name))
    .map(title => ({ addSheet: { properties: { title } } }));

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests } });
  }

  for (const [sheetName, headers] of Object.entries(SHEET_HEADERS)) {
    await ensureHeaders(sheetName, headers);
  }
  await seedDefaults();
  readySpreadsheets.add(id);
}

async function ensureHeaders(sheetName, headers) {
  const rows = await getValues(sheetName, `A1:${columnLetter(headers.length)}1`);
  const current = rows[0] || [];
  const needsHeader = headers.some((header, index) => current[index] !== header);
  if (!needsHeader) return;
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${quoteSheet(sheetName)}!A1:${columnLetter(headers.length)}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers] }
  });
}

async function seedDefaults() {
  if ((await readObjects(APP_CONFIG.SHEETS.CONFIG)).length === 0) {
    await appendObject(APP_CONFIG.SHEETS.CONFIG, {
      Chave: 'EMPRESA_NOME',
      Valor: appCompanyName(),
      Descricao: 'Nome exibido no sistema'
    });
    await appendObject(APP_CONFIG.SHEETS.CONFIG, {
      Chave: 'REGIME',
      Valor: 'Caixa + partidas dobradas',
      Descricao: 'Valores afetam o caixa somente quando realizados'
    });
  }

  if ((await readObjects(APP_CONFIG.SHEETS.ACCOUNTS)).length === 0) {
    for (const item of DEFAULT_ACCOUNTS) {
      await appendObject(APP_CONFIG.SHEETS.ACCOUNTS, {
        ID: makeId('CTA'),
        Nome: item[0],
        Tipo: item[1],
        Banco: item[2],
        Agencia: item[3],
        Numero: item[4],
        SaldoInicial: item[5],
        Ativo: true,
        CriadoEm: nowIso(),
        AtualizadoEm: nowIso(),
        Excluido: false
      });
    }
  }

  if ((await readObjects(APP_CONFIG.SHEETS.CATEGORIES)).length === 0) {
    for (const item of DEFAULT_CATEGORIES) {
      await appendObject(APP_CONFIG.SHEETS.CATEGORIES, {
        ID: makeId('CAT'),
        Tipo: item[0],
        Codigo: item[1],
        Categoria: item[2],
        Subcodigo: item[3],
        Subcategoria: item[4],
        Ativo: true,
        CriadoEm: nowIso(),
        AtualizadoEm: nowIso(),
        Excluido: false
      });
    }
  }

  if ((await readObjects(APP_CONFIG.SHEETS.USERS)).length === 0) {
    const email = defaultUserEmail();
    await appendObject(APP_CONFIG.SHEETS.USERS, {
      ID: makeId('USR'),
      Nome: 'Administrador',
      Email: email,
      Perfil: 'Administrador',
      Ativo: true,
      CriadoEm: nowIso(),
      AtualizadoEm: nowIso()
    });
  }
}

async function readObjects(sheetName, includeMeta = false) {
  const rows = await getValues(sheetName, `A1:${columnLetter((SHEET_HEADERS[sheetName] || []).length || 26)}`);
  if (!rows.length) return [];
  const headers = rows[0].length ? rows[0] : SHEET_HEADERS[sheetName];
  return rows
    .slice(1)
    .map((row, index) => {
      const object = {};
      headers.forEach((header, col) => {
        object[header] = row[col] !== undefined ? row[col] : '';
      });
      if (includeMeta) object.__row = index + 2;
      return object;
    })
    .filter(row => Object.keys(row).some(key => key !== '__row' && row[key] !== ''));
}

async function appendObject(sheetName, object) {
  const headers = SHEET_HEADERS[sheetName];
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${quoteSheet(sheetName)}!A:${columnLetter(headers.length)}`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [headers.map(header => serializeCell(object[header]))] }
  });
}

async function updateObject(sheetName, id, object) {
  const headers = SHEET_HEADERS[sheetName];
  const row = (await readObjects(sheetName, true)).find(item => String(item.ID) === String(id));
  if (!row) throw new Error('Registro nao encontrado.');
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${quoteSheet(sheetName)}!A${row.__row}:${columnLetter(headers.length)}${row.__row}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers.map(header => serializeCell(object[header]))] }
  });
}

async function findById(sheetName, id) {
  return (await readObjects(sheetName, true)).find(row => String(row.ID) === String(id) && !isDeleted(row)) || null;
}

async function addHistory(entity, recordId, action, before, after) {
  await appendObject(APP_CONFIG.SHEETS.HISTORY, {
    ID: makeId('HIS'),
    Entidade: entity,
    RegistroID: recordId,
    Acao: action,
    Usuario: getCurrentUser().Email || 'Sistema',
    DataHora: nowIso(),
    Antes: JSON.stringify(cleanInternal(before || {})),
    Depois: JSON.stringify(cleanInternal(after || {}))
  });
}

async function getValues(sheetName, a1Range) {
  const sheets = await getSheetsClient();
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId(),
      range: `${quoteSheet(sheetName)}!${a1Range}`,
      majorDimension: 'ROWS'
    });
    return response.data.values || [];
  } catch (error) {
    if (error && error.code === 400) return [];
    throw error;
  }
}

async function getSheetsClient() {
  if (!sheetsClientPromise) {
    sheetsClientPromise = (async () => {
      const credentials = serviceAccountCredentials();
      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      await auth.authorize();
      return google.sheets({ version: 'v4', auth });
    })();
  }
  return sheetsClientPromise;
}

function serviceAccountCredentials() {
  const serviceAccountJson = envValue('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson);
    if (parsed.private_key) parsed.private_key = normalizePrivateKey(parsed.private_key);
    return parsed;
  }

  const email = envValue(
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'EMAIL_DA_CONTA_SERVICO_DO_GOOGLE',
    'E_MAIL_DA_CONTA_SERVICO_DO_GOOGLE',
    'E-MAIL_DA_CONTA_SERVIÇO_DO_GOOGLE'
  );
  let key = envValue('GOOGLE_PRIVATE_KEY', 'CHAVE_PRIVADA_DO_GOOGLE') || '';
  const keyBase64 = envValue('GOOGLE_PRIVATE_KEY_BASE64');
  if (!key && keyBase64) {
    key = Buffer.from(keyBase64, 'base64').toString('utf8');
  }
  if (!email || !key) {
    throw new Error('Configure GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY ou os equivalentes em portugues no Vercel.');
  }
  return { client_email: email, private_key: normalizePrivateKey(key) };
}

function normalizePrivateKey(key) {
  return String(key || '').replace(/^"|"$/g, '').replace(/\\n/g, '\n');
}

function spreadsheetId() {
  const id = envValue('GOOGLE_SHEETS_SPREADSHEET_ID', 'ID_DA_PLANILHA_DO_GOOGLE_SHEETS');
  if (!id) throw new Error('Configure GOOGLE_SHEETS_SPREADSHEET_ID ou ID_DA_PLANILHA_DO_GOOGLE_SHEETS no Vercel.');
  return id;
}

function spreadsheetUrl() {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId()}/edit`;
}

function getCurrentUser() {
  const email = defaultUserEmail();
  return {
    ID: 'VERCEL',
    Nome: 'Usuario',
    Email: email,
    Perfil: 'Administrador',
    Ativo: true,
    Permissions: ['view', 'create', 'edit', 'delete', 'settings', 'users', 'history']
  };
}

function appCompanyName() {
  return envValue('APP_COMPANY_NAME', 'NOME_DA_EMPRESA_DO_APLICATIVO') || APP_CONFIG.APP_NAME;
}

function defaultUserEmail() {
  return envValue(
    'DEFAULT_USER_EMAIL',
    'EMAIL_PADRAO_DO_USUARIO',
    'E_MAIL_PADRAO_DO_USUARIO',
    'E-MAIL_PADRÃO_DO_USUÁRIO'
  ) || 'admin@local';
}

function envValue(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function activeRows(rows) {
  return (rows || []).filter(row => !isDeleted(row) && toBool(row.Ativo) !== false);
}

function isDeleted(row) {
  return toBool(row && row.Excluido);
}

function toBool(value) {
  if (typeof value === 'boolean') return value;
  const text = String(value || '').trim().toLowerCase();
  return ['true', 'sim', '1', 'yes', 'ativo'].includes(text);
}

function normalizeFlow(value) {
  const text = String(value || '').trim();
  const plain = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (plain === 'saida') return 'Saída';
  if (plain === 'transferencia') return 'Transferência';
  return text || 'Entrada';
}

function parseMoney(value) {
  if (typeof value === 'number') return value;
  const text = String(value || '').trim();
  if (!text) return 0;
  const cleaned = text
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function serializeCell(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return value;
}

function cleanInternal(object) {
  const clone = { ...(object || {}) };
  delete clone.__row;
  return clone;
}

function sumValue(sum, item) {
  return sum + Number(item.Valor || 0);
}

function normalizeDateValue(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  return text.slice(0, 10);
}

function dateBr(value) {
  const iso = normalizeDateValue(value);
  const parts = iso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(value || '');
}

function todayIso() {
  return new Date().toLocaleDateString('en-CA', { timeZone: APP_CONFIG.TIMEZONE });
}

function nowIso() {
  return new Date().toISOString();
}

function firstDayOfCurrentYear() {
  return `${todayIso().slice(0, 4)}-01-01`;
}

function previousDay(isoDate) {
  const date = new Date(`${normalizeDateValue(isoDate)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function monthYearLabel(isoDate) {
  const parts = normalizeDateValue(isoDate).split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[0]}` : String(isoDate || '');
}

function numberFor(item) {
  const id = String(item.ID || '');
  if (id.startsWith('LD-')) return id;
  const data = normalizeDateValue(item.Data).replace(/-/g, '');
  const suffix = id.replace(/\D/g, '').slice(-4) || '0001';
  return `LD-${data}-${suffix}`;
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function quoteSheet(sheetName) {
  return `'${String(sheetName).replace(/'/g, "''")}'`;
}

function columnLetter(index) {
  let value = Number(index);
  let letter = '';
  while (value > 0) {
    const mod = (value - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    value = Math.floor((value - mod) / 26);
  }
  return letter || 'A';
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
