-- Contas e sessões.
--
-- `handle` é o apelido em minúsculas e é a chave única: "GIka" e "gika" são a
-- mesma conta. `display` guarda a grafia escolhida, que é a que senta à mesa.
CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  handle     TEXT NOT NULL UNIQUE,
  display    TEXT NOT NULL,
  -- pbkdf2$<iterações>$<salt>$<chave>, montado em server/password.ts.
  hash       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Só o SHA-256 do token. O token cru existe apenas no cookie do dono, então
-- um vazamento desta tabela não dá sessão a ninguém.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
