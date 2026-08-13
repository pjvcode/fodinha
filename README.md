# Desafio Esquadrilha

Variante brasileira de *Oh Hell* com a hierarquia e as manilhas do Truco Paulista.
Webapp em React, um humano contra bots, sala hospedada localmente pelo navegador.

```bash
npm install
```

```bash
npm run dev
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o jogo em `http://localhost:5173` |
| `npm test` | Suíte completa (Vitest) |
| `npm run typecheck` | Checagem de tipos |
| `npm run build` | Build de produção |
| `npm run sim -- --help` | Simulação headless bot-vs-bot |

---

## Regras implementadas

### Baralho e hierarquia
40 cartas — `4 5 6 7 Q J K A 2 3` em ouros, espadas, copas e paus (sem 8, 9 e 10).

- Valor, fraca → forte: `4 < 5 < 6 < 7 < Q < J < K < A < 2 < 3`
- Naipe, fraca → forte: `♦ < ♠ < ♥ < ♣`

**O naipe desempata todas as cartas de mesmo valor**, não só as manilhas. Existe
portanto uma ordem total estrita sobre as 40 cartas e toda vaza tem exatamente
um dono. (O modo "melar", em que cartas comuns de mesmo valor se anulam, está
implementado atrás da flag `tieBreak: 'melar'`, desligada por padrão.)

### Manilha
A cada mão vira-se uma carta; a manilha é a imediatamente superior na sequência,
com wrap: `4→5`, `7→Q`, `Q→J`, `K→A`, `A→2`, `2→3`, **`3→4`**. As quatro manilhas
superam qualquer carta comum e desempatam entre si por naipe.

### Mão sem vira
`C_max = piso(40 / N)` — todas as 40 cartas podem ser distribuídas. Quando
`cartas × jogadores === 40` não sobra carta para virar: a mão é jogada **sem
manilha**, e `3♣` é a carta mais forte.

| Jogadores | C_max | Mão sem vira | Mãos na partida |
| --- | --- | --- | --- |
| 2 | 20 | sim, em 20 | 39 |
| 3 | 13 | não | 25 |
| 4 | 10 | sim, em 10 | 19 |
| 5 | 8 | sim, em 8 | 15 |
| 6 | 6 | não | 11 |
| 7 | 5 | não | 9 |
| 8 | 5 | sim, em 5 | 9 |

### Palpites
Começa à esquerda do distribuidor; o distribuidor palpita por último. A soma dos
palpites **não pode igualar** o número de cartas em mão — a restrição recai sobre
o último a palpitar, e só quando o valor proibido cai em `[0, h]`.

### Rodada de 1 carta
Jogada como qualquer outra: **cada jogador vê a própria carta e não vê a de
ninguém**. A restrição da soma vale igual. A jogada em si é automática — com uma
carta na mão não há o que escolher.

### Vazas e pontuação
Não há obrigação de seguir naipe. Penalidade da mão = `|palpite − vazas ganhas|`,
acumulada; **menor total ao fim da progressão vence**, com vitória dividida em
caso de empate.

---

## Configuração

Tudo em `GameConfig` (`src/engine/types.ts`), com defaults em `defaultConfig()`:

| Flag | Default | Observação |
| --- | --- | --- |
| `suitOrder` | `♦ < ♠ < ♥ < ♣` | ordem fraca → forte |
| `tieBreak` | `'suit'` | ou `'melar'` |
| `maxCardsCap` | `null` | teto artificial; `null` = C_max natural |
| `progression` | `'up-down'` | ou `'down-up'` |
| `repeatMaxHand` | `false` | repete o ponto de virada |
| `scoringMode` | `'penalty'` | ou `'elimination'` |
| `startingLives` | `5` | só no modo eliminação |
| `seed` | — | mesma semente, mesmas cartas |

---

## A mesa

O jogo é jogado numa mesa de cassino: trilho de mogno, feltro verde, filete
dourado e todo mundo sentado em elipse. Tudo é posicionado em porcentagem a
partir de [`seating.ts`](src/ui/casino/seating.ts), então a mesa escala inteira
sem recalcular nada, e o mesmo vetor que posiciona um assento dá a direção das
animações daquele jogador — carta entrando na vaza, varrida para o vencedor,
balão de fala.

