# Pauta

Aplicação web em português para organizar tarefas pessoais e atas de reunião. Dá para anotar o que precisa ser feito, registrar uma conversa e transformar cada item de ação em uma tarefa ligada à ata.

## O que dá para fazer

- Criar, editar e excluir tarefas com título, descrição, status (A fazer, Em andamento, Concluída), prioridade, prazo, responsável e etiquetas.
- Ver as tarefas em lista, com filtros de status, prioridade, prazo, etiqueta e busca, ou em um quadro para arrastar entre as colunas.
- Destacar tarefas atrasadas e as que vencem hoje.
- Registrar atas com data e hora, participantes, pauta, notas, decisões e itens de ação.
- Cada item de ação vira uma tarefa. A tarefa mostra a ata de origem, e a ata mostra o status atual da tarefa.
- Buscar reuniões por texto, participante e período.
- Ver no painel as tarefas de hoje, as atrasadas, as últimas atas e a contagem por status.
- Exportar a ata em Markdown e em PDF.
- Alternar entre modo claro e modo escuro.

Não há login, integração com o Outlook nem resumo por IA. Esses pontos ficam preparados em `server/extensions.ts`.

Na primeira execução o banco vazio recebe alguns exemplos para o painel não abrir em branco. Isso acontece uma vez só.

## Rodar na sua máquina

É preciso Node.js 20 ou mais recente.

```bash
npm install && npm run dev
```

Abra [http://localhost:5000](http://localhost:5000). O servidor escuta em `0.0.0.0` na porta da variável `PORT` (padrão `5000`).

Para o modo de publicação, na mesma máquina:

```bash
npm run build && npm start
```

Outros comandos:

```bash
npm test
npm run check
```

`SQLITE_PATH` troca o arquivo do banco. O padrão é `data/app.db`.

## Importar no Replit

1. No Replit, crie um App importando este repositório do GitHub (**Create App** → **Import from GitHub**).
2. O arquivo `.replit` já define o comando de execução, a porta `5000` e o build de publicação. Não é preciso alterar nada.
3. Clique em **Run**. O comando instala as dependências e sobe o app com `npm run dev`.
4. Abra a janela de preview. A porta interna `5000` está ligada à porta externa `80`.

O `replit.nix` inclui Node.js, SQLite e as ferramentas usadas para compilar o módulo nativo do banco, caso o Replit não use um binário pronto.

## Publicar

1. No Replit, abra **Deploy** / **Publish**.
2. Escolha **Reserved VM**. O banco é um arquivo SQLite, então o app precisa de um processo contínuo e de disco. Autoscale não serve: o disco some quando a instância para.
3. O `.replit` já informa o build e o comando de execução:
   - build: `npm run build`
   - run: `npm start`
4. Publique e abra o endereço gerado.

Um novo publish pode recriar o ambiente e substituir o arquivo `data/app.db`. Antes de publicar de novo, copie esse arquivo se os dados importarem. Para separar o banco de desenvolvimento do publicado, defina `SQLITE_PATH` em cada ambiente.

O app não tem autenticação. Não publique dados sensíveis em um endereço aberto.

## Como estender

- Resumo por IA: implemente `MeetingSummaryProvider` em `server/extensions.ts` e exponha uma rota que leia a ata com `getMeeting`.
- Calendário ou Outlook: implemente `CalendarImporter` e crie atas com `createMeeting`.
- Login fica de fora de propósito. As rotas em `server/app.ts` são o lugar para encaixar uma checagem quando isso existir.

## Stack

React, Vite e TypeScript na interface. Express no servidor. SQLite com Drizzle ORM. Em desenvolvimento e em produção existe um processo só: a API e a interface saem da mesma porta.
