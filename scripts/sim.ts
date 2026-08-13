/**
 * Simulação headless bot-vs-bot.
 *
 * Roda muitas partidas afirmando os invariantes do engine a cada passo. É a
 * rede que pega os casos de borda que os testes unitários não imaginaram —
 * principalmente as mesas em que o baralho acaba exatamente na distribuição.
 *
 *   npm run sim -- --seed 1 --games 500 --players 4
 *   npm run sim -- --players 8 --games 200 --tie-break melar
 *   npm run sim -- --players 4 --mode elimination --lives 3
 */

import { createBot } from '../src/bots';
import type { SimLevel } from '../src/bots';
import { runMatch } from '../src/bots/runner';
import type { BotMap } from '../src/bots/types';
import { assertInvariants } from '../src/engine/invariants';
import { defaultConfig, defaultPlayers } from '../src/engine/reducer';
import type { GameConfig, ScoringMode, TieBreak } from '../src/engine/types';

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

interface Options {
  seed: number;
  games: number;
  players: number;
  cap: number | null;
  mode: ScoringMode;
  lives: number;
  tieBreak: TieBreak;
  /** Nível de cada assento. Se faltar, o último repete até completar a mesa. */
  bots: SimLevel[];
  quiet: boolean;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    seed: 1,
    games: 100,
    players: 4,
    cap: null,
    mode: 'penalty',
    lives: 5,
    tieBreak: 'suit',
    bots: ['random'],
    quiet: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const value = argv[i + 1];
    switch (arg) {
      case '--seed':
        opts.seed = Number(value);
        i++;
        break;
      case '--games':
        opts.games = Number(value);
        i++;
        break;
      case '--players':
        opts.players = Number(value);
        i++;
        break;
      case '--cap':
        opts.cap = value === 'none' ? null : Number(value);
        i++;
        break;
      case '--mode':
        opts.mode = value as ScoringMode;
        i++;
        break;
      case '--lives':
        opts.lives = Number(value);
        i++;
        break;
      case '--tie-break':
        opts.tieBreak = value as TieBreak;
        i++;
        break;
      case '--bots':
        opts.bots = String(value).split(',') as SimLevel[];
        i++;
        break;
      case '--quiet':
        opts.quiet = true;
        break;
      case '--help':
        console.log(
          [
            'Uso: npm run sim -- [opções]',
            '  --seed <n>            semente inicial (default 1)',
            '  --games <n>           número de partidas (default 100)',
            '  --players <2..8>      jogadores na mesa (default 4)',
            '  --cap <n|none>        teto de cartas por mão (default none)',
            '  --mode <penalty|elimination>',
            '  --lives <n>           vidas iniciais no modo elimination',
            '  --tie-break <suit|melar>',
            '  --quiet               só o resumo final',
          ].join('\n'),
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Argumento desconhecido: ${arg}`);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Estatísticas
// ---------------------------------------------------------------------------

interface Stats {
  games: number;
  hands: number;
  tricks: number;
  handsWithoutVira: number;
  annulledTricks: number;
  exactBids: number;
  bids: number;
  penaltyByPlayer: number[];
  winsByPlayer: number[];
  /** Soma de (palpite − vazas) por assento: mede over/under-bidding. */
  biasByPlayer: number[];
  handsByPlayer: number[];
}

function emptyStats(numPlayers: number): Stats {
  return {
    games: 0,
    hands: 0,
    tricks: 0,
    handsWithoutVira: 0,
    annulledTricks: 0,
    exactBids: 0,
    bids: 0,
    penaltyByPlayer: Array.from({ length: numPlayers }, () => 0),
    winsByPlayer: Array.from({ length: numPlayers }, () => 0),
    biasByPlayer: Array.from({ length: numPlayers }, () => 0),
    handsByPlayer: Array.from({ length: numPlayers }, () => 0),
  };
}

function levelFor(seat: number, bots: SimLevel[]): SimLevel {
  return bots[seat] ?? bots[bots.length - 1]!;
}

function botsFor(config: GameConfig, seed: number, levels: SimLevel[]): BotMap {
  const map: BotMap = {};
  config.players.forEach((_, i) => {
    map[`p${i}`] = createBot(levelFor(i, levels), seed + i * 7919 + 13);
  });
  return map;
}

function pct(part: number, whole: number): string {
  return whole === 0 ? '  n/a' : `${((100 * part) / whole).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const stats = emptyStats(opts.players);
  const started = Date.now();

  console.log(
    `Simulando ${opts.games} partidas · ${opts.players} jogadores · ` +
      `modo ${opts.mode} · desempate ${opts.tieBreak} · teto ${opts.cap ?? 'natural'}`,
  );

  for (let g = 0; g < opts.games; g++) {
    const seed = (opts.seed + g) >>> 0;
    const config = defaultConfig({
      players: defaultPlayers(opts.players),
      seed,
      maxCardsCap: opts.cap,
      scoringMode: opts.mode,
      startingLives: opts.lives,
      tieBreak: opts.tieBreak,
    });

    let final;
    try {
      final = runMatch(config, botsFor(config, seed, opts.bots), {
        onStep: (state, action) => assertInvariants(state, `seed ${seed} / ${action.t}`),
        onEvent: (event) => {
          if (event.t === 'HAND_DEALT' && event.vira === null) stats.handsWithoutVira++;
          if (event.t === 'TRICK_ANNULLED') stats.annulledTricks++;
          if (event.t === 'TRICK_WON') stats.tricks++;
          if (event.t === 'HAND_SCORED') {
            stats.hands++;
            for (const row of event.result.rows) {
              stats.bids++;
              if (row.penalty === 0) stats.exactBids++;
              const seat = Number(row.playerId.slice(1));
              stats.biasByPlayer[seat]! += row.bid - row.tricksWon;
              stats.handsByPlayer[seat]! += 1;
            }
          }
        },
      });
    } catch (error) {
      console.error(`\n✗ FALHA na partida ${g} (seed ${seed})`);
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }

    stats.games++;
    final.players.forEach((p, i) => {
      stats.penaltyByPlayer[i]! += p.penalty;
    });
    for (const id of final.winnerIds) {
      stats.winsByPlayer[Number(id.slice(1))]! += 1 / final.winnerIds.length;
    }

    if (!opts.quiet && (g + 1) % 100 === 0) {
      console.log(`  ${g + 1}/${opts.games} partidas...`);
    }
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(2);
  console.log(`\n✓ ${stats.games} partidas sem violar invariantes (${elapsed}s)\n`);
  console.log(`  mãos jogadas .............. ${stats.hands}`);
  console.log(`  vazas resolvidas .......... ${stats.tricks}`);
  console.log(`  mãos sem vira ............. ${stats.handsWithoutVira}`);
  console.log(`  vazas anuladas (melar) .... ${stats.annulledTricks}`);
  console.log(`  palpites exatos ........... ${stats.exactBids}/${stats.bids} (${pct(stats.exactBids, stats.bids)})`);
  console.log('\n  jogador  nível        pen/partida   erro/mão   viés/mão   vitórias');
  stats.penaltyByPlayer.forEach((total, i) => {
    const maos = stats.handsByPlayer[i]!;
    const level = levelFor(i, opts.bots).padEnd(10);
    const porPartida = (total / stats.games).toFixed(2).padStart(8);
    const porMao = (total / Math.max(1, maos)).toFixed(3).padStart(7);
    const bias = (stats.biasByPlayer[i]! / Math.max(1, maos)).toFixed(3).padStart(7);
    const wins = pct(stats.winsByPlayer[i]!, stats.games).padStart(8);
    console.log(`  p${i}       ${level}  ${porPartida}     ${porMao}    ${bias}   ${wins}`);
  });
}

main();
