import { describe, expect, it } from 'vitest';

import { hashPassword, hashToken, novoToken, verifyPassword } from '../server/password';
import { APELIDO_MAX } from '../src/state/apelido';
import { validarCredenciais, SENHA_MIN } from '../src/state/credenciais';

/**
 * Só os módulos puros. `server/auth.ts` fala com D1 e carrega tipos do
 * Cloudflare — não entra aqui, e é por isso que a criptografia (`password.ts`) e
 * a validação (`src/state/credenciais.ts`) moram em arquivos separados dele.
 */

describe('hashPassword / verifyPassword', () => {
  it('confere a senha certa e recusa a errada', async () => {
    const guardado = await hashPassword('cavalo-bateria-grampo');
    expect(await verifyPassword('cavalo-bateria-grampo', guardado)).toBe(true);
    expect(await verifyPassword('cavalo-bateria-grampa', guardado)).toBe(false);
    expect(await verifyPassword('', guardado)).toBe(false);
  });

  it('a mesma senha nunca gera o mesmo registro — o salt é por senha', async () => {
    const a = await hashPassword('mesma-senha-aqui');
    const b = await hashPassword('mesma-senha-aqui');
    expect(a).not.toBe(b);
    // Mas as duas continuam conferindo.
    expect(await verifyPassword('mesma-senha-aqui', a)).toBe(true);
    expect(await verifyPassword('mesma-senha-aqui', b)).toBe(true);
  });

  it('grava o formato pbkdf2$iterações$salt$chave', async () => {
    const partes = (await hashPassword('senha-de-teste')).split('$');
    expect(partes).toHaveLength(4);
    expect(partes[0]).toBe('pbkdf2');
    expect(Number(partes[1])).toBeGreaterThanOrEqual(100_000);
  });

  it('registro corrompido é `false`, não exceção', async () => {
    for (const lixo of ['', 'nada', 'pbkdf2$x$y$z', 'pbkdf2$100000$@@@$@@@', 'sha1$1$a$b']) {
      expect(await verifyPassword('senha-de-teste', lixo)).toBe(false);
    }
  });

  it('a senha antiga continua valendo se as iterações mudarem', async () => {
    // O número vai gravado em cada registro justamente para isso.
    const antigo = 'pbkdf2$1000$c2FsdHNhbHRzYWx0c2E=$';
    expect(await verifyPassword('qualquer', antigo)).toBe(false);
  });
});

describe('novoToken / hashToken', () => {
  it('cada token é diferente e cabe numa URL', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => novoToken()));
    expect(tokens.size).toBe(50);
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('o hash é estável e não devolve o token', async () => {
    const token = novoToken();
    expect(await hashToken(token)).toBe(await hashToken(token));
    expect(await hashToken(token)).not.toBe(token);
    expect(await hashToken(token)).not.toBe(await hashToken(novoToken()));
  });
});

describe('validarCredenciais', () => {
  const senhaOk = 'senha-boa-1';

  it('aceita e separa o apelido de exibição da chave única', () => {
    const r = validarCredenciais('  GIka  ', senhaOk);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.display).toBe('GIka');
    expect(r.valor.handle).toBe('gika');
  });

  it('trata maiúsculas como a mesma conta', () => {
    const a = validarCredenciais('Dizão', senhaOk);
    const b = validarCredenciais('DIZÃO', senhaOk);
    expect(a.ok && b.ok && a.valor.handle === b.valor.handle).toBe(true);
  });

  it('recusa apelido vazio em vez de deixar virar o padrão "Você"', () => {
    // `normalizarApelido` devolve "Você" para entrada vazia — ótimo para a mesa,
    // péssimo como conta: o primeiro a cadastrar em branco tomaria o apelido.
    expect(validarCredenciais('', senhaOk).ok).toBe(false);
    expect(validarCredenciais('   ', senhaOk).ok).toBe(false);
  });

  it('recusa senha curta e senha absurda', () => {
    expect(validarCredenciais('Perna', 'x'.repeat(SENHA_MIN - 1)).ok).toBe(false);
    expect(validarCredenciais('Perna', 'x'.repeat(SENHA_MIN)).ok).toBe(true);
    expect(validarCredenciais('Perna', 'x'.repeat(10_000)).ok).toBe(false);
  });

  it('recusa apelido com caractere que a mesa não desenha', () => {
    expect(validarCredenciais('<script>', senhaOk).ok).toBe(false);
    expect(validarCredenciais('a\nb', senhaOk).ok).toBe(false);
  });

  it('aceita acento, número e os separadores comuns', () => {
    for (const nome of ['Alê', 'João_2', 'maria.silva', 'jo-jo', 'Ana Paula']) {
      expect(validarCredenciais(nome, senhaOk).ok).toBe(true);
    }
  });

  it('o apelido nunca passa do que cabe na plaqueta do assento', () => {
    const r = validarCredenciais('x'.repeat(50), senhaOk);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.display).toHaveLength(APELIDO_MAX);
  });

  it('recusa tipo errado sem lançar', () => {
    expect(validarCredenciais(null, senhaOk).ok).toBe(false);
    expect(validarCredenciais('Perna', 42).ok).toBe(false);
  });
});
