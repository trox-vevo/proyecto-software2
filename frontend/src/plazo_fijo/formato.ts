/** Solo presentación: desplaza la coma para porcentajes sin convertir el importe a Number. */
function decimalVisible(valor: string, desplazamiento = 0): string {
  const partes = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(valor);
  if (!partes) return "—";
  const [, signo, enteros, fraccion = "", exponente = "0"] = partes;
  const digitos = enteros + fraccion;
  const posicion = enteros.length + Number(exponente) + desplazamiento;
  const entero = (posicion <= 0 ? "0" : digitos.padEnd(posicion, "0").slice(0, posicion))
    .replace(/^0+(?=\d)/, "");
  const decimales = (posicion < 0 ? "0".repeat(-posicion) + digitos : digitos.slice(posicion))
    .replace(/0+$/, "").padEnd(2, "0");
  return `${signo}${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${decimales}`;
}

export const formatearImporte = (valor: string): string => `S/ ${decimalVisible(valor)}`;
export const formatearTasa = (valor: string): string => `${decimalVisible(valor, 2)} %`;
