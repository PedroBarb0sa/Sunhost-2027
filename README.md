# SunHost Floripa — versão final

Plataforma de hospedagem local para Florianópolis, no estilo Airbnb: a mesma conta serve para **viajar** e para **anunciar** um espaço. O pagamento **não passa pela plataforma** — depois que o anfitrião aceita a reserva, os contatos são liberados e as partes combinam o pagamento diretamente.

Projeto Integrador (PMI) — Análise e Desenvolvimento de Sistemas.

## Status da entrega

Esta versão foi preparada para publicação no GitHub e validada localmente com Node.js 22.14.0 e pnpm 10.4.1:

- `pnpm install --frozen-lockfile` — concluído
- `pnpm run check` — concluído
- `pnpm test` — 9 testes aprovados
- `pnpm run build` — concluído (front-end Vite + API Express)

O workflow [`ci.yml`](.github/workflows/ci.yml) repete automaticamente a checagem de tipos, os testes com cobertura e o build a cada pull request para `develop` ou push em branches de desenvolvimento.

## Versão final 2027 — o que há de novo

Esta é a **versão final** do projeto. Em relação às versões anteriores, o pacote traz:

- **Conversa em tempo real** entre hóspede e anfitrião (Server-Sent Events), com avisos na tela, contador de mensagens não lidas e reconexão automática.
- **Reservas completas**: calendário que esconde datas ocupadas, cálculo de noites, taxa de limpeza e cupom, aceite/recusa/cancelamento, e contatos liberados só após a confirmação.
- **Pontos Cívicos e cupons**: 250 pontos de boas-vindas, pontos por estadia concluída e troca por cupons aplicáveis na reserva.
- **Avaliações** de 1 a 5 estrelas com selo de hóspede verificado, resposta do anfitrião e moderação.
- **Painel do anfitrião** e **painel de administração** (moderação de anúncios, usuários, reservas, avaliações e denúncias).
- **Fotos enviadas do dispositivo** (até 12 por anúncio, redimensionadas no navegador), com reordenação e capa.
- **Modo demonstração sem banco** (arquivo JSON) e **PostgreSQL** opcional; `schema.sql` idempotente que migra bancos das versões anteriores.
- **Segurança**: senhas com `scrypt` + sal, limite de tentativas de login, autorização no servidor e cabeçalhos de segurança HTTP.
- **Docker e CI/CD**: `Dockerfile`, `docker-compose.yml`, `ci.yml` (tipos, testes e build) e `cd.yml` (deploy na EC2).

Detalhes da validação (81 verificações de API, teste de tempo real e fluxos no navegador) estão em [`validation-notes.md`](validation-notes.md).

## Publicação (hospedagem)

O projeto é **full-stack** (API Express + front-end Vite). Por isso **não roda no GitHub Pages**, que só serve arquivos estáticos. Para deixar o site público, use uma hospedagem que execute Node.js ou Docker (por exemplo Render, Railway, Fly.io ou a EC2 do `cd.yml`). Em produção, `npm run build && npm start` serve o front-end e a API no mesmo processo, na porta `PORT`.

## Como rodar (modo rápido, sem banco)

Requisito: **Node.js 20.19 ou superior** (ou 22.12+). Confira com `node -v`; a versão LTS de https://nodejs.org serve.

```bash
npm install
npm run dev
```

Abra **http://localhost:3000**. Sem PostgreSQL ligado, o servidor entra sozinho em **modo demonstração** e salva tudo em `sunhost-demo-data.json` (o terminal mostra qual modo está ativo).

### Contas de demonstração

Todas com a senha **`Floripa@2026`** (também há botões de preenchimento rápido na tela de login):

| Perfil | E-mail | O que mostrar |
|---|---|---|
| Hóspede | `hospede@sunhost.local` | Já tem uma estadia concluída (pode avaliar com selo “hóspede verificado”) e 335 Pontos Cívicos |
| Anfitriã | `anfitria@sunhost.local` | Dona das 6 acomodações; tem um pedido pendente e 1 mensagem não lida |
| Admin | `admin@sunhost.local` | Painel de administração e moderação |

> **Dica para a apresentação:** abra o site em duas janelas (uma anônima), entre como hóspede numa e como anfitriã na outra, e troque mensagens: elas aparecem na hora dos dois lados.

### Problemas comuns

| Sintoma | Solução |
|---|---|
| `Versão do Node.js incompatível` ou erro do Vite sobre a versão do Node | Instale o Node.js LTS (20.19+ ou 22.12+) em https://nodejs.org, abra um terminal novo e rode `npm install` de novo |
| `As dependências ainda não foram instaladas` | Rode `npm install` antes de `npm run dev` |
| Página não abre sozinha | Abra manualmente http://localhost:3000 (o terminal mostra o endereço; se a porta 3000 estiver ocupada, o Vite usa a próxima) |
| Erro de porta em uso na API (3001) | Feche o outro programa que usa a porta ou rode com `PORT=3002` e `API_PORT=3002` |
| Erro no `npm install` | Apague a pasta `node_modules` e rode `npm install` de novo |

## Com PostgreSQL

```bash
createdb sunhost_floripa
cp .env.example .env      # ajuste DATABASE_URL se necessário
npm run dev
```

O servidor aplica `schema.sql` a cada inicialização (as instruções são idempotentes e **migram bancos das versões anteriores**: a antiga `image_url` vira foto, comentários aprovados viram avaliações). Com `DEMO_MODE=false` o servidor exige o PostgreSQL e falha se ele não estiver acessível.