**Fichas.** A aposta de cada jogador vira fichas no feltro: **uma ficha por vaza
apostada, lado a lado, nunca empilhadas**. A ficha acende em ouro quando a vaza
correspondente é ganha, e vaza a mais entra como ficha vermelha no fim da
fileira. O resultado é que a penalidade fica contável na mesa: as fichas que não
são de ouro são exatamente `|palpite − vazas|`, e o
[teste](tests/chips.test.ts) amarra isso contra `handPenalty()` do engine.
Apostar zero tem ficha própria — é a declaração mais comum do jogo e sumiria da
mesa sem ela.

**Marcadores.** No perfil o jogador escolhe com o que aposta: ficha de pôquer,
tampinha de cerveja, culote de bala ou ampola de anabolizante, em oito cores.
Todos são SVG inline com preenchimento chapado e camadas de branco e preto —
mesma linguagem do feltro e do trilho, nenhum arquivo de imagem, nenhum
`<linearGradient>` (id de gradiente é global no documento e colidiria entre as
dezenas de marcadores da mesa). O estado — cumprida, pendente, excedente — é
pintado de fora, trocando `--chip-body` e `--chip-edge`: um marcador novo não
precisa saber o que é "vaza cumprida".

A escolha vale só para o jogador local; os bots seguem com a ficha colorida por
assento, e é assim que se acha a própria fileira de relance numa mesa de oito. A
matemática da fileira fica inteira em [`chips.ts`](src/ui/casino/chips.ts) e o
desenho em [`markers.ts`](src/ui/casino/markers.ts) — trocar de marcador não mexe
numa linha da contagem. Apostar zero é a única exceção: continua sendo a ficha de
pôquer com o `0`, em qualquer marcador, porque é o único que carrega um número e
o desenho único é o que faz ele saltar da mesa.

**Vaza em roseta.** Cada carta pousa na direção de quem a jogou, então dá para
ver quem jogou o quê sem rótulo nenhum.

## Como se joga na mesa

**Jogar uma carta é em dois tempos.** O primeiro clique pré-seleciona: a carta
sobe acima do leque e ganha contorno dourado. O segundo confirma. `Esc` cancela.
Num leque sobreposto as cartas ficam a poucos pixels umas das outras, e jogar a
carta errada não tem volta.

**Jogada sem escolha é automática.** Quando sobra uma carta só na mão — a última
de qualquer mão, ou a mão de 1 carta inteira — o host joga sozinho. Pedir um
clique para uma jogada com um único resultado possível é atrito à toa.

**Rever o que passou.** Cada ficha de vaza ganha é clicável: abre a vaza parada,
com quem jogou o quê, em que ordem e quem levou. Dentro dela dá para andar por
todas as vazas da mão com as setas. É a saída para quando o ritmo está rápido
demais e a vaza some antes de dar tempo de ler.

**Sair no meio.** O botão *Menu* no cabeçalho volta ao setup e começa outra
partida. Pede confirmação: o clique descarta a partida inteira e não tem desfazer.

## No celular

A mesa é posicionada em porcentagem e escala sozinha, mas o que pousa nela tem
tamanho em pixel e não escalava — daí uma passada inteira:

- **A mesa nunca estoura a largura.** O teto vem de `min(100%, altura × 1.6)`; a
  conta pela altura sozinha dava, num celular deitado, mais largura do que a tela
  tem.
- **Plaquetas, marcadores e cartas da vaza encolhem com a mesa**, por container
  query e não por media query: quem manda é a largura da mesa, não a da janela.
  Numa mesa de 8 estreita as plaquetas se sobrepunham no topo.
- **O leque cabe.** Dez cartas grandes davam ~460px contra 360 de tela; em tela
  estreita a carta cai um tamanho e a sobreposição sobe. Largura e altura são
  perguntas separadas ([`useTela`](src/ui/useTela.ts)): a largura decide quanto o
  leque abre, a altura decide o tamanho da carta. O
  [teste](tests/handFan.test.ts) afirma que toda mão de 1 a 20 cartas cabe em
  cada uma das telas.
- **Deitado, a coluna vira duas.** Em 360px de altura não há como empilhar
  cabeçalho, mesa, leque e botões de palpite — lado a lado cabe, e ainda sobra
  largura.
- **Alvo de toque.** O marcador tem 13 a 20 pixels e é o único caminho para
  reabrir uma vaza — a área sensível é bem maior que o desenho.
