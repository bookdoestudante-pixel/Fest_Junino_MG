const totalMesas = window.FESTIVAL_TOTAL_MESAS || 70;
const TEMPO_RESERVA_MS = 5 * 60 * 1000;

const pos = {
  1: [65, 80.8], 2: [58, 80.8], 3: [51, 80.8], 4: [44, 80.8], 5: [30, 80.8], 6: [23, 80.8], 7: [16, 80.8],
  8: [65, 76], 9: [58, 76], 10: [51, 76], 11: [44, 76], 12: [30, 76], 13: [23, 76], 14: [16, 76],
  15: [65, 71.20], 16: [58, 71.20], 17: [51, 71.20], 18: [44, 71.20], 19: [30, 71.20], 20: [23, 71.20], 21: [16, 71.20],
  22: [65, 66.4], 23: [58, 66.4], 24: [51, 66.4], 25: [44, 66.4], 26: [30, 66.4], 27: [23, 66.4], 28: [16, 66.4],
  29: [65, 61.60], 30: [58, 61.60], 31: [51, 61.60], 32: [23, 61.60], 33: [16, 61.60],
  34: [65, 56.8], 35: [58, 56.8], 36: [51, 56.8], 37: [23, 56.8], 38: [16, 56.8],
  39: [65, 52], 40: [58, 52], 41: [51, 52], 42: [23, 52], 43: [16, 52],
  44: [65, 47.2], 45: [58, 47.2], 46: [51, 47.2], 47: [23, 47.2], 48: [16, 47.2],
  49: [65, 42.4], 50: [58, 42.4], 51: [51, 42.4], 52: [23, 42.4], 53: [16, 42.4],
  54: [65, 37.6], 55: [58, 37.6], 56: [51, 37.6], 57: [23, 37.6], 58: [16, 37.6],
  59: [65, 32.8], 60: [58, 32.8], 61: [51, 32.8], 62: [23, 32.8], 63: [16, 32.8],
  64: [65, 28], 65: [58, 28], 66: [51, 28], 67: [23, 28], 68: [16, 28],
  69: [23, 24], 70: [16, 24]
};

function el(id) { return document.getElementById(id); }
function moneyOrBlank(v) { return v || ''; }
function nowLabel() { return new Date().toLocaleString('pt-BR'); }
function padMesa(n) { return String(n).padStart(2, '0'); }

function safeText(v) {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    "'":'&#39;',
    '"':'&quot;'
  }[c]));
}

function normalizarTelefone(tel) {
  return String(tel || '').replace(/\D/g, '');
}

function linkWhatsApp(tel) {
  const numero = normalizarTelefone(tel);
  if (!numero) return '#';
  return numero.startsWith('55') ? `https://wa.me/${numero}` : `https://wa.me/55${numero}`;
}

function nomeArquivoSeguro(nome) {
  return String(nome || 'Sem nome')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ') || 'Sem nome';
}

function getNomeVendedor(v) {
  return typeof v === 'string' ? v : v.nome;
}

function getTelefoneVendedor(v) {
  return typeof v === 'string' ? '' : v.telefone;
}

function getVendedorPorNome(vendedores, nome) {
  return vendedores.find(v => getNomeVendedor(v) === nome);
}

function mesaPadrao(numero) {
  return {
    numero,
    status: 'livre',
    comprador: '',
    contato: '',
    vendedor: '',
    pagamento: '',
    comprovanteNome: '',
    comprovanteUrl: '',
    origem: '',
    validacao: '',
    lockOwner: '',
    lockExpires: 0
  };
}

function statusVisualMesa(mesa) {
  if (!mesa) return 'livre';
  if (mesa.status === 'vendida') return 'vendida';
  if (mesa.validacao === 'pendente') return 'pendente';
  if (mesa.status === 'reservada') return 'reservada';
  if (mesa.lockExpires && Number(mesa.lockExpires) > Date.now()) return 'reservada';
  return 'livre';
}

