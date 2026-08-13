import type { Balao } from '../../theater/useReactions';
import type { Seat } from './seating';

/**
 * O balão de fala de um bot, pendurado logo acima do assento dele.
 *
 * O rabicho aponta para o lado do assento na mesa, e o balão é empurrado para
 * dentro quando o assento está colado na borda — senão a fala de quem senta na
 * ponta sairia da tela.
 */
export function SpeechBubble({ balao, seat }: { balao: Balao; seat: Seat }) {
  // dirX > 0 → assento na direita da mesa → balão desloca para a esquerda.
  const naDireita = seat.dirX > 0.35;
  const naEsquerda = seat.dirX < -0.35;
  const lado = naEsquerda ? 'esq' : naDireita ? 'dir' : 'meio';
  const deslocamento = naEsquerda ? '-15%' : naDireita ? '-85%' : '-50%';

  return (
    <div
      className="table-slot pointer-events-none z-40"
      style={{
        left: `${seat.x}%`,
        top: `${seat.y}%`,
        transform: `translate(${deslocamento}, -145%)`,
      }}
    >
      <div
        // A largura acompanha a mesa: 208px fixos transbordavam a mesa de um
        // celular inteira, e a fala de quem senta na ponta saía da tela.
        className={`bubble bubble--${lado} ${balao.saindo ? 'bubble--saindo' : ''} max-w-[min(13rem,46cqw)] px-2.5 py-1.5 text-center text-xs leading-tight font-bold sm:px-3 sm:text-sm`}
        aria-live="polite"
      >
        {balao.texto}
      </div>
    </div>
  );
}
