import { APELIDO_MAX, APELIDO_PADRAO } from '../state/settings';
import type { UiSettings } from '../state/settings';
import { BetChips } from './casino/BetChips';
import { Marker } from './casino/Marker';
import { corMarcador, CORES, MARCADORES } from './casino/markers';
import type { CorId, MarcadorId } from './casino/markers';
import { BotaoPrimario, Overlay } from './Overlay';

export interface ProfileScreenProps {
  settings: UiSettings;
  onSettings: (s: UiSettings) => void;
  /**
   * Logado, o apelido da mesa é o da conta. O campo continua visível, mas
   * travado: um campo editável que não muda nada seria pior que um travado.
   */
  apelidoTravado?: boolean;
  onFechar: () => void;
}

/**
 * O perfil do jogador: como ele se chama na mesa e com o que ele aposta.
 *
 * Toda escolha se vê antes de valer — a grade de marcadores, as amostras de cor
 * e a faixa de feltro no fim mostram a peça de verdade, nos três estados que ela
 * assume durante a mão. Escolher marcador por nome, sem ver, seria escolher no
 * escuro.
 */
export function ProfileScreen({
  settings,
  onSettings,
  apelidoTravado = false,
  onFechar,
}: ProfileScreenProps) {
  const cor = corMarcador(settings.corMarcador);
  const paleta = { body: cor.body, edge: cor.edge };

  function trocar(patch: Partial<UiSettings>): void {
    onSettings({ ...settings, ...patch });
  }

  return (
    <Overlay onFechar={onFechar} label="Perfil">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold text-gold-300">Perfil</h2>
        <span className="text-xs text-white/45">salvo automaticamente</span>
      </div>

      {/* Apelido ---------------------------------------------------------- */}
      <label className="mt-5 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-white/85">Apelido na mesa</span>
        <input
          className="min-h-11 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-amber-300/70 disabled:cursor-not-allowed disabled:text-white/60"
          value={settings.apelido}
          maxLength={APELIDO_MAX}
          placeholder={APELIDO_PADRAO}
          disabled={apelidoTravado}
          onChange={(e) => trocar({ apelido: e.target.value })}
          onBlur={(e) =>
            trocar({ apelido: e.target.value.trim() === '' ? APELIDO_PADRAO : e.target.value })
          }
        />
        <span className="text-xs text-white/45">
          {apelidoTravado
            ? 'vem da sua conta — saia para jogar com outro nome'
            : `até ${APELIDO_MAX} caracteres — vale a partir da próxima partida`}
        </span>
      </label>

      {/* Marcador --------------------------------------------------------- */}
      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-white/85">Marcador de aposta</legend>
        <p className="mt-1 text-xs text-white/45">
          uma peça por vaza apostada — dourada quando a vaza é feita
        </p>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {MARCADORES.map((m) => {
            const ativo = settings.marcador === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => trocar({ marcador: m.id })}
                aria-pressed={ativo}
                className={[
                  'flex cursor-pointer flex-col items-center gap-2 rounded-xl border px-2 py-3 transition-colors',
                  ativo
                    ? 'border-gold-300/70 bg-gold-400/10'
                    : 'border-white/10 bg-black/25 hover:bg-white/5',
                ].join(' ')}
              >
                <Amostra tipo={m.id} cor={paleta} />
                <span className="text-center text-xs leading-tight font-semibold">{m.label}</span>
                <span className="text-center text-[10px] leading-tight text-white/45">
                  {m.hint}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Cor -------------------------------------------------------------- */}
      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-white/85">Cor</legend>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {CORES.map((c) => (
            <BotaoDeCor
              key={c.id}
              corId={c.id}
              label={c.label}
              tipo={settings.marcador}
              ativo={settings.corMarcador === c.id}
              onEscolher={() => trocar({ corMarcador: c.id })}
            />
          ))}
        </div>
      </fieldset>

      {/* Prévia no feltro -------------------------------------------------- */}
      <div className="mt-5">
        <span className="text-sm font-medium text-white/85">No feltro</span>
        <div className="table-felt mt-2 grid place-items-center rounded-xl px-4 py-5">
          <div className="bet-circle grid min-h-9 min-w-16 place-items-center px-3 py-1.5">
            <BetChips
              key={`${settings.marcador}-${settings.corMarcador}`}
              bid={3}
              tricksWon={2}
              playerName={settings.apelido}
              tipo={settings.marcador}
              cor={paleta}
            />
          </div>
        </div>
        <p className="mt-1.5 text-xs text-white/45">
          apostou 3, fez 2 — as duas douradas são vazas ganhas, a apagada é o que ainda falta
        </p>
      </div>

      {/* Chat wheel -------------------------------------------------------- */}
      <ChatWheelEmBreve />

      <BotaoPrimario onClick={onFechar} className="mt-6 w-full">
        Pronto
      </BotaoPrimario>
    </Overlay>
  );
}

/**
 * A peça na cor escolhida, a mesma peça acesa em ouro e a de vaza a mais. O
 * quarto estado — a apagada, à espera — aparece na prévia do feltro logo abaixo,
 * onde ela faz sentido no meio de uma fileira.
 */
function Amostra({ tipo, cor }: { tipo: MarcadorId; cor: { body: string; edge: string } }) {
  return (
    <span className="flex h-9 items-center justify-center gap-1">
      <Marker tipo={tipo} cor={cor} estado="base" size={20} />
      <Marker tipo={tipo} cor={cor} estado="cumprida" size={20} />
      <Marker tipo={tipo} cor={cor} estado="excedente" size={20} />
    </span>
  );
}

/**
 * A amostra de cor é o próprio marcador escolhido, não um quadradinho: o que se
 * vê aqui é exatamente o que pousa no feltro.
 */
function BotaoDeCor({
  corId,
  label,
  tipo,
  ativo,
  onEscolher,
}: {
  corId: CorId;
  label: string;
  tipo: MarcadorId;
  ativo: boolean;
  onEscolher: () => void;
}) {
  const c = corMarcador(corId);
  return (
    <button
      type="button"
      onClick={onEscolher}
      aria-pressed={ativo}
      title={label}
      aria-label={label}
      className={[
        'grid h-11 w-11 cursor-pointer place-items-center rounded-lg border transition-colors',
        ativo ? 'border-gold-300 bg-gold-400/15' : 'border-white/10 bg-black/25 hover:bg-white/5',
      ].join(' ')}
    >
      <Marker tipo={tipo} cor={{ body: c.body, edge: c.edge }} estado="base" size={22} />
    </button>
  );
}

/**
 * O lugar da roda de conversa, desenhado e desligado.
 *
 * Fica aqui porque o espaço dela no perfil já está decidido — mas sem nenhum
 * comportamento falso: clicar não faz nada, e a tela diz isso.
 */
function ChatWheelEmBreve() {
  const fatias = ['Boa!', 'Ãhn?', 'Vai!', 'Foi mal', 'Rápido aí', 'Ô sorte', 'É isso', 'Calma'];

  return (
    <section className="mt-6 rounded-xl border border-dashed border-white/15 bg-black/20 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-white/85">Roda de conversa</h3>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] tracking-wide text-white/50 uppercase">
          em breve
        </span>
      </div>
      <p className="mt-1 text-xs text-white/45">
        oito falas suas para responder à mesa sem digitar. Ainda não dá para editar.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5 opacity-40" aria-hidden>
        {fatias.map((f) => (
          <span
            key={f}
            className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[11px]"
          >
            {f}
          </span>
        ))}
      </div>
    </section>
  );
}
