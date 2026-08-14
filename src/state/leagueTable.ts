/**
 * A classificação acumulada de uma liga.
 *
 * O `GROUP BY` fica no SQL, que é onde ele é barato; a ordem e as posições ficam
 * aqui, que é onde dá para testar. A divisão também evita que a regra de
 * desempate exista escrita em duas linguagens.
 *
 * O critério espelha o da partida: na mesa vence quem erra menos, e na liga
 * vence quem vence mais. Empate divide a posição, igual a `standings()` do
 * engine — vitória dividida já é parte do jogo, não faria sentido a tabela
 * inventar um desempate que a mesa não tem.
 */

/** O que o `GROUP BY` devolve, por jogador. */
export interface AgregadoJogador {
  userId: string;
  display: string;
  partidas: number;
  vitorias: number;
  /** Soma das penalidades de todas as partidas. */
  penalidadeTotal: number;
  /** Menor penalidade numa única partida. */
  melhor: number;
}

export interface LinhaClassificacao extends AgregadoJogador {
  /** 1 = líder. Empate compartilha o número. */
  posicao: number;
  /** Penalidade média por partida, para comparar quem jogou mais com quem jogou menos. */
  media: number;
}

/**
 * Mais vitórias primeiro; empatou, menor penalidade média.
 *
 * A média e não o total: quem jogou trinta partidas somaria mais erro que quem
 * jogou três e ficaria atrás por ter jogado mais, o que puniria exatamente
 * quem sustenta a liga.
 */
export function classificar(agregados: readonly AgregadoJogador[]): LinhaClassificacao[] {
  const linhas = agregados.map((a) => ({
    ...a,
    posicao: 0,
    media: a.partidas > 0 ? a.penalidadeTotal / a.partidas : 0,
  }));

  const chave = (l: LinhaClassificacao): [number, number] => [-l.vitorias, l.media];

  linhas.sort((a, b) => {
    const ka = chave(a);
    const kb = chave(b);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i]! !== kb[i]!) return ka[i]! - kb[i]!;
    }
    // Desempate final pelo nome: sem ele a ordem de dois jogadores idênticos
    // dependeria da ordem em que o banco os devolveu, e a tabela mudaria de
    // lugar sozinha entre dois carregamentos.
    return a.display.localeCompare(b.display, 'pt-BR');
  });

  let posicao = 0;
  let anterior: string | null = null;
  linhas.forEach((l, i) => {
    const assinatura = chave(l).join('|');
    if (assinatura !== anterior) {
      posicao = i + 1;
      anterior = assinatura;
    }
    l.posicao = posicao;
  });

  return linhas;
}
