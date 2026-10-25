# Nexo

Tarefas pessoais e atas de reunião no mesmo lugar. Cada item de ação de uma ata vira uma tarefa, e os dois lados continuam ligados: a tarefa mostra a reunião de origem e a ata mostra o status atual.

O app é em português (pt-BR). Não há login, integração com Outlook nem resumo por IA nesta versão — os pontos para acrescentar isso estão no servidor.

## Rodar com um comando

É preciso ter Node.js 20 ou mais recente.

```bash
npm install && npm start
```

Isso instala as dependências, gera a interface e sobe um único processo Node. A API e o site ficam em `http://localhost:5000` (ou na porta da variável `PORT`), escutando em `0.0.0.0`.

Para desenvolver com recarregamento:

```bash
npm install
npm run dev
```

Testes e checagem de tipos:

```bash
npm test
npm run typecheck
```

## Importar no Replit

1. Entre em [replit.com](https://replit.com).
2. Crie um Repl com **Import from GitHub** (importar do GitHub).
3. Cole a URL deste repositório e confirme.
4. O Replit lê o arquivo `.replit`, usa Node.js 22 e instala as dependências. O `replit.nix` traz o SQLite e as ferramentas para compilar o `better-sqlite3`, se o binário pronto não servir.
5. Clique em **Run**. O comando é `npm run dev`: um processo só, com a API e o Vite, na porta `5000`.
6. A pré-visualização abre no painel Webview.

O código usa `process.env.PORT` e, se a variável não existir, a porta **5000**. O servidor escuta em **0.0.0.0**. O `.replit` define `PORT=5000` e publica essa porta interna na porta externa 80.

## Publicar

1. Com o Repl aberto, use **Publish** (em algumas contas o botão ainda aparece como **Deploy**).
2. O build da publicação roda `npm ci && npm run build`.
3. O processo publicado é `npm run start:server`: o mesmo Node serve a API e os arquivos estáticos da interface. Não há um segundo serviço.
4. A publicação está marcada como `cloudrun` no `.replit`, com a porta 5000 mapeada para a 80.

## O que dá para fazer

- **Tarefas:** criar, editar e excluir. Campos: título, descrição, status (A fazer, Em andamento, Concluída), prioridade (baixa, média, alta), prazo, responsável e tags.
- **Lista** com filtros de status, prioridade, prazo (atrasadas, hoje, próximos 7 dias, sem prazo), tag e busca.
- **Quadro** com arrastar e soltar entre as colunas.
- Tarefas atrasadas e do dia ficam destacadas. "Hoje" e "atrasada" seguem o fuso `APP_TIMEZONE` (padrão `America/Sao_Paulo`), para o relógio UTC do Replit não mudar o dia no meio da tarde.
- **Atas:** título, data e hora, participantes, pauta, notas, decisões e itens de ação. Cada item de ação cria uma tarefa com responsável e prazo.
- **Lista de atas** com busca por texto, participante e período.
- A tarefa mostra a ata de origem. A ata mostra o status atual das tarefas geradas. Remover um item na ata exclui a tarefa ligada. Excluir a ata mantém as tarefas, sem o vínculo.
- **Painel:** tarefas de hoje, atrasadas, últimas atas e contadores por status.
- **Exportar** a ata em Markdown e em PDF.
- Interface responsiva, com modo claro e escuro.

## Variáveis

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `5000` | Porta HTTP |
| `HOST` | `0.0.0.0` | Endereço de escuta |
| `DATABASE_PATH` | `data/nexo.sqlite` | Arquivo SQLite |
| `APP_TIMEZONE` | `America/Sao_Paulo` | Dia usado em "hoje" e "atrasadas" |
| `NODE_ENV` | — | `production` serve a interface já gerada |

## Onde ficam os dados

O SQLite fica em `data/nexo.sqlite` (não entra no Git). No botão **Run** do Replit esse arquivo permanece no disco do Repl.

Na publicação em Cloud Run o disco do container pode ser efêmero: o que for criado só na instância publicada pode sumir quando ela reinicia. Para uso pessoal contínuo, use o Repl (Run) ou aponte `DATABASE_PATH` para um disco que o plano mantenha.

## Como estender

O login, o calendário e o resumo por IA ficaram de fora de propósito. Os ganchos já existem e são consultados a cada pedido:

- **Login:** substitua `authenticate` em `server/extensions/auth.ts`. Hoje ele só deixa a requisição passar.
- **Resumo por IA:** implemente `MeetingSummarizer` e chame `registerSummarizer` em `server/extensions/summarizer.ts`. Sem provedor, `POST /api/meetings/:id/summary` responde 501.
- **Outlook ou outro calendário:** implemente `CalendarConnector` e chame `registerCalendarConnector` em `server/extensions/calendar.ts`. Sem conector, `GET /api/calendar/upcoming` responde 501. `GET /api/extensions` informa o que está registrado.

Exemplo de registro, antes de `httpServer.listen` em `server/index.ts`:

```ts
import { registerSummarizer } from "./extensions/summarizer";

registerSummarizer({
  name: "meu-provedor",
  async summarize(input) {
    return `Resumo de ${input.title}`;
  },
});
```

## Stack

React, Vite e TypeScript na interface. Express no servidor. SQLite com Drizzle ORM. Em desenvolvimento o Express entrega o Vite no mesmo processo. Em produção ele entrega a pasta `dist/client`.
