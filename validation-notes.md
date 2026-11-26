# Validação da versão final

Data: 17/11/2026.

## API (81 verificações automatizadas)

Executadas contra **PostgreSQL 16 real** e repetidas no **modo demonstração (JSON)**, incluindo migração do arquivo de demonstração da versão anterior e de um banco criado com o `schema.sql` antigo.

Cobrem: cadastro, login, senha errada, e-mail duplicado, edição de perfil, troca de senha (encerra sessões antigas), busca e todos os filtros, detalhes, solicitação de reserva com validações (datas no passado, capacidade, próprio anúncio, duplicidade), conversa, aceite (libera contatos e recusa pedidos sobrepostos), disponibilidade nas buscas, cancelamento, Pontos Cívicos e cupons (aplicação e devolução ao cancelar), avaliações (verificada, edição, bloqueio do dono, resposta do anfitrião, média e distribuição), favoritos e sincronização, upload de fotos, publicação e moderação de anúncios, pausa/reativação, edição voltando para análise, denúncias, ocultação de avaliações, bloqueio de usuários e exclusão de conta em cascata.

## Tempo real

Teste com dois navegadores simultâneos (hóspede e anfitriã), sem recarregar páginas: a anfitriã recebeu o aviso “Nova mensagem de Lucas” em 0,9 s; a resposta dela apareceu na conversa do hóspede em 0,9 s; o hóspede foi avisado da confirmação da reserva em 2 s. Contadores de não lidas corretos, conexão sem token recusada (401). Validado em PostgreSQL e no modo demonstração.

## Interface

Fluxos testados no navegador (Chrome) em desktop (1366 px) e celular (390 px), sem erros de JavaScript: início, explorar, anúncio, calendário de reserva, confirmação, minhas viagens, pontos, painel do anfitrião, formulário de anúncio, painel admin e usuários. Capturas em `docs/evidencias/versao-final/`.

## Limitação do ambiente de empacotamento

O ambiente usado para preparar o pacote não tinha acesso à internet para `npm install`; por isso o build do Vite e o `tsc` com os tipos oficiais não puderam ser executados aqui. O código foi compilado com esbuild e checado com o TypeScript usando tipos simplificados das bibliotecas, sem erros. Rode `npm install && npm run check && npm test && npm run build` na sua máquina para a confirmação final.