function preencherInfo(info = {}) {
  if (el('txtValor')) el('txtValor').textContent = moneyOrBlank(info.valor);
  if (el('txtData')) el('txtData').textContent = formatarDataMapa(info.data);
  if (el('txtHorario')) el('txtHorario').textContent = moneyOrBlank(info.hora);
  if (el('txtLocal')) el('txtLocal').textContent = moneyOrBlank(info.local);
  if (el('txtAtualizacao')) el('txtAtualizacao').textContent = formatarDataHoraMapa(info.atualizacao);
}

function renderVendedoresMapa(vendedores = []) {
  const wrap = el('txtVendedores');
  if (!wrap) return;

  wrap.innerHTML = '';

  vendedores.forEach(v => {
    const tel = getTelefoneVendedor(v);
    if (!tel) return;

    const nome = getNomeVendedor(v);

    const mensagem = encodeURIComponent(
      `Olá, tudo bem?\n\n` +
      `Tenho interesse nas mesas do Festival Junino.\n` +
      `Você pode me ajudar com mais informações?\n\n` +
      `Vendedor: ${nome}`
    );

    const link = `${linkWhatsApp(tel)}?text=${mensagem}`;

    const a = document.createElement('a');
    a.href = link;
    a.target = '_blank';
    a.innerHTML = `💬 Falar com ${nome}`;

    wrap.appendChild(a);
  });
}

function renderMapa(mesas = [], options = {}) {
  const overlay = el('overlayMesas');
  if (!overlay) return;

  overlay.innerHTML = '';

  const map = new Map(mesas.map(m => [Number(m.numero), m]));

  for (let n = 1; n <= totalMesas; n++) {
    if (!pos[n]) continue;

    const mesa = map.get(n) || mesaPadrao(n);
    const [x, y] = pos[n];
    const visual = statusVisualMesa(mesa);

    const b = document.createElement('button');
    b.type = 'button';
    b.className = `mesa-btn ${visual}`;
    b.style.left = x + '%';
    b.style.top = y + '%';
    b.textContent = padMesa(n);
    b.title = `Mesa ${padMesa(n)} - ${visual}`;

    const canClick = typeof options.canClick === 'function'
      ? options.canClick(mesa)
      : false;

    if (canClick) {
      b.onclick = () => options.onMesaClick && options.onMesaClick(n, mesa);
    } else {
      b.classList.add('bloqueada');
    }

    overlay.appendChild(b);
  }
}

function iniciarTimerReserva(mesa, tempoEl, onExpire) {
  let interval = null;

  const tick = () => {
    const restante = Number(mesa.lockExpires || 0) - Date.now();

    if (restante <= 0) {
      tempoEl.textContent = 'Tempo esgotado. Reserva descartada.';
      clearInterval(interval);
      onExpire && onExpire();
      return;
    }

    const min = Math.floor(restante / 60000);
    const seg = Math.floor((restante % 60000) / 1000);

    tempoEl.textContent =
      `Tempo para concluir: ${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  };

  tick();
  interval = setInterval(tick, 1000);

  return () => clearInterval(interval);
}

function baixarTexto(nomeArquivo, conteudo) {
  const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(a.href);
}

function mensagemValidacaoWhatsApp(mesa, comprador, contato) {
  return encodeURIComponent(
    `Olá! Existe uma compra aguardando validação.\n\n` +
    `Mesa: ${padMesa(mesa)}\n` +
    `Comprador: ${comprador}\n` +
    `Contato: ${contato}\n\n` +
    `Verifique o comprovante e valide a compra no sistema.`
  );
}

function setLoading(btn, loading, texto = 'Aguarde...') {
  if (!btn) return;

  if (loading) {
    btn.dataset.oldText = btn.textContent;
    btn.textContent = texto;
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.oldText || btn.textContent;
    btn.disabled = false;
  }
}

function formatarDataHora(dataIso) {
  if (!dataIso) return '';

  const d = new Date(dataIso);

  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();

  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const seg = String(d.getSeconds()).padStart(2, '0');

  return `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;
}

function formatarDataMapa(valor) {
  if (!valor) return '';

  const texto = String(valor);

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    return texto;
  }

  const d = new Date(valor);
  if (isNaN(d.getTime())) return texto;

  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();

  return `${dia}/${mes}/${ano}`;
}