- **`:hover` só onde existe cursor.** No toque ele grudava depois do tap e
  deixava a carta levantada. O fluxo de dois toques já dá o retorno que faltava.
- Modais rolam em vez de cortar, o painel de palpite de 21 botões não empurra
  mais a mesa para fora, e o fundo vai até a borda com o conteúdo recuado do
  entalhe.

## Teatro dos bots

Os bots reagem ao que acontece na mesa com balões de texto. Seis personas —
Zoeiro, Nervoso, Professor, Confiante, Tiozão e Quieto — cada uma com o seu jeito
de falar e o seu nível de tagarelice. Não há áudio: a personalidade vive inteira
no texto.

Os gatilhos saem dos `GameEvent` que o engine já emitia: manilha jogada, zap
(manilha de paus), roubada, vaza estourada, palpite zero, palpite cheio,
distribuidor sem escolha, mão sem manilha, acerto na mosca, erro feio,
eliminação, vitória.

Quem comenta é sempre **outro** bot, nunca quem fez a jogada — salvo nos momentos
em que a graça é a pessoa se gabar do próprio feito. Há cooldown por bot, teto de
dois balões simultâneos, e nenhum bot repete a última frase que disse.

**Registro.** Três pacotes de frases trocáveis na tela de setup: `Familiar`,
`Mesa de bar` e `Sem freio` (padrão) — este último com palavrão de verdade.

## Arquitetura

```
src/engine/     Regras. Funções puras, zero React, zero Math.random.
src/bots/       Bots. Consomem só a PlayerView redigida.
src/transport/  Fronteira UI ↔ jogo. LocalTransport hoje, PeerJS depois.
src/theater/    Personas, gatilhos, reações e voz. Reações são função pura.
src/ui/casino/  A mesa: geometria, feltro, marcadores, roseta, balões.
src/ui/         React. Não conhece o MatchState.
src/state/      Preferências e perfil. Fora do GameConfig de propósito.
scripts/sim.ts  Simulação headless com asserção de invariantes.
```

O engine é `(state, action) => { state, events }`. Todo o estado é serializável
em JSON, inclusive o do PRNG — a mesma semente reproduz a partida inteira, o que
dá testes determinísticos e prepara a sincronização em rede por log de ações.

Ação inválida nunca lança: devolve o estado inalterado mais um evento
`INVALID_ACTION`, para que um transporte de rede tolere mensagens fora de ordem.

**Informação oculta.** `playerView(state, id)` é o único caminho para fora do
engine. Bots e telas consomem só ela. A regra é uma só e não tem exceção: você vê
a sua mão inteira e a de mais ninguém, em qualquer tamanho de mão. O
[teste](tests/oneCardHand.test.ts) serializa a view e afirma que nenhuma carta
alheia aparece nela — inclusive num campo que alguém venha a acrescentar depois
sem pensar.

**Sem XState.** A máquina de estados é um campo `phase` de união discriminada
dentro do próprio estado, com reducer puro. Serializa e replica de graça, que é
o que importa para o multiplayer.

### Bots

Palpite = soma das probabilidades por carta, arredondada. A base é a
hipergeométrica `C(U−S, O) / C(U, O)` — a chance de nenhuma carta superior estar
em mão adversária — mais uma correção calibrada (`SLACK`) para as cartas que não
são imbatíveis. Jogada: política de vitória barata guiada por `palpite − vazas`.

Medido em 400 partidas de 4 jogadores (`--bots medium,easy,random,random`):

| Nível | Penalidade/partida | Erro/mão | Vitórias |
| --- | --- | --- | --- |
| médio | 8,0 | 0,42 | 96% |
| fácil | 15,7 | 0,83 | 4% |
| aleatório | ~37 | 1,94 | 0% |

`'hard'` existe na interface e hoje joga como o médio — o lugar do ISMCTS.

---

## Verificação

```bash
npm run sim -- --seed 1 --games 500 --players 4
```

A simulação afirma, a cada passo, a integridade do baralho, a contagem de cartas
na mão de cada jogador, a presença ou ausência do vira, a soma das vazas e o
fechamento da mão. Vale rodar também com `--players 2`, `5` e `8`: são as mesas
em que o baralho acaba exatamente na distribuição.
