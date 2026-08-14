/**
 * Quem está logado, do ponto de vista da UI.
 *
 * A sessão em si é um cookie `HttpOnly` que o JavaScript não enxerga — então o
 * estado aqui não é a fonte da verdade, é o eco dela. Na montagem o hook
 * pergunta ao servidor quem é o dono do cookie; o servidor decide.
 */

import { useCallback, useEffect, useState } from 'react';

import { apiCadastro, apiEu, apiLogin, apiLogout } from '../api/client';
import type { Usuario } from '../api/client';

export interface Auth {
  usuario: Usuario | null;
  /** Verdadeiro até a primeira resposta do servidor. */
  carregando: boolean;
  entrar: (apelido: string, senha: string) => Promise<string | null>;
  cadastrar: (apelido: string, senha: string) => Promise<string | null>;
  sair: () => Promise<void>;
}

export function useAuth(): Auth {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    void apiEu().then((r) => {
      if (!vivo) return;
      // 401 aqui é o caso comum — visitante sem conta —, não uma falha.
      setUsuario(r.ok ? r.dados.usuario : null);
      setCarregando(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  /** Devolve a mensagem de erro, ou `null` quando deu certo. */
  const entrar = useCallback(async (apelido: string, senha: string) => {
    const r = await apiLogin(apelido, senha);
    if (!r.ok) return r.erro;
    setUsuario(r.dados.usuario);
    return null;
  }, []);

  const cadastrar = useCallback(async (apelido: string, senha: string) => {
    const r = await apiCadastro(apelido, senha);
    if (!r.ok) return r.erro;
    setUsuario(r.dados.usuario);
    return null;
  }, []);

  const sair = useCallback(async () => {
    await apiLogout();
    // Some da tela mesmo se a chamada falhar: o cookie pode já ter vencido, e
    // deixar o nome na tela sugeriria uma sessão que não existe mais.
    setUsuario(null);
  }, []);

  return { usuario, carregando, entrar, cadastrar, sair };
}
