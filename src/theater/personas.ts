/**
 * Quem senta na mesa e o que cada um fala.
 *
 * `FALAS_COMUNS` cobre todos os gatilhos; cada persona sobrescreve só os
 * momentos em que a personalidade dela importa de verdade — manilha, zap, acerto,
 * erro, eliminação e vitória. O resto cai no pool comum, o que evita ter que
 * escrever seis versões de tudo e mantém o arquivo editável à mão.
 *
 * Os três registros existem para você poder baixar o tom sem mexer em código.
 * O padrão é `solto`, escolhido na tela de setup.
 *
 * Não há áudio: a personalidade de cada bot vive inteira no texto do balão.
 */

import type { Registro, Trigger } from './triggers';

export type Falas = Partial<Record<Registro, string[]>>;
export type PorGatilho = Partial<Record<Trigger, Falas>>;

export interface Persona {
  id: string;
  nome: string;
  /** 0..1 — o quanto essa persona abre a boca. */
  tagarelice: number;
  falas: PorGatilho;
}

// ---------------------------------------------------------------------------
// Pool comum
// ---------------------------------------------------------------------------

export const FALAS_COMUNS: PorGatilho = {
  zap: {
    leve: ['O mais forte de todos!', 'Contra esse não tem jeito.', 'Acabou a discussão.'],
    bar: ['ZAP! Guarda as carta.', 'Contra esse não tem conversa!', 'Acabou a brincadeira.'],
    solto: ['ZAP, PORRA!', 'Contra esse não tem conversa, caralho.', 'Fodeu geral.'],
  },
  manilha: {
    leve: ['Que isso!', 'Olha a manilha!', 'Essa foi forte.'],
    bar: ['Que issooo!', 'Gigantee!', 'Sacanagem!'],
    solto: ['QUE PORRA É ESSA', 'Caralho, gigante!', 'Sacanagem, filho da puta!'],
  },
  roubada: {
    leve: ['Levou com essa?', 'Passou raspando.', 'Que sorte.'],
    bar: ['Roubou essa!', 'Levou com carta de mentira!', 'Tá com o santo virado.'],
    solto: ['Roubou, safado!', 'Levou com essa merda de carta?', 'Que sorte do caralho.'],
  },
  passou: {
    leve: ['Passou do que precisava.', 'Essa não era pra ele.', 'Vaza a mais.'],
    bar: ['Comeu vaza demais!', 'Essa aí não era sua não!', 'Passou do ponto.'],
    solto: ['Comeu vaza demais, porra!', 'Essa não era tua, caralho!', 'Se fodeu sozinho.'],
  },
  melou: {
    leve: ['Melou.', 'Empatou, ninguém leva.', 'Anulou as duas.'],
    bar: ['Melou tudo!', 'Ninguém leva essa!', 'Anulou, que zica.'],
    solto: ['Melou essa merda!', 'Ninguém leva porra nenhuma!', 'Anulou, que zica do caralho.'],
  },
  bid_zero: {
    leve: ['Vai de zero.', 'Nenhuma?', 'Fugindo da raia.'],
    bar: ['Corrida!', 'Zero? Tá com medo?', 'Vai correr, é?'],
    solto: ['Corrida, otário!', 'Zero? Tá cagado de medo.', 'Vai correr, viado?'],
  },
  bid_all: {
    leve: ['Todas! Confiante.', 'Aposta alta essa.', 'Olha a coragem.'],
    bar: ['Todas?! Confiante hein!', 'Vai com tudo!', 'Tá blefando, só pode.'],
    solto: ['TODAS? Tá louco, porra!', 'Vai com tudo, desgraçado!', 'Tá blefando, só pode.'],
  },
  bid_forcado: {
    leve: ['Não teve escolha.', 'Foi obrigado.', 'A regra mandou.'],
    bar: ['Fodeu, sou obrigado!', 'Não deu escolha pra ele!', 'Engoliu seco.'],
    solto: ['Puta que pariu, sou obrigado!', 'Não teve escolha, se fodeu.', 'Engoliu seco, coitado.'],
  },
  sem_manilha: {
    leve: ['Sem manilha essa mão!', 'Baralho inteiro na mesa.', 'Vale o três de paus.'],
    bar: ['Sem manilha, hein! Vale o três de paus.', 'Baralho todo na mesa!', 'Agora é na raça.'],
    solto: ['Sem manilha, porra! Vale o três de paus.', 'Baralho todo na mesa, caralho.', 'Agora é na raça.'],
  },
  na_mosca: {
    leve: ['Na mosca!', 'Certinho.', 'Acertou em cheio.'],
    bar: ['Na moscaaa!', 'Cravou!', 'É disso que eu tô falando!'],
    solto: ['NA MOSCA, PORRA!', 'Cravou, desgraçado!', 'É disso que eu tô falando!'],
  },
  errou: {
    leve: ['Errou a conta.', 'Não foi dessa vez.', 'Essa doeu.'],
    bar: ['Errou feio!', 'Não foi dessa vez, não.', 'Essa doeu hein.'],
    solto: ['Errou feio, caralho!', 'Se fodeu bonito.', 'Essa doeu, porra.'],
  },
  eliminado: {
    leve: ['Acabou pra ele.', 'Saiu da mesa.', 'Até a próxima!'],
    bar: ['Rodou!', 'Foi pro saco!', 'Tchau, obrigado!'],
    solto: ['Rodou, porra!', 'Foi pro caralho!', 'Tchau, otário!'],
  },
  venceu: {
    leve: ['Vitória merecida.', 'Ganhou bonito.', 'Parabéns!'],
    bar: ['É campeão!', 'Ganhou de lavada!', 'Passa o troféu!'],
    solto: ['É CAMPEÃO, PORRA!', 'Ganhou de lavada, desgraçado!', 'Passa a grana!'],
  },
};

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------

