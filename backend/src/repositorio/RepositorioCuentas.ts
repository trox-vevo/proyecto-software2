import { readFileSync } from "node:fs";
import path from "node:path";
import { CuentaAhorros } from "../rentabilidad/CuentaAhorros";
import { ServiceChannels } from "../simulation/domain/ServiceChannels";

interface CuentaJson {
  id: string;
  titular: string;
  saldo: number | string;
  tasaAnual: number | string;
  fechaApertura: string;
  monthlyMaintenanceFee: string;
  channels: { hasPhysicalBranches: boolean; hasAtms: boolean };
}

/**
 * Entrega las cuentas de ahorro. Hoy las lee de un archivo JSON.
 * Si más adelante hay base de datos, solo hay que cambiar esta clase:
 */
export class RepositorioCuentas {
  private readonly archivo: string;

  constructor(archivo = path.join(process.cwd(), "data", "cuentas.json")) {
    this.archivo = archivo;
  }

  obtenerTodas(): CuentaAhorros[] {
    const datos: unknown = JSON.parse(readFileSync(this.archivo, "utf-8"));
    if (!Array.isArray(datos)) {
      throw new Error(`${this.archivo} debe contener un arreglo de cuentas`);
    }

    return (datos as CuentaJson[]).map((c) => {
      const fecha = new Date(c.fechaApertura);
      if (Number.isNaN(fecha.getTime())) {
        throw new Error(`La cuenta ${c.id} tiene una fechaApertura inválida: ${c.fechaApertura}`);
      }
      return new CuentaAhorros(
        c.id,
        c.titular,
        c.saldo,
        c.tasaAnual,
        fecha,
        c.monthlyMaintenanceFee,
        new ServiceChannels(c.channels.hasPhysicalBranches, c.channels.hasAtms),
      );
    });
  }
}
