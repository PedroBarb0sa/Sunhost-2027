# Direção de Design — SunHost Floripa

## Três caminhos explorados

### 1. Refúgio Solar Editorial
**Very Brief Intro:** Uma interpretação contemporânea da hospitalidade de Floripa: tons de areia, verde-petróleo e coral solar, tipografia editorial e imagens que respiram. Transmite segurança, descoberta e uma sensação local sofisticada, sem parecer uma agência de turismo genérica.

**Probability:** 0.037

### 2. Carta Náutica Orgânica
**Very Brief Intro:** Uma interface inspirada em mapas de maré, papéis texturizados e sinalização marítima. O tom é artesanal e cultural, com gestos suaves e blocos assimétricos que remetem a uma curadoria de viagem.

**Probability:** 0.081

### 3. Hotel Clube Modernista
**Very Brief Intro:** Um visual de alto contraste, geometria precisa e referências de arquitetura brasileira. A proposta é mais urbana e exclusiva, transformando a busca de hospedagem em um catálogo de experiências selecionadas.

**Probability:** 0.019

---

## Abordagem escolhida: Refúgio Solar Editorial

### Design Movement
**Modernismo brasileiro de hospitalidade com linguagem editorial contemporânea.** A interface combina a solidez gráfica de cartazes culturais brasileiros com a leveza visual da costa de Florianópolis, sem reproduzir literalmente a referência enviada.

### Core Principles
1. **Descoberta antes de decisão:** busca, filtros, favoritos e detalhes aparecem como uma sequência natural, não como uma página institucional longa.
2. **Curadoria visual:** imóveis em cartões editoriais com grandes imagens, informação objetiva e espaço para o usuário comparar opções sem ruído.
3. **Calor com precisão:** superfícies suaves, bordas arredondadas e sombras discretas são equilibradas por tipografia forte, alto contraste e microinterações nítidas.
4. **Transparência de comunidade:** comentários terão área própria e estado honesto quando não existirem publicações; nenhum comentário, nota ou depoimento será inventado.

### Color Philosophy
O fundo em **areia mineral** cria calma e conforto; o **verde-petróleo** ancora confiança e navegação; o **coral solar** concentra energia em decisões importantes, como reservar e salvar. Branco leitoso e grafite quente sustentam a leitura e preservam a sensação premium sem recorrer a fundos escuros ou gradientes genéricos.

### Layout Paradigm
Uma composição de **trilho de descoberta**: a barra de busca elevada abre a jornada, a seleção de destinos se move horizontalmente no celular, e os cartões de hospedagem aparecem em uma galeria editorial assimétrica. No desktop, uma coluna lateral contextual exibe filtros e a lista ganha ritmo variável, evitando uma grade centralizada e uniforme.

### Signature Elements
1. **Marca-símbolo Sol & Mar:** arco solar cruzado por uma onda, usado como selo, avatar e favicon.
2. **Cápsulas de intenção:** filtros, status, atributos e favoritos são apresentados em pequenos controles orgânicos de cantos amplos.
3. **Cartões-postais vivos:** fotos amplas, etiqueta de bairro e uma faixa inferior informativa que se expande no hover ou toque.

### Interaction Philosophy
As interações devem parecer **diretas, macias e previsíveis**. Favoritar fornece resposta visual imediata e persistente no dispositivo; abrir uma acomodação leva a uma ficha detalhada em painel modal com retorno claro; filtros e categorias reorganizam a descoberta sem telas intermediárias. Ações de produto prioritárias recebem feedback por mensagens discretas.

### Animation
Entradas em cascata de 40–70 ms para os cartões e transições de no máximo 240 ms, com curva `cubic-bezier(0.23, 1, 0.32, 1)`. Imagens recebem leve aproximação no hover; botões têm compressão em clique; menus e painéis entram por opacidade e deslocamento curto. Pessoas que preferirem menos movimento terão animações não essenciais desativadas.

### Typography System
**DM Serif Display** conduz títulos, destaques de destino e mensagens de marca, trazendo personalidade editorial. **Manrope** organiza navegação, filtros, preços e conteúdo funcional com excelente legibilidade. Títulos usam contraste de escala e peso; textos utilitários permanecem compactos e arejados. Inter é deliberadamente evitada.

### Brand Essence
**SunHost Floripa é a plataforma de hospedagens locais para viajantes que querem escolher com mais contexto, salvar o que combina com sua viagem e apoiar uma cidade que também se beneficia da estadia.**

Personalidade: **acolhedora, criteriosa, ensolarada**.

