-- Aliases de búsqueda para el catálogo global de ejercicios
-- (nombres originales en inglés y sinónimos comunes en español).
-- Poblar con: migrations/seed_aliases.sql (generado por scripts/generate-aliases-seed.mjs)
CREATE TABLE IF NOT EXISTS exercise_aliases (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  catalog_id INTEGER NOT NULL REFERENCES exercise_catalog(id) ON DELETE CASCADE,
  alias      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exercise_aliases_catalog ON exercise_aliases(catalog_id);

-- Evita duplicados si el seed se ejecuta más de una vez
CREATE UNIQUE INDEX IF NOT EXISTS uq_exercise_aliases ON exercise_aliases(catalog_id, alias);
