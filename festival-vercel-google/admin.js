let dados = { info: {}, vendedores: [], mesas: [], config: {} };
let adminToken = localStorage.getItem('festival_admin_token') || '';
let mesaAtual = null;
let comprovanteSelecionado = null;
let intervaloAdmin = null;

async function carregar() {
  dados = (await api('adminData', { token: adminToken })).data;

  preencherInfo(dados.info);
  renderVendedoresMapa(dados.vendedores);
  renderMapa(dados.mesas, { canClick: () => true, onMesaClick: abrirMesaAdmin });

  preencherPainel();
  renderVendedoresAdmin();
  renderResumo();
}

function preencherPainel() {
  el('valorMesa').value = dados.info.valor || '';
  el('dataEvento').value = formatarData(dados.info.data);
  el('horarioEvento').value = dados.info.hora || '';
  el('localEvento').value = dados.info.local || '';
  el('ultimaAtualizacao').value = formatarDataHora(dados.info.atualizacao);
  el('clientePodeComprar').checked = dados.config.clientePodeComprar !== false;
}

function formatarData(valor) {
  if (!valor) return '';

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(valor))) {
    return valor;
  }

  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;

  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();

  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(valor) {
  if (!valor) return '';

  if (/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(String(valor))) {
    return valor;
  }

  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;

  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();

  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const seg = String(d.getSeconds()).padStart(2, '0');

  return `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;
}

function limitePorVendedor() {
  return Math.ceil(totalMesas / Math.max(1, dados.vendedores.length));
}

function contagem(nome) {
  return dados.mesas.filter(m =>
    m.vendedor === nome && (m.status === 'vendida' || m.status === 'reservada')
  ).length;
}

function renderVendedoresAdmin() {
  const wrap = el('listaVendedores');

  if (!dados.vendedores.length) {
    wrap.innerHTML = '<p class="hint">Nenhum vendedor cadastrado.</p>';
    return;
  }

  wrap.innerHTML = dados.vendedores.map(v => `
    <div class="vendedor">
      <strong>
        ${safeText(v.nome)}
        <br>
        <small>${safeText(v.telefone || 'Sem telefone')} · PIN: ${safeText(v.pin || '-')}</small>
      </strong>
      <span class="tag">${contagem(v.nome)}/${limitePorVendedor()}</span>
      <button type="button" onclick="removerVendedor('${String(v.nome).replace(/'/g, "\\'")}')">x</button>
    </div>
  `).join('');
}

function renderResumo() {
  const reservadas = dados.mesas.filter(m => m.status === 'reservada').length;
  const vendidas = dados.mesas.filter(m => m.status === 'vendida').length;
  const pendentes = dados.mesas.filter(m => m.validacao === 'pendente').length;
  const livres = totalMesas - reservadas - vendidas;

  el('resumo').innerHTML = `
    <div class="resumo-linha"><b>Livres</b><span>${livres}</span></div>
    <div class="resumo-linha"><b>Reservadas</b><span>${reservadas}</span></div>
    <div class="resumo-linha"><b>Pendentes</b><span>${pendentes}</span></div>
    <div class="resumo-linha"><b>Vendidas</b><span>${vendidas}</span></div>
    <div class="resumo-linha"><b>Limite/vendedor</b><span>${limitePorVendedor()}</span></div>
  `;
}

function abrirMesaAdmin(numero) {
  const mesa = dados.mesas.find(m => Number(m.numero) === Number(numero)) || mesaPadrao(numero);

  mesaAtual = numero;
  comprovanteSelecionado = null;

  el('tituloMesa').textContent = 'Mesa ' + padMesa(numero);
  el('mesaStatus').value = mesa.status || 'livre';
  el('mesaComprador').value = mesa.comprador || '';
  el('mesaContato').value = mesa.contato || '';
  el('mesaPagamento').value = mesa.pagamento || '';
  el('mesaComprovante').value = '';
  el('nomeComprovante').textContent = '';
  el('avisoMesa').textContent = '';

  el('mesaVendedor').innerHTML =
    '<option value="">Sem vendedor</option>' +
    dados.vendedores.map(v => `<option value="${safeText(v.nome)}">${safeText(v.nome)}</option>`).join('');

  el('mesaVendedor').value = mesa.vendedor || '';

  el('validacaoBox').style.display = mesa.validacao === 'pendente' ? 'block' : 'none';

  el('linkComprovante').innerHTML = mesa.comprovanteUrl
    ? `<a href="${safeText(mesa.comprovanteUrl)}" target="_blank" rel="noopener">Abrir comprovante salvo</a>`
    : '';

  el('btnExcluirMesa').style.display = mesa.status !== 'livre' ? 'block' : 'none';

  el('modalMesa').showModal();
}

el('btnLoginAdmin').onclick = async () => {
  try {
    const r = await api('loginAdmin', { senha: el('adminSenha').value });
    adminToken = r.token;
    localStorage.setItem('festival_admin_token', adminToken);
    iniciarAdmin();
  } catch (err) {
    el('loginAviso').textContent = err.message;
  }
};

el('btnSair').onclick = () => {
  localStorage.removeItem('festival_admin_token');
  adminToken = '';
  location.reload();
};

el('salvarInfo').onclick = async () => {
  try {
    setLoading(el('salvarInfo'), true, 'Salvando...');

    await api('salvarConfig', {
      token: adminToken,
      info: {
        valor: el('valorMesa').value,
        data: el('dataEvento').value,
        hora: el('horarioEvento').value,
        local: el('localEvento').value,
        atualizacao: el('ultimaAtualizacao').value || nowLabel()
      },
      config: {
        clientePodeComprar: el('clientePodeComprar').checked
      }
    });

    await carregar();
    alert('Informações salvas.');
  } catch (err) {
    alert(err.message);
  } finally {
    setLoading(el('salvarInfo'), false);
  }
};

el('addVendedor').onclick = async () => {
  const nome = el('novoVendedor').value.trim();
  const telefone = el('novoTelefone').value.trim();
  const pin = el('novoPin').value.trim();

  if (!nome) return alert('Informe o nome do vendedor.');
  if (!pin) return alert('Informe um PIN para o vendedor.');

  try {
    await api('salvarVendedor', { token: adminToken, nome, telefone, pin });

    el('novoVendedor').value = '';
    el('novoTelefone').value = '';
    el('novoPin').value = '';

    await carregar();
  } catch (err) {
    alert(err.message);
  }
};

async function removerVendedor(nome) {
  if (!confirm('Remover vendedor?')) return;

  try {
    await api('removerVendedor', { token: adminToken, nome });
    await carregar();
  } catch (err) {
    alert(err.message);
  }
}

window.removerVendedor = removerVendedor;

el('mesaComprovante').onchange = () => {
  comprovanteSelecionado = el('mesaComprovante').files[0] || null;

  if (!comprovanteSelecionado) {
    el('nomeComprovante').textContent = '';
    return;
  }

  const ext = comprovanteSelecionado.name.split('.').pop();

  el('nomeComprovante').textContent =
    `Nome sugerido: Mesa ${padMesa(mesaAtual)} - ${nomeArquivoSeguro(el('mesaComprador').value)}.${ext}`;
};

el('cancelarMesa').onclick = e => {
  e.preventDefault();
  el('modalMesa').close();
};

el('salvarMesa').onclick = async e => {
  e.preventDefault();

  try {
    setLoading(el('salvarMesa'), true, 'Salvando...');

    let fileBase64 = '';
    let comprovanteNome = '';
    let mimeType = '';

    if (comprovanteSelecionado) {
      const ext = comprovanteSelecionado.name.split('.').pop();
      comprovanteNome = `Mesa ${padMesa(mesaAtual)} - ${nomeArquivoSeguro(el('mesaComprador').value)}.${ext}`;
      fileBase64 = await fileToBase64(comprovanteSelecionado);
      mimeType = comprovanteSelecionado.type || 'application/octet-stream';
    }

    await api('adminSalvarMesa', {
      token: adminToken,
      numero: mesaAtual,
      status: el('mesaStatus').value,
      comprador: el('mesaComprador').value.trim(),
      contato: el('mesaContato').value.trim(),
      vendedor: el('mesaVendedor').value,
      pagamento: el('mesaPagamento').value,
      comprovanteNome,
      fileBase64,
      mimeType
    });

    el('modalMesa').close();
    await carregar();
  } catch (err) {
    el('avisoMesa').textContent = err.message;
  } finally {
    setLoading(el('salvarMesa'), false);
  }
};

el('btnValidarCompra').onclick = async e => {
  e.preventDefault();

  try {
    await api('adminValidarCompra', { token: adminToken, numero: mesaAtual });
    el('modalMesa').close();
    await carregar();
  } catch (err) {
    el('avisoMesa').textContent = err.message;
  }
};

el('btnRejeitarCompra').onclick = async e => {
  e.preventDefault();

  if (!confirm('Rejeitar e liberar a mesa?')) return;

  try {
    await api('adminRejeitarCompra', { token: adminToken, numero: mesaAtual });
    el('modalMesa').close();
    await carregar();
  } catch (err) {
    el('avisoMesa').textContent = err.message;
  }
};

el('btnExcluirMesa').onclick = async e => {
  e.preventDefault();

  if (!confirm('Deseja EXCLUIR esta venda e liberar a mesa?')) return;
  if (!confirm('Essa ação não pode ser desfeita. Confirmar novamente?')) return;

  try {
    await api('adminRejeitarCompra', {
      token: adminToken,
      numero: mesaAtual
    });

    el('modalMesa').close();
    await carregar();
  } catch (err) {
    el('avisoMesa').textContent = err.message;
  }
};

el('btnAtualizar').onclick = carregar;

el('btnExportar').onclick = () => {
  const linhas = ['RELATÓRIO DE MESAS - FESTIVAL JUNINO', ''];

  dados.mesas.forEach(m => {
    linhas.push(
      `Mesa ${padMesa(m.numero)} | ${m.status} | ${m.validacao || '-'} | ${m.comprador || '-'} | ${m.contato || '-'} | ${m.vendedor || '-'} | ${m.pagamento || '-'} | ${m.comprovanteUrl || '-'}`
    );
  });

  baixarTexto('relatorio-mesas-festival.txt', linhas.join('\n'));
};

el('btnZerar').onclick = async () => {
  if (!confirm('Tem certeza que deseja zerar todas as vendas?')) return;
  if (!confirm('Isso é irreversível. Confirmar novamente?')) return;

  try {
    await api('zerarVendas', { token: adminToken });
    await carregar();
  } catch (err) {
    alert(err.message);
  }
};

async function iniciarAdmin() {
  el('loginBox').classList.add('hidden');
  el('appAdmin').classList.remove('hidden');

  await carregar();

  if (intervaloAdmin) clearInterval(intervaloAdmin);

  intervaloAdmin = setInterval(() => {
    carregar().catch(() => {});
  }, 15000);
}

if (adminToken) {
  iniciarAdmin().catch(() => {
    localStorage.removeItem('festival_admin_token');
    location.reload();
  });
}