import { describe, expect, it } from "vitest";
import { formatDemoCardNumber, validateDemoCard } from "./demoCards";

const valid = { holder: "Titular ficticio", number: "0000111122223333", expiry: "12/30", cvv: "123" };
const now = new Date(2026, 10, 6);

describe("US32, formato local de tarjetas ficticias", () => {
  it.each(["0000111122223333", "1111222233334444", "0000000000000001", "0000 1111 2222 3333", " 0000  1111 2222 3333 "])("admite 16 dígitos sin lista ni Luhn obligatorio: %s", (number) => {
    expect(validateDemoCard({ ...valid, number }, now)).toEqual({ errors: {} });
  });

  it.each(["", "111122223333", "00001111222233334"])("explica la longitud incorrecta sin truncarla: %s", (number) => {
    expect(validateDemoCard({ ...valid, number }, now).errors.number).toBe("El número de tarjeta debe contener exactamente 16 dígitos.");
  });

  it.each(["111122223333AAAA", "0000-1111-2222-3333", "0000\t111122223333", "0000111122223333\n", "0000\u00a0111122223333"])("rechaza caracteres distintos de dígitos o espacios: %j", (number) => {
    expect(validateDemoCard({ ...valid, number }, now).errors.number).toBe("El número de tarjeta solo puede contener dígitos y espacios.");
  });

  it.each([
    ["", ""], ["00001", "0000 1"], ["0000111122223333", "0000 1111 2222 3333"],
    ["0000 1111 2222 3333", "0000 1111 2222 3333"], ["00001111222233334", "0000 1111 2222 3333 4"],
    ["0000A111122223333", "0000A111122223333"],
  ])("agrupa sin descartar datos: %j", (input, expected) => {
    expect(formatDemoCardNumber(input)).toBe(expected);
  });

  it.each(["11/26", "12/26", "01/27", "12/30"])("acepta el mes actual o uno posterior: %s", (expiry) => {
    expect(validateDemoCard({ ...valid, expiry }, now).errors).toEqual({});
  });

  it.each(["10/26", "12/25"])("rechaza una fecha vencida: %s", (expiry) => {
    expect(validateDemoCard({ ...valid, expiry }, now).errors.expiry).toContain("anterior al mes actual");
  });

  it("compara el año correctamente al pasar de diciembre a enero", () => {
    expect(validateDemoCard({ ...valid, expiry: "01/27" }, new Date(2026, 11, 31)).errors).toEqual({});
    expect(validateDemoCard({ ...valid, expiry: "12/26" }, new Date(2027, 0, 1)).errors.expiry).toContain("anterior al mes actual");
  });

  it.each(["00/30", "13/30"])("identifica el mes inválido: %s", (expiry) => {
    expect(validateDemoCard({ ...valid, expiry }, now).errors.expiry).toContain("entre 01 y 12");
  });

  it.each(["", "1/30", "12-30", "12/2030", "AA/30"])("explica el formato de fecha inválido: %s", (expiry) => {
    expect(validateDemoCard({ ...valid, expiry }, now).errors.expiry).toContain("formato MM/AA");
  });

  it.each(["000", "123", "987"])("acepta cualquier CVV ficticio de tres dígitos: %s", (cvv) => {
    expect(validateDemoCard({ ...valid, cvv }, now).errors).toEqual({});
  });

  it.each(["", "12", "1234", "ABC", "12 "])("explica el CVV inválido: %j", (cvv) => {
    expect(validateDemoCard({ ...valid, cvv }, now).errors.cvv).toBe("El CVV debe contener exactamente 3 dígitos.");
  });

  it.each([
    ["holder", ""], ["holder", " "], ["holder", "x".repeat(121)],
  ])("conserva la validación de titular: %s", (field, value) => {
    const result = validateDemoCard({ ...valid, [field]: value }, now);
    expect(result.errors).toHaveProperty(field);
  });
});
