# Deploy no Vercel com Google Planilhas

Este projeto agora pode rodar no Vercel usando a rota `api/google-sheets.js`.

## Variaveis no Vercel

No painel do Vercel, cadastre:

- `GOOGLE_SHEETS_SPREADSHEET_ID`: o ID da planilha que o sistema deve usar.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: email da conta de servico do Google Cloud.
- `GOOGLE_PRIVATE_KEY`: chave privada da conta de servico, mantendo `\n` nas quebras de linha.
- `DEFAULT_USER_EMAIL`: email administrativo padrao.
- `APP_COMPANY_NAME`: nome inicial exibido no sistema.

Tambem pode usar `GOOGLE_SERVICE_ACCOUNT_JSON` com o JSON inteiro da conta de servico.

## Planilha

A planilha nao precisa ter um nome especifico. O sistema pega a planilha pelo ID em `GOOGLE_SHEETS_SPREADSHEET_ID`.

Antes de publicar, compartilhe essa planilha com o email da conta de servico como **Editor**. Se nao compartilhar, a API do Vercel nao vai conseguir ler nem gravar.

## Google Cloud

1. Crie ou abra um projeto no Google Cloud.
2. Ative a **Google Sheets API**.
3. Crie uma **Service Account**.
4. Gere uma chave JSON para essa conta.
5. Copie o `client_email` e o `private_key` para as variaveis do Vercel.

## Deploy

Use a pasta `pompeu123` como raiz do projeto no Vercel.

Comandos locais:

```bash
npm install
npm run dev
```

Para testar a sintaxe da API:

```bash
npm run check
```
