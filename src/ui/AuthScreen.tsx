import { useState } from 'react';

import { APELIDO_MAX } from '../state/apelido';
import { SENHA_MIN } from '../state/credenciais';
import type { Auth } from '../state/useAuth';
import { BotaoPrimario } from './Overlay';

/**
 * Entrar e cadastrar no mesmo formulário.
 *
 * São os mesmos dois campos e o mesmo botão — separar em duas telas só faria o
 * jogador que errou o modo digitar tudo de novo. O que muda é o verbo.
 *
 * A regra do apelido e o tamanho mínimo da senha vêm dos mesmos módulos que o
 * servidor usa para validar, então a dica na tela não pode divergir da regra.
 */
export function AuthScreen({ auth, onVoltar }: { auth: Auth; onVoltar: () => void }) {
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar');
  const [apelido, setApelido] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cadastrando = modo === 'cadastrar';

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    const falha = cadastrando
      ? await auth.cadastrar(apelido, senha)
      : await auth.entrar(apelido, senha);
    setEnviando(false);
    if (falha) setErro(falha);
    else onVoltar();
  }

  function trocarModo() {
    setModo(cadastrando ? 'entrar' : 'cadastrar');
    setErro(null);
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
        <h1 className="text-3xl font-black tracking-tight text-amber-300">
          {cadastrando ? 'Criar conta' : 'Entrar'}
        </h1>
        <p className="mt-1 text-sm text-white/60">
          A conta guarda seus resultados na liga e te dá assento nas salas online.
        </p>
      </header>

      <form onSubmit={enviar} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-white/70">Apelido</span>
          <input
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            maxLength={APELIDO_MAX}
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            className="min-h-11 rounded-lg border border-white/15 bg-black/30 px-3 text-white outline-none focus:border-amber-300/60"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-white/70">Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete={cadastrando ? 'new-password' : 'current-password'}
            className="min-h-11 rounded-lg border border-white/15 bg-black/30 px-3 text-white outline-none focus:border-amber-300/60"
          />
          {cadastrando && (
            <span className="text-[11px] text-white/45">Pelo menos {SENHA_MIN} caracteres.</span>
          )}
        </label>

        {erro !== null && (
          <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="min-h-11 cursor-pointer rounded-lg bg-amber-300 px-4 py-2.5 font-bold text-felt-900 transition-colors hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60"
        >
          {enviando ? 'Um momento…' : cadastrando ? 'Criar conta' : 'Entrar'}
        </button>
      </form>

      <button
        type="button"
        onClick={trocarModo}
        className="cursor-pointer text-sm text-white/55 transition-colors hover:text-white/85"
      >
        {cadastrando ? 'Já tenho conta — entrar' : 'Não tenho conta — criar uma'}
      </button>
    </div>
  );
}

/** A plaquinha de conta no topo da home. */
export function ContaBadge({ auth, onEntrar }: { auth: Auth; onEntrar: () => void }) {
  if (auth.carregando) return <span className="text-xs text-white/30">…</span>;

  if (!auth.usuario) {
    return (
      <BotaoPrimario onClick={onEntrar} className="text-sm">
        Entrar
      </BotaoPrimario>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="max-w-32 truncate text-sm font-semibold text-amber-200">
        {auth.usuario.display}
      </span>
      <button
        type="button"
        onClick={() => void auth.sair()}
        className="min-h-11 cursor-pointer px-2 text-xs text-white/45 transition-colors hover:text-white/80"
      >
        Sair
      </button>
    </div>
  );
}
