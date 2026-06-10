-- Versión del token de sesión. Al incrementarse invalida todos los JWT
-- emitidos previamente para ese usuario (se usa al cambiar o restablecer la contraseña).
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
