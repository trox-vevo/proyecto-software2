import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JsonSbsRiskRepository } from "../../src/risk/infrastructure/JsonSbsRiskRepository";

// US25 (TS-78): lectura de los datos de la SBS desde un archivo JSON
const archivoCon = (contenido: unknown) => {
  const archivo = path.join(mkdtempSync(path.join(tmpdir(), "sbs-")), "sbs.json");
  writeFileSync(archivo, JSON.stringify(contenido));
  return archivo;
};

const perfilJson = {
  entityId: 7,
  entityName: "Caja de prueba",
  riskRating: "B+",
  capitalAdequacyRatio: "0.1310",
  delinquencyRate: "0.0460",
  liquidityRatio: "0.2210",
  reportDate: "2026-09-30",
  sourceUrl: "https://www.sbs.gob.pe/",
};

describe("JsonSbsRiskRepository", () => {
  it("encuentra el perfil por entityId y convierte los ratios a Decimal", () => {
    const profile = new JsonSbsRiskRepository(archivoCon([perfilJson])).findByEntityId(7);

    expect(profile?.entityName).toBe("Caja de prueba");
    expect(profile?.riskRating).toBe("B+");
    expect(profile?.capitalAdequacyRatio.toString()).toBe("0.131");
    expect(profile?.reportDate.toISOString().slice(0, 10)).toBe("2026-09-30");
  });

  it("devuelve null si la entidad no está en el archivo", () => {
    expect(new JsonSbsRiskRepository(archivoCon([perfilJson])).findByEntityId(1)).toBeNull();
  });

  it("falla con un mensaje claro si el archivo no es un arreglo", () => {
    expect(() => new JsonSbsRiskRepository(archivoCon({})).findByEntityId(1)).toThrow("debe contener un arreglo");
  });

  it("los datos de demostración cubren las 6 entidades de plazo fijo", () => {
    const repository = new JsonSbsRiskRepository();

    for (const id of [1, 2, 3, 4, 5, 6]) {
      expect(repository.findByEntityId(id)?.riskRating).toMatch(/^[A-E][+-]?$/);
    }
  });
});