export const PERSONAS: Persona[] = [
  {
    id: 'zoeiro',
    nome: 'Zoeiro',
    tagarelice: 0.85,
    falas: {
      manilha: {
        leve: ['Ihhh, olha a manilha!', 'Guardou a boa, hein!'],
        bar: ['Ihhh, guardou a boa!', 'Que issooo, meu irmão!', 'Sacanagem pura!'],
        solto: ['Ihhh, guardou a boa, safado!', 'Que issooo, caralho!', 'Sacanagem pura, porra!'],
      },
      zap: {
        leve: ['O papai chegou!', 'Pode dobrar as cartas.'],
        bar: ['O PAI TÁ ON!', 'Pode dobrar as carta e ir embora!'],
        solto: ['O PAI TÁ ON, PORRA!', 'Dobra essa merda e vai embora!'],
      },
      na_mosca: {
        leve: ['Óbvio que eu ia acertar.', 'Tava fácil.'],
        bar: ['Tava fácil demais!', 'Nem precisei pensar!'],
        solto: ['Tava fácil pra caralho!', 'Nem pensei, porra!'],
      },
      errou: {
        leve: ['Deixei vocês ganharem.', 'Foi de propósito.'],
        bar: ['Deixei vocês ganhar, vai!', 'Foi de propósito, juro!'],
        solto: ['Deixei vocês ganhar, porra!', 'Foi de propósito, caralho!'],
      },
    },
  },
  {
    id: 'nervoso',
    nome: 'Nervoso',
    tagarelice: 0.8,
    falas: {
      manilha: {
        leve: ['Não acredito nisso.', 'Sempre comigo!'],
        bar: ['Não acredito! Sempre comigo!', 'Sacanagem, tava na mão!'],
        solto: ['Não acredito, porra! Sempre comigo!', 'Sacanagem, tava na minha mão!'],
      },
      zap: {
        leve: ['Claro que ele tinha.', 'Só podia.'],
        bar: ['Claro que ele tinha o zap!', 'Só podia ser comigo!'],
        solto: ['Claro que ele tinha o zap, caralho!', 'Só podia ser comigo, porra!'],
      },
      na_mosca: {
        leve: ['Ufa! Passei perto.', 'Quase que eu erro.'],
        bar: ['Ufa! Quase que eu erro!', 'Passei perto demais!'],
        solto: ['Ufa, porra! Quase que eu erro!', 'Passei perto pra caralho!'],
      },
      errou: {
        leve: ['Eu sabia! Sempre eu.', 'Não é possível.'],
        bar: ['Eu sabia! Sempre eu!', 'Não é possível, cara!'],
        solto: ['EU SABIA, PORRA! Sempre eu!', 'Não é possível, caralho!'],
      },
      eliminado: {
        leve: ['Pronto, era o que faltava.', 'Já esperava por isso.'],
        bar: ['Pronto! Era só o que faltava!', 'Já esperava, viu.'],
        solto: ['Pronto, porra! Era só o que faltava!', 'Já esperava, caralho.'],
      },
    },
  },
  {
    id: 'professor',
    nome: 'Professor',
    tagarelice: 0.45,
    falas: {
      manilha: {
        leve: ['Previsível.', 'Eu tinha contado essa carta.'],
        bar: ['Previsível. Eu contei essa carta.', 'Dava pra ver de longe.'],
        solto: ['Previsível pra caralho. Eu contei essa carta.', 'Dava pra ver de longe, porra.'],
      },
      zap: {
        leve: ['Probabilidade de um em dez.', 'Estatisticamente, era esperado.'],
        bar: ['Um em dez. Deu nele.', 'Estatística é estatística.'],
        solto: ['Um em dez, porra. Deu nele.', 'Estatística é estatística, caralho.'],
      },
      na_mosca: {
        leve: ['Cálculo simples.', 'Era a jogada correta.'],
        bar: ['Cálculo simples, senhores.', 'Era a jogada certa.'],
        solto: ['Cálculo simples, porra.', 'Era a jogada certa, caralho.'],
      },
      errou: {
        leve: ['Variância.', 'A conta estava certa.'],
        bar: ['Variância. A conta tava certa.', 'Azar não é erro.'],
        solto: ['Variância, porra. A conta tava certa.', 'Azar não é erro, caralho.'],
      },
    },
  },
  {
    id: 'confiante',
    nome: 'Confiante',
    tagarelice: 0.6,
    falas: {
      manilha: {
        leve: ['Tenho melhor.', 'Guarda essa energia.'],
        bar: ['Tenho melhor que essa.', 'Guarda essa comemoração.'],
        solto: ['Tenho melhor que essa merda.', 'Guarda essa comemoração, porra.'],
      },
      zap: {
        leve: ['Sorte de principiante.', 'Aproveita, é uma por mão.'],
        bar: ['Sorte de principiante!', 'Aproveita, é uma por mão.'],
        solto: ['Sorte de principiante, porra!', 'Aproveita, caralho, é uma por mão.'],
      },
      na_mosca: {
        leve: ['Óbvio.', 'Tava na mão desde o começo.'],
        bar: ['Óbvio. Tava na mão.', 'Fácil demais.'],
        solto: ['Óbvio, porra. Tava na mão.', 'Fácil pra caralho.'],
      },
      venceu: {
        leve: ['Como eu disse.', 'Nunca tive dúvida.'],
        bar: ['Como eu disse desde o começo!', 'Nunca tive dúvida.'],
        solto: ['Como eu disse, porra!', 'Nunca tive dúvida, caralho.'],
      },
    },
  },
  {
    id: 'tiozao',
    nome: 'Tiozão',
    tagarelice: 0.7,
    falas: {
      manilha: {
        leve: ['É disso que o povo gosta!', 'Ó o pai aí, ó!'],
        bar: ['É disso que o povo gosta!', 'Ó o pai aí, ó!', 'Baitaaa carta!'],
        solto: ['É disso que o povo gosta, porra!', 'Ó o pai aí, ó!', 'Baita carta do caralho!'],
      },
      zap: {
        leve: ['No meu tempo isso valia dobrado!', 'Esse aí é o xerife!'],
        bar: ['No meu tempo isso valia dobrado!', 'Esse aí é o xerife da mesa!'],
        solto: ['No meu tempo isso valia dobrado, porra!', 'Esse aí é o xerife, caralho!'],
      },
      na_mosca: {
        leve: ['Experiência, meu filho.', 'Cabelo branco não é enfeite.'],
        bar: ['Experiência, meu filho!', 'Cabelo branco não é enfeite não!'],
        solto: ['Experiência, meu filho, porra!', 'Cabelo branco não é enfeite, caralho!'],
      },
      errou: {
        leve: ['Errar é humano.', 'Vamo que vamo.'],
        bar: ['Errar é humano, meu consagrado.', 'Vamo que vamo!'],
        solto: ['Errar é humano, porra.', 'Vamo que vamo, caralho!'],
      },
    },
  },
  {
    id: 'quieto',
    nome: 'Quieto',
    tagarelice: 0.22,
    falas: {
      manilha: { leve: ['Hm.'], bar: ['Hm.', 'Boa.'], solto: ['Hm.', 'Boa, porra.'] },
      zap: { leve: ['Certo.'], bar: ['Certo.', 'Justo.'], solto: ['Certo, porra.', 'Justo.'] },
      na_mosca: { leve: ['Era isso.'], bar: ['Era isso.'], solto: ['Era isso, porra.'] },
      errou: { leve: ['...'], bar: ['...'], solto: ['...'] },
      venceu: { leve: ['Obrigado.'], bar: ['Valeu.'], solto: ['Valeu, porra.'] },
    },
  },
];

/** Persona de cada assento, estável durante a partida inteira. */
export function personaPara(seat: number): Persona {
  return PERSONAS[seat % PERSONAS.length]!;
}

/**
 * Frases disponíveis para uma persona num gatilho. A própria persona tem
 * prioridade; sem override, cai no pool comum; sem pool no registro pedido,
 * cai no `bar`, que é o registro intermediário e sempre existe.
 */
export function falasDe(persona: Persona, trigger: Trigger, registro: Registro): string[] {
  const proprias = persona.falas[trigger]?.[registro];
  if (proprias && proprias.length > 0) return proprias;

  const comuns = FALAS_COMUNS[trigger]?.[registro];
  if (comuns && comuns.length > 0) return comuns;

  return FALAS_COMUNS[trigger]?.bar ?? [];
}
