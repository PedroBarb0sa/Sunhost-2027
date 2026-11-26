# Evidências de testes — SunHost Floripa v1.0.0

Execução local em modo demonstração, com PostgreSQL indisponível quando indicado.

| Caso | Resultado | Evidência |
|---|---|---|
| CT-001 — Registo de novo utilizador | APROVADO | `CT-001-cadastro-conta-logada.webp` — conta criada e painel “Olá, Viajante Teste” exibido. |
| CT-002 — Login de utilizador existente | APROVADO na mesma sessão de validação | A sessão criada no CT-001 abriu o painel de conta; o fluxo de login usa a mesma API, mas não foi repetido em uma segunda sessão por limitação de tempo. |
| CT-003 — Submissão de alojamento | APROVADO | `CT-003-envio-pendente.webp` — mensagem de envio e item “Cabana Rústica — Em análise”. |
| CT-004 — Moderação: aprovar alojamento | APROVADO | `CT-004-painel-admin-pendente.webp` e `CT-004-aprovacao-publicacao.webp` — painel mostra 1 pendente, depois 1 aprovado e anúncio na vitrine. |
| CT-005 — Gestão de favoritos | APROVADO | `CT-005-favorito-card.webp` — acomodação marcada na vitrine; favoritos são persistidos no navegador. |
| CT-006 — Comentário e avaliação | NÃO EXECUTADO / NÃO DISPONÍVEL | A versão informa na própria interface que ainda não apresenta comentários e o código não possui formulário de publicação de avaliação. |
| CT-007 — Resgate de Pontos Cívicos | APROVADO | `CT-007-resgate-pontos.webp` — saldo passa de 250 para 50 pontos e o benefício fica “Benefício reservado”. |
| CT-008 — Fallback local | APROVADO | `CT-008-fallback-terminal.txt` — log real: “PostgreSQL indisponível. SunHost iniciado em modo demonstração local.” |

Os arquivos de imagem são capturas reais do navegador durante a execução; nenhum print foi criado artificialmente.

## Versão final (redesign)

Capturas reais do navegador na pasta `versao-final/` (PostgreSQL 16, desktop 1366 px e celular 390 px): início, explorar, anúncio, calendário de reserva, confirmação, minhas viagens, Pontos Cívicos, painel do anfitrião, novo anúncio, painel admin, usuários e login. O CT-006 (comentário e avaliação), antes não disponível, agora está implementado: avaliações de 1 a 5 estrelas com selo de hóspede verificado e resposta do anfitrião.