### Modelo de dados

| Tabela | Conteúdo |
|---|---|
| `users` | Contas (papel `user`/`admin`, status ativo/bloqueado, telefone, bio, foto, pontos de boas-vindas) |
| `sessions` | Sessões de login (só o hash SHA-256 do token; expiram em 30 dias) |
| `accommodations` | Anúncios: tipo, preço, taxa de limpeza, capacidade, comodidades, regras, horários, status de moderação, destaque |
| `accommodation_photos` | Fotos ordenadas de cada anúncio |
| `uploads` | Imagens enviadas do dispositivo (fotos e avatares) |
| `reservations` | Solicitações e reservas (pendente → confirmada/recusada/cancelada), valores e cupom aplicado |
| `messages` | Conversa entre hóspede e anfitrião dentro de cada reserva (em tempo real) |
| `reviews` | Avaliações de 1 a 5 estrelas (uma por pessoa por anúncio), resposta do anfitrião, ocultação pela moderação |
| `favorites` | Favoritos por conta |
| `redemptions` | Cupons resgatados com Pontos Cívicos |
| `reports` | Denúncias de anúncios |

Todas as relações têm chave estrangeira com `ON DELETE CASCADE`/`SET NULL`, `CHECK` de status e índices.

## Funcionalidades

**Viajante**
- Busca por bairro/texto, datas (calendário que esconde espaços ocupados), hóspedes, tipo de espaço, faixa de preço, comodidades e ordenação. Filtros ficam na URL (link compartilhável).
- Página do anúncio com galeria em tela cheia, comodidades, regras, disponibilidade, anfitrião, avaliações (média, distribuição por estrelas, selo de hóspede verificado) e denúncia.
- Solicitação de reserva com cálculo de noites, taxa de limpeza, cupom e total; cancelamento; contato por WhatsApp/e-mail liberado após a confirmação.
- **Conversa em tempo real** entre hóspede e anfitrião: a mensagem aparece na hora para a outra pessoa, com aviso na tela em qualquer página e contador de não lidas (menu, botão Conversa e barra do celular). Pedidos, aceites, recusas e cancelamentos também chegam na hora.
- Favoritos (no navegador sem login, sincronizados com a conta ao entrar).
- Pontos Cívicos: 250 de boas-vindas + 50 a 120 por estadia concluída; troca por cupons de R$ 20 a R$ 60 aplicáveis na reserva; extrato.
- Perfil com foto, telefone e bio; troca de senha; exclusão da conta (LGPD).

**Anfitrião**
- Anúncio com até 12 fotos enviadas do celular/computador (redimensionadas no navegador) ou por link, reordenação e capa.
- Painel com pedidos pendentes, próximas estadias, valor a receber, nota média; aceitar/recusar (pedidos sobrepostos são recusados automaticamente), pausar/reativar, editar (volta para revisão) e excluir anúncios; responder avaliações.

**Administração**
- Visão geral com indicadores; moderação de anúncios (aprovar, recusar com observação, pausar, destacar na home, excluir, remover fotos); usuários (bloquear/desbloquear); reservas (ver conversa, cancelar); avaliações (ocultar/publicar/excluir); denúncias (resolver).

**Como funciona o tempo real**: cada navegador logado abre uma conexão **Server-Sent Events** em `/api/events` (recurso nativo do navegador e do Node, sem biblioteca extra). Quando alguém envia uma mensagem ou muda o status de uma reserva, o servidor empurra o evento para os navegadores dos envolvidos. Se a conexão cair, o navegador reconecta sozinho em 3 segundos e a conversa aberta também consulta o servidor a cada 20 segundos como garantia. O indicador “Ao vivo” na conversa mostra o estado da conexão. As leituras ficam em `reservations.guest_read_at`/`host_read_at`.

**Segurança**: senhas com `scrypt` + sal individual (hashes antigos são convertidos no próximo login), limite de tentativas de login, autorização verificada no servidor em todas as rotas, contatos visíveis só para reservas confirmadas, cabeçalhos de segurança HTTP.

## Scripts

| Comando | Uso |
|---|---|
| `npm run dev` | Vite (3000) + API (3001); o Vite encaminha `/api` para a API |
| `npm run dev:api` | Só a API |
| `npm run check` | Checagem de tipos (TypeScript) |
| `npm test` / `npm run test:coverage` | Testes Vitest |
| `npm run build` e `npm start` | Build de produção (frontend + API no mesmo processo, porta `PORT`; funciona também no Windows) |

## Estrutura

- `client/src/pages` — telas (início, explorar, anúncio, entrar/cadastro, viagens, favoritos, pontos, conta, anfitrião, admin, ajuda)
- `client/src/components` — componentes (cartão, busca, calendário, reservas/conversa, modais, ícones)
- `client/src/styles/app.css` — sistema visual (laranja, branco e cinza; DM Serif Display + Manrope)
- `server/index.ts` — API Express; `server/db.ts` — PostgreSQL e modo demonstração; `server/seed.ts` — dados iniciais
- `shared/catalog.ts` — tipos de espaço, comodidades, bairros e recompensas usados pelos dois lados
- `schema.sql` — banco de dados

## Docker / CI-CD (N3)

```bash
docker compose up -d --build   # http://localhost:3001 (modo demonstração)
```

Os workflows `ci.yml` (tipos, testes com cobertura e build) e `cd.yml` (deploy na EC2 via SSH com `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`) continuam iguais. Na EC2, abra a porta TCP 3001 no Security Group.
