import Decimal from "decimal.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DigitalChannels } from "../domain/DigitalChannels";
import { FinancialProduct } from "../domain/FinancialProduct";
import { FinancialProductRepository } from "../domain/FinancialProductRepository";
import { ServiceChannels } from "../domain/ServiceChannels";

// Nombres reales; tasas, canales e indicadores ficticios. Cubren todas las
// combinaciones de canales para la Sprint Review. Las pruebas NO dependen de estos datos.
// La alternativa en memoria comparte los nombres y la revisión FSD del catálogo SQLite.
const revision = JSON.parse(readFileSync(path.join(__dirname, "../../../db/fsd-verificacion-2026-11-15.json"), "utf8")) as {
  consultadoEl: string; revisionLocalHasta: string; fuenteMiembros: string; fuenteSbs: string;
  entidades: { idExistente: number | null; nombre: string; verificadaFsd: boolean }[];
};
const product = (
  id: number,
  tea: string,
  minimumAmount: string,
  hasPhysicalBranches: boolean,
  hasAtms: boolean,
  hasDigitalBanking: boolean,
  hasMobileApp: boolean,
) => {
  const entity = revision.entidades.find((item) => item.idExistente === id)!;
  return new FinancialProduct(
    id,
    entity.nombre,
    new Decimal(tea),
    new Decimal(minimumAmount),
    new ServiceChannels(hasPhysicalBranches, hasAtms),
    { entidadFinanciera: entity.nombre, estado: entity.verificadaFsd ? "CUBIERTO" : "NO_VERIFICADO",
      fechaVerificacion: revision.consultadoEl, vigenteHasta: entity.verificadaFsd ? revision.revisionLocalHasta : null,
      fuente: entity.verificadaFsd ? revision.fuenteMiembros : revision.fuenteSbs },
    new DigitalChannels(hasDigitalBanking, hasMobileApp),
  );
};

// Map y no objeto literal: una clave como "constructor" no debe devolver nada heredado
const DEMO_PRODUCTS = new Map<string, FinancialProduct[]>([
  [
    "Lima",
    [
      product(1, "0.055", "500", true, true, true, true),
      product(2, "0.06", "1000", true, false, true, false),
      product(3, "0.0575", "500", false, true, false, true),
      product(4, "0.045", "500", false, false, false, false),
      product(5, "0.05", "500", true, true, true, true),
    ],
  ],
  ["Cusco", [product(6, "0.065", "500", true, false, false, true)]],
]);

export class InMemoryProductRepository implements FinancialProductRepository {
  // Por defecto, los datos de demostración; las pruebas pasan los suyos
  constructor(
    private readonly productsByDepartment: Map<string, FinancialProduct[]> = DEMO_PRODUCTS,
  ) {}

  async findFixedDepositsByDepartment(
    department: string,
  ): Promise<FinancialProduct[]> {
    return this.productsByDepartment.get(department) ?? [];
  }
}
