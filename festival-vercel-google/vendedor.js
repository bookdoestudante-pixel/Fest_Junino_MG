let dados = { info: {}, vendedores: [], mesas: [], config: {} };
let vendedorSessao = JSON.parse(localStorage.getItem('festival_vendedor') || 'null');
let mesaAtual = null;
let lockOwner = '';
let pararTimer = null;
let comprovanteSelecionado = null;
let intervaloVendedor = null;

async function carregarPublico() {
  dados = (await api('publicData')).data;
  const sel = el('loginVendedor');
  sel.innerHTML = '<option value="">Selecione</option>' + dados.vendedores.map(v => `<option value="${safeText(getNomeVendedor(v))}">${safeText(getNomeVendedor(v))}</option>`).join('');
}

async function carregar() {
  dados = (await api('vendedorData', { vendedor: vendedorSessao.nome, token: vendedorSessao.token })).data;
  preencherInfo(dados.info);
  renderVendedoresMapa(dados.vendedores);
  renderMapa(dados.mesas, {
    canClick: mesa => {
      const visual = statusVisualMesa(mesa);
      if (visual === 'vendida') return false;
      if (mesa.validacao === 'pendente' && mesa.vendedor !== vendedorSessao.nome) return false;
      if (mesa.status === 'reservada' && mesa.vendedor && mesa.vendedor !== vendedorSessao.nome) return false;
      return true;
    },
    onMesaClick: abrirMesaVendedor
  });
  renderPendentes();
}

function renderPendentes() {
  const pend = dados.mesas.filter(m => m.validacao === 'pendente' && m.vendedor === vendedorSessao.nome);
  const wrap = el('listaPendentes');
  if (!pend.length) {
    wrap.innerHTML = '<p class="hint">Nenhuma compra pendente para você.</p>';
    return;
  }
  wrap.innerHTML = pend.map(m => `<div class="registro"><strong>Mesa ${padMesa(m.numero)}<br><small>${safeText(m.comprador || '')}</small></strong><span class="tag pendente">pendente</span><button type="button" onclick="abrirMesaVendedor(${Number(m.numero)})">Abrir</button></div>`).join('');
}

async function abrirMesaVendedor(numero) {
  const mesa = dados.mesas.find(m => Number(m.numero) === Number(numero)) || mesaPadrao(numero);
  if (mesa.status === 'vendida') return alert('Essa mesa já foi vendida. Somente o Admin pode alterar.');
  if (mesa.status === 'reservada' && mesa.vendedor && mesa.vendedor !== vendedorSessao.nome) return alert('Essa mesa está reservada por outro vendedor.');

  try {
    let lock = null;
    if (!mesa.validacao) {
      lock = await api('lockMesa', { numero, papel: 'vendedor', vendedor: vendedorSessao.nome, token: vendedorSessao.token });
      lockOwner = lock.lockOwner;
    } else {
      lockOwner = '';
    }
    mesaAtual = numero;
    comprovanteSelecionado = null;
    el('tituloMesa').textContent = 'Mesa ' + padMesa(numero);
    el('mesaStatus').value = mesa.validacao === 'pendente' ? 'reservada' : (mesa.status === 'livre' ? 'vendida' : mesa.status);
    el('mesaComprador').value = mesa.comprador || '';
    el('mesaContato').value = mesa.contato || '';
    el('mesaVendedor').value = vendedorSessao.nome;
    el('mesaPagamento').value = mesa.pagamento || '';
    el('mesaComprovante').value = '';
    el('nomeComprovante').textContent = '';
    el('avisoMesa').textContent = '';
    el('validacaoBox').style.display = mesa.validacao === 'pendente' ? 'block' : 'none';
    el('linkComprovante').innerHTML = mesa.comprovanteUrl ? `<a href="${safeText(mesa.comprovanteUrl)}" target="_blank" rel="noopener">Abrir comprovante salvo</a>` : '';
    el('modalMesa').showModal();
    if (pararTimer) pararTimer();
    if (lock && lock.lockExpires) pararTimer = iniciarTimerReserva({ lockExpires: lock.lockExpires }, el('tempoReserva'), cancelarMesa);
    else el('tempoReserva').textContent = '';
    await carregar();
  } catch (err) {
    alert(err.message);
    await carregar();
  }
}
window.abrirMesaVendedor = abrirMesaVendedor;

async function cancelarMesa() {
  if (mesaAtual && lockOwner) {
    try { await api('releaseLock', { numero: mesaAtual, lockOwner }); } catch (e) {}
  }
  if (pararTimer) pararTimer();
  mesaAtual = null;
  lockOwner = '';
  comprovanteSelecionado = null;
  if (el('modalMesa').open) el('modalMesa').close();
  await carregar();
}

