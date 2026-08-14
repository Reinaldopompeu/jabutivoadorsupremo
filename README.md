# FluxoPro — ERP financeiro em Google Apps Script

Sistema de fluxo de caixa empresarial construído como Web App do Google Apps Script. O Google Sheets funciona como banco de dados, o Google Drive armazena comprovantes e exportações e um gatilho diário cuida de vencimentos, recorrências e alertas.

## Regime financeiro adotado

O FluxoPro opera exclusivamente pelo **regime de caixa**. Receitas e despesas só entram no saldo, no resultado, nos gráficos e nos relatórios realizados quando o campo de liquidação financeira é preenchido:

- Receita: utiliza a data real de recebimento e assume o status `Recebido`.
- Despesa: utiliza a data real de pagamento e assume o status `Pago`.
- Sem liquidação: permanece como `Pendente`, `Agendado` ou `Atrasado` e aparece apenas na previsão.

A data de registro, emissão ou vencimento não altera o saldo realizado. Uma venda de junho recebida em julho pertence ao fluxo de caixa de julho.

## O que está incluído

- Dashboard com saldo, receitas, despesas, resultado, contas abertas, atrasos, ticket médio, crescimento, indicadores e previsão.
- Receitas, despesas, contas a pagar/receber, notas fiscais e comprovantes de até 10 MB.
- Bancos e contas, cartões parcelados, categorias, clientes, fornecedores e centros de custo.
- Recorrências diárias, semanais, mensais e anuais.
- Orçamento por categoria, planejado x realizado e alertas de estouro.
- Relatórios filtráveis, DRE simplificada e exportação em CSV, XLSX e PDF.
- Perfis Administrador, Financeiro, Gestor e Usuário, além de auditoria campo a campo.
- Alertas internos e resumo opcional por e-mail.
- Tema claro/escuro e layout para computador, tablet e celular.

## Instalação rápida

1. Acesse [script.google.com](https://script.google.com) e crie um projeto.
2. Crie no projeto os arquivos com os mesmos nomes desta pasta e cole o conteúdo de cada um. O arquivo `appsscript.json` é exibido após habilitar **Mostrar arquivo de manifesto** nas configurações do editor.
3. Selecione a função `setupSistema` no editor e clique em **Executar**. Se aparecer `setupSystem`, ela também funciona como atalho. Autorize Sheets e Drive. A função vincula a planilha atual ao sistema, renomeia para `Pinguim Financeiro - Base de Dados`, cria as abas, categorias iniciais e contas.
4. Em **Implantar > Nova implantação > Aplicativo da Web**, configure:
   - Executar como: **Usuário que acessa o aplicativo da Web** (recomendado para identificar corretamente cada usuário).
   - Quem pode acessar: a organização ou os usuários autorizados da empresa.
5. Abra a URL da implantação. O primeiro administrador é o usuário que executou `setupSystem`.

> Para empresas em Google Workspace, restrinja o acesso ao domínio. Se escolher “executar como proprietário”, o Apps Script pode não expor o e-mail do visitante e a identificação individual de auditoria fica limitada.

## Uso com clasp (opcional)

```bash
npm install -g @google/clasp
clasp login
clasp create --type webapp --title "FluxoPro"
clasp push
```

Se `clasp create` gerar outro manifesto, preserve os escopos de `appsscript.json` deste projeto.

## Estrutura

- `Código.gs`: backend completo — Web App, banco, permissões, lançamentos, indicadores, relatórios, exportações e automações.
- `Index.html`: interface completa e modo demonstração local.

## Regras e operação

- Preencher a data de pagamento muda o lançamento para **Pago**.
- Vencimento passado sem pagamento muda para **Atrasado**.
- Apenas lançamentos pagos alteram o saldo atual; pendências alimentam o saldo projetado.
- Compras parceladas criam uma despesa por parcela no vencimento do cartão.
- O gatilho `runDailyAutomation` gera recorrências vencidas, atualiza status, recria alertas e envia o resumo configurado.
- Exclusões são lógicas: os dados permanecem na planilha e na auditoria.

## Segurança e limites

As planilhas e a pasta do Drive devem permanecer privadas aos usuários autorizados. As cotas diárias do Apps Script, Drive e e-mail variam conforme o tipo de conta Google; para grande volume, mova o armazenamento para uma base dedicada mantendo a camada de serviços existente.

Para trocar a base sem recriar dados, informe `spreadsheetId` ou `spreadsheetUrl` ao chamar `setupSystem({ spreadsheetId: '...' })` pelo editor. Se o script estiver aberto a partir de uma planilha, basta executar `setupSistema()` que essa planilha será usada diretamente.
