import { useState } from 'react';

import { apiCriarSala, apiEntrarSala } from '../api/client';
import type { Usuario } from '../api/client';
import { useSala } from '../state/useSala';
import { MAX_JOGADORES_SALA, MIN_JOGADORES_SALA } from '../transport/protocol';
import type { Assento } from '../transport/protocol';
import type { RemoteTransport } from '../transport/remote';
import { BotaoNeutro, BotaoPrimario } from './Overlay';

/**
 * A porta da sala: criar uma nova ou entrar por código.
 *
 * Sem conta não há sala — o assento precisa saber de quem é, e a reconexão
 * depende disso para devolver a cadeira certa a quem caiu.
 */
export function RoomEntrada({
  usuario,
  onEntrou,
  onVoltar,
}: {
  usuario: Usuario | null;
  onEntrou: (codigo: string) => void;
  onVoltar: () => void;
}) {
  const [jogadores, setJogadores] = useState(4);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function criar() {
    setOcupado(true);
    setErro(null);
    const r = await apiCriarSala(jogadores);
    setOcupado(false);
    if (r.ok) onEntrou(r.dados.codigo);
    else setErro(r.erro);
  }

  async function entrar() {
    const limpo = codigo.trim().toUpperCase();
    if (limpo === '') return;
    setOcupado(true);
    setErro(null);
    const r = await apiEntrarSala(limpo);
    setOcupado(false);
    if (r.ok) onEntrou(limpo);
    else setErro(r.erro);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-5 p-4 sm:p-6">
      <header>
        <button
          type="button"
          onClick={onVoltar}
          className="mb-1 cursor-pointer text-xs text-white/50 transition-colors hover:text-white/80"
        >
          ← Voltar
        </button>
        <h1 className="text-3xl font-black tracking-tight text-amber-300">Jogar online</h1>
        <p className="mt-1 text-sm text-white/60">
          Crie uma sala e passe o código, ou entre no de alguém. Assento que sobrar vira bot.
        </p>
      </header>

      {usuario === null ? (
        <p className="rounded-xl border border-white/10 bg-black/25 px-4 py-6 text-center text-sm text-white/60">
          Entre na sua conta para jogar online.
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-2 rounded-xl border border-white/12 bg-black/25 p-4">
            <h2 className="text-sm font-semibold text-white/80">Criar uma sala</h2>
            <label className="flex items-center justify-between gap-3 text-sm text-white/70">
              Lugares na mesa
              <select
                value={jogadores}
                onChange={(e) => setJogadores(Number(e.target.value))}
                className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-amber-300/70"
              >
                {Array.from(
                  { length: MAX_JOGADORES_SALA - MIN_JOGADORES_SALA + 1 },
                  (_, i) => i + MIN_JOGADORES_SALA,
                ).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <BotaoPrimario onClick={() => void criar()} className="mt-1 w-full">
              {ocupado ? 'Um momento…' : 'Criar sala'}
            </BotaoPrimario>
          </section>

          <section className="flex flex-col gap-2 rounded-xl border border-white/12 bg-black/25 p-4">
            <h2 className="text-sm font-semibold text-white/80">Entrar num código</h2>
            <div className="flex gap-2">
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && void entrar()}
                placeholder="ABCD"
                maxLength={8}
                autoCapitalize="characters"
                autoCorrect="off"
                className="min-h-11 w-full rounded-lg border border-white/15 bg-black/30 px-3 text-center font-mono text-lg tracking-[0.3em] text-white outline-none focus:border-amber-300/60"
              />
              <BotaoNeutro onClick={() => void entrar()} className="shrink-0">
                Entrar
              </BotaoNeutro>
            </div>
          </section>
        </>
      )}

      {erro !== null && (
        <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">
          {erro}
        </p>
      )}
    </div>
  );
}

/**
 * O lobby: quem já chegou, quem falta, e o botão de começar.
 *
 * O código fica grande e em fonte monoespaçada porque a coisa mais comum a
 * fazer aqui é ditá-lo para alguém.
 */
