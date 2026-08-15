-- Resultados de liga.
--
-- Uma linha por partida terminada de um usuário logado. `penalty`, `placement`
-- e `won` são o que o servidor apurou reproduzindo a partida (veja
-- `src/state/leagueReplay.ts`), nunca o que o cliente afirmou.
CREATE TABLE league_results (
  id         TEXT PRIMARY KEY,
  league_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id),
  played_at  TEXT NOT NULL,
  -- 1 quando o usuário terminou em primeiro. Vitória dividida conta para todos.
  won        INTEGER NOT NULL,
  penalty    INTEGER NOT NULL,
  placement  INTEGER NOT NULL,
  -- A config e o log de ações da partida, em JSON. É a prova: dá para
  -- reproduzir a partida de novo a qualquer momento e conferir a linha acima.
  payload    TEXT NOT NULL
);

-- Cobre as duas leituras: a classificação da liga e o histórico do usuário.
CREATE INDEX idx_results_liga ON league_results(league_id, user_id);
CREATE INDEX idx_results_usuario ON league_results(user_id, played_at DESC);
