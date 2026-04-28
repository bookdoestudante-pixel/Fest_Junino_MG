let dados = { info: {}, vendedores: [], mesas: [], config: {} };
let mesaAtual = null;
let lockOwner = '';
let pararTimer = null;
let comprovanteSelecionado = null;

async function carregar() {
  try {
    dados = (await api('publicData')).data;
    preencherInfo(dados.info);
    renderVendedoresMapa(dados.vendedores);
    renderMapa(dados.mesas, {
      canClick: mesa => dados.config.clientePodeComprar && statusVisualMesa(mesa) === 'livre',
      onMesaClick: abrirMesaCliente
    });
    el('clienteAviso').textContent = dados.config.clientePodeComprar ? '' : 'A compra direta pelo mapa está temporariamente desativada.';
  } catch (err) {
    el('clienteAviso').textContent = err.message;
  }
}

function preencherVendedores() {
  el('mesaVendedor').innerHTML = '<option value="">Selecione o vendedor</option>' +
    dados.vendedores.map(v => `<option value="${safeText(getNomeVendedor(v))}">${safeText(getNomeVendedor(v))}</option>`).join('');
}

function atualizarNomeComprovante() {
  const file = comprovanteSelecionado;
  if (!file || !mesaAtual) {
    el('nomeComprovante').textContent = '';
    return;
  }
  const comprador = nomeArquivoSeguro(el('mesaComprador').value);
  const ext = file.name.split('.').pop();
  el('nomeComprovante').textContent = `Nome sugerido: Mesa ${padMesa(mesaAtual)} - ${comprador}.${ext}`;
}

async function abrirMesaCliente(numero) {
  if (!dados.config.clientePodeComprar) return alert('A compra direta está desativada no momento.');
  try {
    const r = await api('lockMesa', { numero, papel: 'cliente' });
    mesaAtual = numero;
    lockOwner = r.lockOwner;
    comprovanteSelecionado = null;
    el('tituloMesa').textContent = 'Mesa ' + padMesa(numero);
    el('mesaComprador').value = '';
    el('mesaContato').value = '';
    el('mesaPagamento').value = '';
    el('mesaComprovante').value = '';
    el('nomeComprovante').textContent = '';
    el('avisoMesa').textContent = '';
    el('msgVendedorBox').style.display = 'none';
    el('msgVendedorBox').innerHTML = '';
    preencherVendedores();
    el('modalMesa').showModal();
    if (pararTimer) pararTimer();
    pararTimer = iniciarTimerReserva({ lockExpires: r.lockExpires }, el('tempoReserva'), async () => cancelarCompra());
    await carregar();
  } catch (err) {
    alert(err.message);
    await carregar();
  }
}

async function cancelarCompra() {
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

el('mesaComprador').addEventListener('input', atualizarNomeComprovante);
el('mesaComprovante').addEventListener('change', () => {
  comprovanteSelecionado = el('mesaComprovante').files[0] || null;
  atualizarNomeComprovante();
});
el('cancelarMesa').onclick = e => { e.preventDefault(); cancelarCompra(); };

el('salvarMesa').onclick = async e => {
  e.preventDefault();
  const comprador = el('mesaComprador').value.trim();
  const contato = el('mesaContato').value.trim();
  const vendedor = el('mesaVendedor').value;
  const pagamento = el('mesaPagamento').value;
  const file = comprovanteSelecionado;
  if (!comprador) return el('avisoMesa').textContent = 'Informe o nome do comprador.';
  if (!contato) return el('avisoMesa').textContent = 'Informe o telefone.';
  if (!vendedor) return el('avisoMesa').textContent = 'Escolha obrigatoriamente um vendedor.';
  if (!pagamento) return el('avisoMesa').textContent = 'Escolha Pix ou Transferência.';
  if (!file) return el('avisoMesa').textContent = 'Envie o comprovante de pagamento.';
  try {
    setLoading(el('salvarMesa'), true, 'Enviando...');
    el('avisoMesa').textContent = 'Enviando comprovante e registrando compra...';
    const ext = file.name.split('.').pop();
    const comprovanteNome = `Mesa ${padMesa(mesaAtual)} - ${nomeArquivoSeguro(comprador)}.${ext}`;
    const fileBase64 = await fileToBase64(file);
    await api('clienteComprar', { numero: mesaAtual, lockOwner, comprador, contato, vendedor, pagamento, comprovanteNome, fileBase64, mimeType: file.type || 'application/octet-stream' });
    const vendedorObj = getVendedorPorNome(dados.vendedores, vendedor);
    const telefone = getTelefoneVendedor(vendedorObj);
    if (telefone) window.open(`${linkWhatsApp(telefone)}?text=${mensagemValidacaoWhatsApp(mesaAtual, comprador, contato)}`, '_blank');
    alert('Compra enviada. A mesa ficará aguardando validação do vendedor.');
    if (pararTimer) pararTimer();
    el('modalMesa').close();
    mesaAtual = null;
    lockOwner = '';
    comprovanteSelecionado = null;
    await carregar();
  } catch (err) {
    el('avisoMesa').textContent = err.message;
  } finally {
    setLoading(el('salvarMesa'), false);
  }
};

setInterval(carregar, 15000);
carregar();
