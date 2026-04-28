# Sistema Festival Junino — Vercel + Google Sheets + Google Drive

Este pacote separa o sistema em três módulos:

- `index.html` — módulo do cliente, limpo para divulgação por WhatsApp.
- `vendedor.html` — módulo do vendedor, com login por nome e PIN.
- `admin.html` — módulo do administrador, com login por senha.

## Estrutura

```text
festival-vercel-google/
├── index.html
├── vendedor.html
├── admin.html
├── style.css
├── config.js
├── api.js
├── common.js
├── cliente.js
├── vendedor.js
├── admin.js
├── assets/
│   └── croqui.png
└── apps-script/
    └── Code.gs
```

## Passo 1 — Croqui

Coloque sua imagem do croqui em:

```text
assets/croqui.png
```

## Passo 2 — Google Sheets

Crie uma planilha no Google Sheets. Copie o ID da planilha pela URL:

```text
https://docs.google.com/spreadsheets/d/ID_DA_PLANILHA/edit
```

## Passo 3 — Google Drive

Crie uma pasta no Google Drive para os comprovantes. Copie o ID da pasta pela URL:

```text
https://drive.google.com/drive/folders/ID_DA_PASTA
```

## Passo 4 — Apps Script

1. Abra `script.google.com`.
2. Crie um novo projeto.
3. Cole o conteúdo de `apps-script/Code.gs`.
4. No topo do arquivo, preencha:
   - `SPREADSHEET_ID`
   - `DRIVE_FOLDER_ID`
   - `ADMIN_PASSWORD`
5. Execute a função `setup()` uma vez.
6. Publique em **Implantar > Nova implantação > App da Web**.
7. Selecione:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
8. Copie a URL terminada em `/exec`.

## Passo 5 — Configurar o site

Abra `config.js` e troque:

```js
window.FESTIVAL_API_URL = 'COLE_AQUI_A_URL_DO_APPS_SCRIPT';
```

pela URL do Apps Script.

## Passo 6 — Vercel

1. Crie um repositório no GitHub com esses arquivos.
2. Entre na Vercel.
3. Clique em **Add New > Project**.
4. Importe o repositório.
5. Deploy.

Links finais:

```text
https://seu-projeto.vercel.app/           → cliente
https://seu-projeto.vercel.app/vendedor.html → vendedor
https://seu-projeto.vercel.app/admin.html    → admin
```

## Observações importantes

- O comprovante é enviado para o Google Drive e o link é salvo na planilha.
- A mesa fica bloqueada por 5 minutos quando alguém inicia a compra.
- Cliente só consegue reservar com comprovante, pagamento e vendedor escolhido.
- Compra feita pelo cliente fica como `reservada` e `pendente` até o vendedor validar.
- Vendedor só valida compras vinculadas ao próprio nome.
- Admin pode alterar, validar, rejeitar e desfazer vendas.
