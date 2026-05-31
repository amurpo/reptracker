// Helpers para (de)serializar la configuración de reps por serie,
// almacenada como JSON en una columna de texto.
export function parseRepsConfig(stored: string | null): number[] | null {
  return stored ? (JSON.parse(stored) as number[]) : null
}

export function serializeRepsConfig(config: number[] | null | undefined): string | null {
  return config ? JSON.stringify(config) : null
}
