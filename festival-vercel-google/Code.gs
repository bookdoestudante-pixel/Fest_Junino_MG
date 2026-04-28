/***************************************
 * SISTEMA FESTIVAL JUNINO
 * Google Sheets + Google Drive backend
 ***************************************/

const SPREADSHEET_ID = 'COLE_AQUI_O_ID_DA_PLANILHA';
const DRIVE_FOLDER_ID = 'COLE_AQUI_O_ID_DA_PASTA_DO_DRIVE';
const ADMIN_PASSWORD = 'TROQUE_ESTA_SENHA';
const TOTAL_MESAS = 70;
const LOCK_MS = 5 * 60 * 1000;

const SHEETS = {
  MESAS: 'BD_Mesas',
  VENDEDORES: 'BD_Vendedores',
  CONFIG: 'BD_Config',
  LOGS: 'BD_Logs'
};

function doGet() {
  return json({ ok: true, message: 'API do Festival ativa.' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action;
    setup();
    cleanExpiredLocks_();

    const routes = {
      publicData,
      loginAdmin,
      loginVendedor,
      adminData,
      vendedorData,
      salvarConfig,
      salvarVendedor,
      removerVendedor,
      lockMesa,
      releaseLock,
      clienteComprar,
      vendedorSalvarMesa,
      validarCompra,
      rejeitarCompra,
      adminSalvarMesa,
      adminValidarCompra,
      adminRejeitarCompra,
      zerarVendas
    };

    if (!routes[action]) throw new Error('Ação inválida: ' + action);
    const result = routes[action](body);
    return json({ ok: true, ...result });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ss_() {
  if (SPREADSHEET_ID === 'COLE_AQUI_O_ID_DA_PLANILHA') throw new Error('Configure o SPREADSHEET_ID no Apps Script.');
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function driveFolder_() {
  if (DRIVE_FOLDER_ID === 'COLE_AQUI_O_ID_DA_PASTA_DO_DRIVE') throw new Error('Configure o DRIVE_FOLDER_ID no Apps Script.');
  return DriveApp.getFolderById(DRIVE_FOLDER_ID);
}

function sh_(name) {
  return ss_().getSheetByName(name) || ss_().insertSheet(name);
}

function setup() {
  const mesas = sh_(SHEETS.MESAS);
  if (mesas.getLastRow() === 0) {
    mesas.appendRow(['numero','status','comprador','contato','vendedor','pagamento','comprovanteNome','comprovanteUrl','origem','validacao','lockOwner','lockExpires','atualizadoEm']);
    const rows = [];
    for (let i = 1; i <= TOTAL_MESAS; i++) rows.push([i,'livre','','','','','','','','','','','']);
    mesas.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  const vendedores = sh_(SHEETS.VENDEDORES);
  if (vendedores.getLastRow() === 0) vendedores.appendRow(['nome','telefone','pin','ativo','token','tokenExpira']);

  const config = sh_(SHEETS.CONFIG);
  if (config.getLastRow() === 0) {
    config.appendRow(['chave','valor']);
    setConfig_('valor', 'R$ 25,00');
    setConfig_('data', '03/06/2026');
    setConfig_('hora', '19h30min');
    setConfig_('local', 'Quadra da Escola');
    setConfig_('atualizacao', new Date().toLocaleString('pt-BR'));
    setConfig_('clientePodeComprar', 'true');
    setConfig_('adminToken', '');
    setConfig_('adminTokenExpira', '0');
  }

  const logs = sh_(SHEETS.LOGS);
  if (logs.getLastRow() === 0) logs.appendRow(['data','acao','detalhes']);
}

function rows_(sheetName) {
  const sh = sh_(sheetName);
  const values = sh.getDataRange().getValues();
  const headers = values.shift() || [];
  return values.filter(r => r.join('') !== '').map((r, idx) => {
    const o = { _row: idx + 2 };
    headers.forEach((h, i) => o[h] = r[i]);
    return o;
  });
}

function writeObj_(sheetName, row, obj) {
  const sh = sh_(sheetName);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const vals = headers.map(h => obj[h] !== undefined ? obj[h] : '');
  sh.getRange(row, 1, 1, vals.length).setValues([vals]);
}

function getConfigMap_() {
  const out = {};
  rows_(SHEETS.CONFIG).forEach(r => out[r.chave] = r.valor);
  return out;
}

function setConfig_(chave, valor) {
  const sh = sh_(SHEETS.CONFIG);
  const data = rows_(SHEETS.CONFIG);
  const found = data.find(r => r.chave === chave);
  if (found) sh.getRange(found._row, 2).setValue(String(valor));
  else sh.appendRow([chave, String(valor)]);
}

function getInfo_() {
  const c = getConfigMap_();
  return { valor: c.valor || '', data: c.data || '', hora: c.hora || '', local: c.local || '', atualizacao: c.atualizacao || '' };
}

function getPublicConfig_() {
  const c = getConfigMap_();
  return { clientePodeComprar: String(c.clientePodeComprar) !== 'false' };
}

function getVendedores_() {
  return rows_(SHEETS.VENDEDORES).filter(v => String(v.ativo || 'true') !== 'false').map(v => ({ nome: String(v.nome || ''), telefone: String(v.telefone || ''), pin: String(v.pin || '') }));
}

function getMesas_() {
  cleanExpiredLocks_();
  return rows_(SHEETS.MESAS).map(normalizeMesa_);
}

function normalizeMesa_(m) {
  return {
    numero: Number(m.numero),
    status: String(m.status || 'livre'),
    comprador: String(m.comprador || ''),
    contato: String(m.contato || ''),
    vendedor: String(m.vendedor || ''),
    pagamento: String(m.pagamento || ''),
    comprovanteNome: String(m.comprovanteNome || ''),
    comprovanteUrl: String(m.comprovanteUrl || ''),
    origem: String(m.origem || ''),
    validacao: String(m.validacao || ''),
    lockOwner: String(m.lockOwner || ''),
    lockExpires: Number(m.lockExpires || 0),
    atualizadoEm: String(m.atualizadoEm || '')
  };
}

function mesaByNumero_(numero) {
  const n = Number(numero);
  const mesa = rows_(SHEETS.MESAS).find(m => Number(m.numero) === n);
  if (!mesa) throw new Error('Mesa não encontrada.');
  return mesa;
}

function isMesaDisponivel_(m) {
  const mesa = normalizeMesa_(m);
  if (mesa.status !== 'livre') return false;
  if (mesa.validacao === 'pendente') return false;
  if (mesa.lockExpires && mesa.lockExpires > Date.now()) return false;
  return true;
}

function cleanExpiredLocks_() {
  const sh = sh_(SHEETS.MESAS);
  rows_(SHEETS.MESAS).forEach(m => {
    if (Number(m.lockExpires || 0) && Number(m.lockExpires || 0) <= Date.now()) {
      sh.getRange(m._row, 11, 1, 2).setValues([['','']]);
    }
  });
}

function saveMesa_(m, updates) {
  const mesa = { ...m, ...updates, atualizadoEm: new Date().toLocaleString('pt-BR') };
  writeObj_(SHEETS.MESAS, m._row, mesa);
  setConfig_('atualizacao', new Date().toLocaleString('pt-BR'));
  return normalizeMesa_(mesa);
}

function publicData() {
  return { data: { info: getInfo_(), config: getPublicConfig_(), vendedores: getVendedores_().map(v => ({ nome: v.nome, telefone: v.telefone })), mesas: getMesas_() } };
}

function loginAdmin(body) {
  if (ADMIN_PASSWORD === 'TROQUE_ESTA_SENHA') throw new Error('Troque a senha do Admin no Apps Script antes de usar.');
  if (String(body.senha || '') !== ADMIN_PASSWORD) throw new Error('Senha do Admin inválida.');
  const token = Utilities.getUuid();
  setConfig_('adminToken', token);
  setConfig_('adminTokenExpira', String(Date.now() + 12 * 60 * 60 * 1000));
  return { token };
}

function assertAdmin_(token) {
  const c = getConfigMap_();
  if (!token || token !== c.adminToken || Number(c.adminTokenExpira || 0) < Date.now()) throw new Error('Acesso Admin expirado ou inválido.');
}

function loginVendedor(body) {
  const vendedor = String(body.vendedor || '');
  const pin = String(body.pin || '');
  const row = rows_(SHEETS.VENDEDORES).find(v => String(v.nome) === vendedor && String(v.ativo || 'true') !== 'false');
  if (!row) throw new Error('Vendedor não encontrado.');
  if (String(row.pin || '') !== pin) throw new Error('PIN inválido.');
  const token = Utilities.getUuid();
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  sh_(SHEETS.VENDEDORES).getRange(row._row, 5, 1, 2).setValues([[token, exp]]);
  return { token };
}

function assertVendedor_(vendedor, token) {
  const row = rows_(SHEETS.VENDEDORES).find(v => String(v.nome) === String(vendedor) && String(v.ativo || 'true') !== 'false');
  if (!row) throw new Error('Vendedor não encontrado.');
  if (!token || String(row.token || '') !== String(token) || Number(row.tokenExpira || 0) < Date.now()) throw new Error('Sessão do vendedor expirada ou inválida.');
  return row;
}

function adminData(body) {
  assertAdmin_(body.token);
  return { data: { info: getInfo_(), config: getPublicConfig_(), vendedores: getVendedores_(), mesas: getMesas_() } };
}

function vendedorData(body) {
  assertVendedor_(body.vendedor, body.token);
  return { data: { info: getInfo_(), config: getPublicConfig_(), vendedores: getVendedores_().map(v => ({ nome: v.nome, telefone: v.telefone })), mesas: getMesas_() } };
}

function salvarConfig(body) {
  assertAdmin_(body.token);
  const info = body.info || {};
  setConfig_('valor', info.valor || '');
  setConfig_('data', info.data || '');
  setConfig_('hora', info.hora || '');
  setConfig_('local', info.local || '');
  setConfig_('atualizacao', info.atualizacao || new Date().toLocaleString('pt-BR'));
  setConfig_('clientePodeComprar', body.config && body.config.clientePodeComprar ? 'true' : 'false');
  log_('salvarConfig', JSON.stringify(body.config || {}));
  return {};
}

function salvarVendedor(body) {
  assertAdmin_(body.token);
  const nome = String(body.nome || '').trim();
  if (!nome) throw new Error('Informe o nome do vendedor.');
  const sh = sh_(SHEETS.VENDEDORES);
  const rows = rows_(SHEETS.VENDEDORES);
  const found = rows.find(v => String(v.nome).toLowerCase() === nome.toLowerCase());
  const obj = { nome, telefone: String(body.telefone || ''), pin: String(body.pin || ''), ativo: 'true', token: '', tokenExpira: '' };
  if (found) writeObj_(SHEETS.VENDEDORES, found._row, obj);
  else sh.appendRow([obj.nome, obj.telefone, obj.pin, obj.ativo, obj.token, obj.tokenExpira]);
  log_('salvarVendedor', nome);
  return {};
}

function removerVendedor(body) {
  assertAdmin_(body.token);
  const row = rows_(SHEETS.VENDEDORES).find(v => String(v.nome) === String(body.nome));
  if (row) sh_(SHEETS.VENDEDORES).getRange(row._row, 4).setValue('false');
  log_('removerVendedor', body.nome);
  return {};
}

function lockMesa(body) {
  if (body.papel === 'vendedor') assertVendedor_(body.vendedor, body.token);
  const m = mesaByNumero_(body.numero);
  if (!isMesaDisponivel_(m)) throw new Error('Essa mesa não está disponível.');
  const lockOwner = Utilities.getUuid();
  const lockExpires = Date.now() + LOCK_MS;
  saveMesa_(m, { lockOwner, lockExpires });
  return { lockOwner, lockExpires };
}

function releaseLock(body) {
  const m = mesaByNumero_(body.numero);
  if (String(m.lockOwner || '') === String(body.lockOwner || '')) saveMesa_(m, { lockOwner: '', lockExpires: '' });
  return {};
}

function saveComprovante_(nome, base64, mimeType) {
  if (!base64) return { nome: '', url: '' };
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', nome);
  const file = driveFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { nome, url: file.getUrl() };
}

function clienteComprar(body) {
  const config = getPublicConfig_();
  if (!config.clientePodeComprar) throw new Error('Compra direta desativada.');
  const m = mesaByNumero_(body.numero);
  if (String(m.lockOwner || '') !== String(body.lockOwner || '')) throw new Error('Reserva temporária inválida ou expirada.');
  if (Number(m.lockExpires || 0) < Date.now()) throw new Error('Tempo da reserva expirou.');
  if (!body.comprador || !body.contato || !body.vendedor || !body.pagamento) throw new Error('Preencha todos os dados.');
  if (!body.fileBase64) throw new Error('Comprovante obrigatório.');
  const comp = saveComprovante_(body.comprovanteNome, body.fileBase64, body.mimeType);
  saveMesa_(m, { status: 'reservada', comprador: body.comprador, contato: body.contato, vendedor: body.vendedor, pagamento: body.pagamento, comprovanteNome: comp.nome, comprovanteUrl: comp.url, origem: 'cliente', validacao: 'pendente', lockOwner: '', lockExpires: '' });
  log_('clienteComprar', 'Mesa ' + body.numero + ' - ' + body.comprador);
  return { comprovanteUrl: comp.url };
}

function vendedorSalvarMesa(body) {
  assertVendedor_(body.vendedor, body.token);
  const m = mesaByNumero_(body.numero);
  if (String(m.status) === 'vendida') throw new Error('Mesa vendida. Somente Admin pode alterar.');
  if (m.vendedor && String(m.vendedor) !== String(body.vendedor)) throw new Error('Mesa vinculada a outro vendedor.');
  if (m.lockOwner && String(m.lockOwner) !== String(body.lockOwner || '') && Number(m.lockExpires || 0) > Date.now()) throw new Error('Mesa bloqueada temporariamente.');
  let comp = { nome: m.comprovanteNome || '', url: m.comprovanteUrl || '' };
  if (body.fileBase64) comp = saveComprovante_(body.comprovanteNome, body.fileBase64, body.mimeType);
  if (body.status === 'vendida' && !comp.url) throw new Error('Comprovante obrigatório para vender.');
  saveMesa_(m, { status: body.status, comprador: body.comprador, contato: body.contato, vendedor: body.vendedor, pagamento: body.pagamento, comprovanteNome: comp.nome, comprovanteUrl: comp.url, origem: m.origem || 'vendedor', validacao: body.status === 'vendida' ? 'aprovada' : (m.validacao || ''), lockOwner: '', lockExpires: '' });
  log_('vendedorSalvarMesa', body.vendedor + ' Mesa ' + body.numero);
  return {};
}

function validarCompra(body) {
  assertVendedor_(body.vendedor, body.token);
  const m = mesaByNumero_(body.numero);
  if (String(m.vendedor) !== String(body.vendedor)) throw new Error('Essa compra pertence a outro vendedor.');
  if (String(m.validacao) !== 'pendente') throw new Error('Compra não está pendente.');
  saveMesa_(m, { status: 'vendida', validacao: 'aprovada', lockOwner: '', lockExpires: '' });
  log_('validarCompra', body.vendedor + ' Mesa ' + body.numero);
  return {};
}

function rejeitarCompra(body) {
  assertVendedor_(body.vendedor, body.token);
  const m = mesaByNumero_(body.numero);
  if (String(m.vendedor) !== String(body.vendedor)) throw new Error('Essa compra pertence a outro vendedor.');
  saveMesa_(m, { status: 'livre', comprador: '', contato: '', vendedor: '', pagamento: '', comprovanteNome: '', comprovanteUrl: '', origem: '', validacao: '', lockOwner: '', lockExpires: '' });
  log_('rejeitarCompra', body.vendedor + ' Mesa ' + body.numero);
  return {};
}

function adminSalvarMesa(body) {
  assertAdmin_(body.token);
  const m = mesaByNumero_(body.numero);
  let comp = { nome: m.comprovanteNome || '', url: m.comprovanteUrl || '' };
  if (body.fileBase64) comp = saveComprovante_(body.comprovanteNome, body.fileBase64, body.mimeType);
  saveMesa_(m, { status: body.status, comprador: body.comprador, contato: body.contato, vendedor: body.vendedor, pagamento: body.pagamento, comprovanteNome: comp.nome, comprovanteUrl: comp.url, origem: m.origem || 'admin', validacao: body.status === 'vendida' ? 'aprovada' : (body.status === 'livre' ? '' : m.validacao), lockOwner: '', lockExpires: '' });
  log_('adminSalvarMesa', 'Mesa ' + body.numero);
  return {};
}

function adminValidarCompra(body) {
  assertAdmin_(body.token);
  const m = mesaByNumero_(body.numero);
  saveMesa_(m, { status: 'vendida', validacao: 'aprovada', lockOwner: '', lockExpires: '' });
  log_('adminValidarCompra', 'Mesa ' + body.numero);
  return {};
}

function adminRejeitarCompra(body) {
  assertAdmin_(body.token);
  const m = mesaByNumero_(body.numero);
  saveMesa_(m, { status: 'livre', comprador: '', contato: '', vendedor: '', pagamento: '', comprovanteNome: '', comprovanteUrl: '', origem: '', validacao: '', lockOwner: '', lockExpires: '' });
  log_('adminRejeitarCompra', 'Mesa ' + body.numero);
  return {};
}

function zerarVendas(body) {
  assertAdmin_(body.token);
  const sh = sh_(SHEETS.MESAS);
  const rows = [];
  for (let i = 1; i <= TOTAL_MESAS; i++) rows.push([i,'livre','','','','','','','','','','','']);
  sh.getRange(2, 1, TOTAL_MESAS, 13).setValues(rows);
  setConfig_('atualizacao', new Date().toLocaleString('pt-BR'));
  log_('zerarVendas', 'Admin');
  return {};
}

function log_(acao, detalhes) {
  sh_(SHEETS.LOGS).appendRow([new Date().toLocaleString('pt-BR'), acao, detalhes || '']);
}
