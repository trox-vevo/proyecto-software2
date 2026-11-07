// SQLite admite int64. La API pública usa únicamente enteros positivos exactos de JS.
export function numericIdentifier(value: unknown): number {
  if (typeof value === "bigint") {
    if (value > 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
  } else if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  throw new RangeError("El identificador de usuario debe ser un entero positivo dentro del rango seguro de JavaScript.");
}
