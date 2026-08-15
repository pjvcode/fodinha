/**
 * O mínimo de HTTP que as rotas precisam: respostas JSON, leitura de cookie e
 * leitura de corpo que não explode.
 *
 * Só APIs web padrão — `Request`, `Response`, `Headers` — nenhum tipo do
 * Cloudflare. O que estiver aqui roda igual num Worker e no Vitest.
 */

export const COOKIE_SESSAO = 'desafio_sessao';

/** Trinta dias. Renovado a cada login, não a cada requisição. */
export const VALIDADE_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;

export function json(dados: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(dados), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...init?.headers },
  });
}

/** Erro no formato que `src/api/client.ts` sabe destrinchar. */
export function erro(status: number, mensagem: string): Response {
  return json({ erro: mensagem }, { status });
}

/**
 * Corpo JSON, ou `null` se vier vazio, truncado ou não for um objeto.
 *
 * Devolver `null` em vez de lançar é deliberado: um corpo malformado é um 400,
 * não um 500, e nenhuma rota deve precisar de try/catch para isso.
 */
export async function lerJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const dados: unknown = await req.json();
    return dados !== null && typeof dados === 'object' ? (dados as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function lerCookie(req: Request, nome: string): string | null {
  const cabecalho = req.headers.get('cookie');
  if (!cabecalho) return null;
  for (const parte of cabecalho.split(';')) {
    const igual = parte.indexOf('=');
    if (igual < 0) continue;
    if (parte.slice(0, igual).trim() === nome) return parte.slice(igual + 1).trim();
  }
  return null;
}

/**
 * `HttpOnly` para o token ficar fora do alcance de qualquer script — é por isso
 * que ele não vive no `localStorage`. `SameSite=Lax` porque o app é servido do
 * mesmo domínio da API e não há fluxo entre sites a preservar.
 *
 * `Secure` fica de fora em `localhost`: o dev roda em HTTP e o navegador
 * descartaria o cookie em silêncio, quebrando o login só no desenvolvimento.
 */
export function cookieDeSessao(token: string, url: URL, maxAgeSegundos: number): string {
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const partes = [
    `${COOKIE_SESSAO}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSegundos}`,
  ];
  if (!local) partes.push('Secure');
  return partes.join('; ');
}

/** O mesmo cookie com validade zero — o navegador apaga na hora. */
export function cookieExpirado(url: URL): string {
  return cookieDeSessao('', url, 0);
}
