const API_URL = window.FESTIVAL_API_URL;

function assertApiConfigured() {
  if (!API_URL || !String(API_URL).startsWith('https://script.google.com/macros/s/')) {
    throw new Error('Configure corretamente a URL do Apps Script no arquivo config.js');
  }
}

async function api(action, data = {}) {
  assertApiConfigured();

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...data })
    });
  } catch (e) {
    throw new Error('Falha de conexão com a API. Verifique internet, URL do Apps Script e publicação do Web App.');
  }

  const text = await res.text();
  let json;

  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error('Resposta inválida da API: ' + text.slice(0, 250));
  }

  if (!json.ok) {
    throw new Error(json.error || 'Erro na API');
  }

  return json;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
