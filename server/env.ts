/**
 * Os bindings que o Worker recebe. Espelha o `wrangler.jsonc` — quando um
 * binding entra lá, entra aqui, e o `tsc -b` cobra o resto do código.
 */

export interface Env {
  DB: D1Database;
}

/** Uma linha da tabela `users`. */
export interface UsuarioRow {
  id: string;
  handle: string;
  display: string;
  hash: string;
  created_at: string;
}

/** O que sai para o cliente. Nunca inclui `hash`. */
export interface UsuarioPublico {
  id: string;
  handle: string;
  display: string;
}

export function paraPublico(row: UsuarioRow): UsuarioPublico {
  return { id: row.id, handle: row.handle, display: row.display };
}
