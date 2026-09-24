# Validação da entrega PostgreSQL

Data da atualização: 2026-09-10.

- `pnpm run check`: aprovado, sem erros TypeScript.
- `pnpm run build`: aprovado; frontend Vite e backend Express compilados.
- Autenticação: usuários e administrador são persistidos em `users`; senhas usam `scrypt` com pepper.
- Publicações: acomodações são persistidas em `accommodations`, com status de moderação e exclusão protegida.
- Comentários: tabela `comments` criada com relacionamento e status de moderação, pronta para a tela de comentários verificados.
- O ambiente de empacotamento não possui `psql`/`pg_isready`, portanto a conexão real não foi executada aqui. O servidor aplica `schema.sql` no boot e falha de forma explícita se `DATABASE_URL` não estiver acessível.

## Limite operacional

Antes de executar, configure um PostgreSQL acessível e ajuste `.env` a partir de `.env.example`. A aplicação não usa mais o armazenamento local para contas ou submissões.

## Histórico da interface

A versão original foi validada com login demonstrativo, publicação local, moderação, carrosséis e layout móvel. Esses fluxos foram preservados e os dados de conta/publicação foram transferidos para a API PostgreSQL.