function formatarDataHoraMapa(valor) {
  if (!valor) return '';

  const texto = String(valor);

  if (/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(texto)) {
    return texto;
  }

  const d = new Date(valor);
  if (isNaN(d.getTime())) return texto;

  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();

  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const seg = String(d.getSeconds()).padStart(2, '0');

  return `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;
}

/* MENU DO BOTÃO + */
document.addEventListener('DOMContentLoaded', () => {
  const fabBtn = document.getElementById('fabBtn');
  const fabOptions = document.getElementById('fabOptions');

  if (!fabBtn || !fabOptions) return;

  fabBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    fabOptions.classList.toggle('show');
    fabBtn.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.fab-menu')) {
      fabOptions.classList.remove('show');
      fabBtn.classList.remove('open');
    }
  });
});

/* ZOOM POR PINÇA SOMENTE NO MAPA - SEM BLOQUEAR CLIQUE NAS MESAS */
document.addEventListener('DOMContentLoaded', () => {
  const area = document.querySelector('.mapa-card');
  const mapa = document.querySelector('.mapa-wrap');

  if (!area || !mapa) return;

  let scale = 1;
  let posX = 0;
  let posY = 0;

  let startScale = 1;
  let startDistance = 0;
  let startPosX = 0;
  let startPosY = 0;
  let startMidX = 0;
  let startMidY = 0;

  let startPanX = 0;
  let startPanY = 0;
  let startTouchX = 0;
  let startTouchY = 0;

  const touches = new Map();

  function applyTransform() {
    mapa.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
  }

  function getPoint(e) {
    return { x: e.clientX, y: e.clientY };
  }

  function getTwoPoints() {
    return Array.from(touches.values()).slice(0, 2);
  }

  function distance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  function midpoint(p1, p2) {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
  }

  function clampScale(v) {
    return Math.max(1, Math.min(v, 4));
  }

  area.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;

    touches.set(e.pointerId, getPoint(e));

    if (touches.size === 2) {
      e.preventDefault();

      const [p1, p2] = getTwoPoints();

      startDistance = distance(p1, p2);
      startScale = scale;

      const mid = midpoint(p1, p2);
      const rect = area.getBoundingClientRect();

      startMidX = mid.x - rect.left;
      startMidY = mid.y - rect.top;

      startPosX = posX;
      startPosY = posY;
    }

    if (touches.size === 1 && scale > 1) {
      startTouchX = e.clientX;
      startTouchY = e.clientY;
      startPanX = posX;
      startPanY = posY;
    }
  }, { passive: false });

  area.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;

    touches.set(e.pointerId, getPoint(e));

    if (touches.size === 2) {
      e.preventDefault();

      const [p1, p2] = getTwoPoints();
      const newDistance = distance(p1, p2);

      if (!startDistance) return;

      const newScale = clampScale(startScale * (newDistance / startDistance));
      const ratio = newScale / startScale;

      scale = newScale;

      const mid = midpoint(p1, p2);
      const rect = area.getBoundingClientRect();

      const currentMidX = mid.x - rect.left;
      const currentMidY = mid.y - rect.top;

      posX = currentMidX - (startMidX - startPosX) * ratio;
      posY = currentMidY - (startMidY - startPosY) * ratio;

      applyTransform();
      return;
    }

    if (touches.size === 1 && scale > 1) {
      e.preventDefault();

      posX = startPanX + (e.clientX - startTouchX);
      posY = startPanY + (e.clientY - startTouchY);

      applyTransform();
    }
  }, { passive: false });

  function endPointer(e) {
    touches.delete(e.pointerId);

    if (scale <= 1.03) {
      scale = 1;
      posX = 0;
      posY = 0;
      applyTransform();
    }

    if (touches.size === 1 && scale > 1) {
      const [p] = Array.from(touches.values());
      startTouchX = p.x;
      startTouchY = p.y;
      startPanX = posX;
      startPanY = posY;
    }
  }

  area.addEventListener('pointerup', endPointer);
  area.addEventListener('pointercancel', endPointer);
});