### Brand Voice
Direta, local e convidativa; fala em descoberta e pertencimento, sem exageros promocionais ou urgência artificial.

> “A sua estadia começa pelo bairro que mais combina com você.”

> “Salve agora. Decida com calma quando a viagem ganhar forma.”

### Wordmark & Logo
O wordmark “SunHost” usa letras de construção arredondada e espaçada; o símbolo independente une um semicírculo solar a duas linhas de onda em recorte simples. O ícone deve funcionar sozinho em uma cápsula coral, sem texto, como assinatura reconhecível em cabeçalho e favicon.

### Signature Brand Color
**Coral Pôr do Sol — `#E9573F`**. Um tom energético e quente, próprio para a marca e reservado a ações, estados salvos e pequenos acentos de navegação.

## Fluxos priorizados

| Fluxo | Experiência definida |
|---|---|
| Encontrar acomodação | Busca por destino, data e hóspedes; filtros por bairro e tipo de estadia; coleção de cartões de imóvel. |
| Abrir detalhes | Painel detalhado com galeria visual, comodidades, localização, anfitrião, política de pontos cívicos e seção de comentários. |
| Ver comentários | Estado transparente “ainda não há comentários publicados” e explicação de que avaliações verificadas surgem após a hospedagem. |
| Favoritos | Alternar o coração no cartão ou nos detalhes; itens são persistidos localmente e podem ser visualizados em uma área exclusiva. |
| Pontos Cívicos | Explicação enxuta sobre como a hospedagem gera impacto local, removendo blocos institucionais repetitivos. |
| Ações indisponíveis | CTAs que dependem de uma operação real exibem mensagem clara, sem simular reserva, login, cadastro ou conteúdo de terceiros. |

## Evolução Floripa — decisões de experiência

### Carrosséis automáticos
O destaque principal passa a apresentar uma sequência automática de referências visuais reconhecíveis de Florianópolis. Cada imagem permanece cinco segundos e a troca acontece com dissolução suave, sem setas ou controles que concorram com a mensagem principal. A sequência valoriza paisagem, cidade e cultura da ilha, com legendas curtas que ajudam a pessoa a perceber o lugar sem poluir o layout.

Nas acomodações, as imagens mudam automaticamente a cada cinco segundos enquanto o cartão estiver visível. O objetivo é apresentar o imóvel de maneira rápida, mas sem transformar o card em um componente carregado. Indicadores discretos comunicam a posição da foto e o movimento pausa com a preferência de redução de animações do dispositivo.

Ao abrir uma acomodação, a pessoa encontra uma **galeria completa com miniaturas**, navegação explícita e contador de fotos. Essa é a única área em que os controles manuais são necessários, pois a pessoa passa a explorar as imagens com intenção.

### Pontos Cívicos e recompensas
Os pontos são apresentados como benefício simples e proporcional à hospedagem. O projeto usará uma faixa de **50 a 100 Pontos Cívicos por reserva**, de acordo com o tipo de acomodação. A recompensa principal será um desconto diretamente no SunHost, evitando o vínculo com órgãos públicos, IPTU ou processos burocráticos.

| Saldo | Benefício local viável |
|---:|---|
| 200 pontos | R$ 20 de desconto na próxima hospedagem elegível. |
| 250 pontos | R$ 25 de desconto na próxima hospedagem elegível. |
| 400 pontos | R$ 45 de desconto na próxima hospedagem elegível. |
| 500 pontos | R$ 60 de desconto na próxima hospedagem elegível. |

Como esta versão é estática, o saldo demonstrativo será controlado apenas no navegador e o resgate alterará o estado local. A regra fica clara na interface: a integração com pagamentos e reservas reais é posterior e não será simulada.

### Execução local
O pacote final incluirá um guia em linguagem simples para instalação com Node.js. A versão atual permanece sem banco de dados, chaves privadas ou variáveis de ambiente obrigatórias; bastará instalar as dependências e iniciar o servidor de desenvolvimento.

## Style Decisions

- A galeria de acomodações no desktop funciona como um **trilho editorial**, com uma coluna de curadoria e cartões em ritmos diferentes, em vez de uma grade uniforme de marketplace.
- O símbolo **Sol & Mar** reaparece em arcos, ondas, indicadores e selos de imagem nas áreas de descoberta, impacto e recompensas.
- O coral Pôr do Sol `#E9573F` permanece reservado para ações principais, estados salvos, Pontos Cívicos e ênfase tipográfica pontual.