export function RoomLobby({
  transport,
  usuario,
  onSair,
}: {
  transport: RemoteTransport;
  usuario: Usuario;
  onSair: () => void;
}) {
  const { sala } = useSala(transport);
  const [copiado, setCopiado] = useState(false);

  if (sala === null) {
    return (
      <div className="mx-auto flex min-h-full max-w-sm items-center justify-center p-6">
        <p className="text-sm text-white/45">Conectando à sala…</p>
      </div>
    );
  }

  const souAnfitriao = sala.anfitriaoId === usuario.id;
  const humanos = sala.assentos.filter((a) => a.tipo === 'humano').length;
  const vazios = sala.assentos.filter((a) => a.tipo === 'vazio').length;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(sala!.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Sem permissão de área de transferência o código continua na tela para
      // ser lido em voz alta, que é como ele costuma viajar mesmo.
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-5 p-4 sm:p-6">
      <header className="text-center">
        <p className="text-xs text-white/50">Código da sala</p>
        <button
          type="button"
          onClick={() => void copiar()}
          title="Copiar"
          className="cursor-pointer font-mono text-5xl font-black tracking-[0.2em] text-amber-300 transition-colors hover:text-amber-200"
        >
          {sala.codigo}
        </button>
        <p className="mt-1 h-4 text-xs text-white/45">{copiado ? 'copiado!' : 'toque para copiar'}</p>
      </header>

      <ol className="flex flex-col gap-2">
        {sala.assentos.map((assento, i) => (
          <AssentoLinha
            key={i}
            assento={assento}
            numero={i}
            euId={usuario.id}
            anfitriaoId={sala.anfitriaoId}
          />
        ))}
      </ol>

      {souAnfitriao ? (
        <div className="flex flex-col gap-2">
          <BotaoPrimario onClick={() => transport.comecar()} className="w-full">
            Começar {vazios > 0 && `— ${vazios} ${vazios === 1 ? 'bot' : 'bots'}`}
          </BotaoPrimario>
          {vazios > 0 && (
            <p className="text-center text-xs text-white/45">
              {humanos === 1
                ? 'Ninguém chegou ainda — dá para começar só contra bots.'
                : `Os ${vazios} lugares vazios viram bots.`}
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-white/10 bg-black/25 px-4 py-4 text-center text-sm text-white/55">
          Esperando o anfitrião começar…
        </p>
      )}

      <BotaoNeutro onClick={onSair} className="w-full text-sm">
        Sair da sala
      </BotaoNeutro>
    </div>
  );
}

function AssentoLinha({
  assento,
  numero,
  euId,
  anfitriaoId,
}: {
  assento: Assento;
  numero: number;
  euId: string;
  anfitriaoId: string;
}) {
  const souEu = assento.tipo === 'humano' && assento.userId === euId;

  return (
    <li
      className={[
        'flex items-center justify-between gap-3 rounded-xl border px-4 py-3',
        souEu ? 'border-amber-300/40 bg-amber-300/10' : 'border-white/10 bg-black/25',
      ].join(' ')}
    >
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="text-xs text-white/35">{numero + 1}</span>
        <span className="truncate text-sm text-white/85">
          {assento.tipo === 'vazio' ? (
            <span className="text-white/35">livre — vira bot ao começar</span>
          ) : (
            assento.display
          )}
        </span>
        {assento.tipo === 'humano' && assento.userId === anfitriaoId && (
          <span className="shrink-0 text-[10px] text-amber-300/70">anfitrião</span>
        )}
      </span>

      {assento.tipo === 'humano' && !assento.conectado && (
        <span className="shrink-0 text-[10px] text-red-300/70">caiu</span>
      )}
      {assento.tipo === 'bot' && <span className="shrink-0 text-[10px] text-white/35">bot</span>}
    </li>
  );
}