el('btnLogin').onclick = async () => {
  try {
    const vendedor = el('loginVendedor').value;
    const pin = el('loginPin').value.trim();
    if (!vendedor) return el('loginAviso').textContent = 'Selecione o vendedor.';
    if (!pin) return el('loginAviso').textContent = 'Informe o PIN.';
    const r = await api('loginVendedor', { vendedor, pin });
    vendedorSessao = { nome: vendedor, token: r.token };
    localStorage.setItem('festival_vendedor', JSON.stringify(vendedorSessao));
    iniciarSessao();
  } catch (err) { el('loginAviso').textContent = err.message; }
};
el('btnSair').onclick = () => { localStorage.removeItem('festival_vendedor'); vendedorSessao = null; location.reload(); };
el('mesaComprovante').onchange = () => {
  comprovanteSelecionado = el('mesaComprovante').files[0] || null;
  if (!comprovanteSelecionado) return el('nomeComprovante').textContent = '';
  const ext = comprovanteSelecionado.name.split('.').pop();
  el('nomeComprovante').textContent = `Nome sugerido: Mesa ${padMesa(mesaAtual)} - ${nomeArquivoSeguro(el('mesaComprador').value)}.${ext}`;
};
el('mesaComprador').oninput = () => {
  if (!comprovanteSelecionado) return;
  const ext = comprovanteSelecionado.name.split('.').pop();
  el('nomeComprovante').textContent = `Nome sugerido: Mesa ${padMesa(mesaAtual)} - ${nomeArquivoSeguro(el('mesaComprador').value)}.${ext}`;
};
el('cancelarMesa').onclick = e => { e.preventDefault(); cancelarMesa(); };

el('salvarMesa').onclick = async e => {
  e.preventDefault();
  const status = el('mesaStatus').value;
  const comprador = el('mesaComprador').value.trim();
  const contato = el('mesaContato').value.trim();
  const pagamento = el('mesaPagamento').value;
  if (!comprador) return el('avisoMesa').textContent = 'Informe o comprador.';
  if (!contato) return el('avisoMesa').textContent = 'Informe o contato.';
  if (!pagamento) return el('avisoMesa').textContent = 'Informe o pagamento.';
  const mesa = dados.mesas.find(m => Number(m.numero) === Number(mesaAtual)) || {};
  if (status === 'vendida' && !comprovanteSelecionado && !mesa.comprovanteUrl) return el('avisoMesa').textContent = 'Para vender, selecione ou mantenha um comprovante.';
  try {
    setLoading(el('salvarMesa'), true, 'Salvando...');
    let fileBase64 = '', comprovanteNome = '', mimeType = '';
    if (comprovanteSelecionado) {
      const ext = comprovanteSelecionado.name.split('.').pop();
      comprovanteNome = `Mesa ${padMesa(mesaAtual)} - ${nomeArquivoSeguro(comprador)}.${ext}`;
      fileBase64 = await fileToBase64(comprovanteSelecionado);
      mimeType = comprovanteSelecionado.type || 'application/octet-stream';
    }
    await api('vendedorSalvarMesa', { token: vendedorSessao.token, vendedor: vendedorSessao.nome, numero: mesaAtual, lockOwner, status, comprador, contato, pagamento, comprovanteNome, fileBase64, mimeType });
    await cancelarMesa();
  } catch (err) { el('avisoMesa').textContent = err.message; }
  finally { setLoading(el('salvarMesa'), false); }
};

el('btnValidarCompra').onclick = async e => { e.preventDefault(); try { await api('validarCompra', { token: vendedorSessao.token, vendedor: vendedorSessao.nome, numero: mesaAtual }); await cancelarMesa(); } catch (err) { el('avisoMesa').textContent = err.message; } };
el('btnRejeitarCompra').onclick = async e => { e.preventDefault(); if (!confirm('Rejeitar a compra e liberar a mesa?')) return; try { await api('rejeitarCompra', { token: vendedorSessao.token, vendedor: vendedorSessao.nome, numero: mesaAtual }); await cancelarMesa(); } catch (err) { el('avisoMesa').textContent = err.message; } };

async function iniciarSessao() {
  el('loginBox').classList.add('hidden');
  el('appVendedor').classList.remove('hidden');
  el('modoAviso').textContent = '🧑‍💼 ' + vendedorSessao.nome;
  await carregar();
  if (intervaloVendedor) clearInterval(intervaloVendedor);
  intervaloVendedor = setInterval(() => carregar().catch(() => {}), 15000);
}

(async () => {
  try {
    await carregarPublico();
    if (vendedorSessao?.token) await iniciarSessao();
  } catch (err) { el('loginAviso').textContent = err.message; }
})();
