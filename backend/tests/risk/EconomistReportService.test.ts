import Decimal from "decimal.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EconomistReportService } from "../../src/risk/application/EconomistReportService";
import { EconomistReport } from "../../src/risk/domain/EconomistReport";
import { SbsRiskProfile } from "../../src/risk/domain/SbsRiskProfile";
import { JsonEconomistReportRepository } from "../../src/risk/infrastructure/JsonEconomistReportRepository";

// US26 (TS-83): servicio y repositorio del informe del economista
const informe = (entityId: number) =>
  new EconomistReport(entityId, `Entidad ${entityId}`, "Resumen", ["Fortaleza"], ["Riesgo"], "Recomendación", "Autor", new Date("2026-10-15"));
const perfil = (entityId: number) =>
  new SbsRiskProfile(entityId, `Entidad ${entityId}`, "A", new Decimal("0.15"), new Decimal("0.03"), new Decimal("0.25"), new Date("2026-09-30"), "https://www.sbs.gob.pe/");

describe("EconomistReportService", () => {
  const service = new EconomistReportService(
    { findByEntityId: (id) => (id === 1 || id === 2 ? informe(id) : null) },
    { findByEntityId: (id) => (id === 1 ? perfil(id) : null) },
  );

  it("devuelve el informe con los indicadores de la SBS", () => {
    const report = service.getReport(1);

    expect(report?.summary).toBe("Resumen");
    expect(report?.sbsProfile?.riskRating).toBe("A");
  });

  it("si la entidad no tiene datos de la SBS, el informe sale igual con sbsProfile en null", () => {
    expect(service.getReport(2)?.sbsProfile).toBeNull();
  });

  it("devuelve null si no hay informe", () => {
    expect(service.getReport(3)).toBeNull();
  });
});

describe("JsonEconomistReportRepository", () => {
  const archivoCon = (contenido: unknown) => {
    const archivo = path.join(mkdtempSync(path.join(tmpdir(), "informes-")), "informes.json");
    writeFileSync(archivo, JSON.stringify(contenido));
    return archivo;
  };

  it("lee el informe de la entidad", () => {
    const repository = new JsonEconomistReportRepository(archivoCon([
      { entityId: 9, entityName: "Caja", summary: "S", strengths: ["F1", "F2"], risks: ["R1"], recommendation: "Rec", author: "Autor", publishedAt: "2026-10-15" },
    ]));
    const report = repository.findByEntityId(9);

    expect(report?.entityName).toBe("Caja");
    expect(report?.strengths).toEqual(["F1", "F2"]);
    expect(report?.publishedAt.toISOString().slice(0, 10)).toBe("2026-10-15");
    expect(repository.findByEntityId(1)).toBeNull();
  });

  it("falla con un mensaje claro si el archivo no es un arreglo", () => {
    expect(() => new JsonEconomistReportRepository(archivoCon({})).findByEntityId(1)).toThrow("debe contener un arreglo");
  });

  it("los datos de demostración tienen informe para las 6 entidades de plazo fijo", () => {
    const repository = new JsonEconomistReportRepository();

    for (const id of [1, 2, 3, 4, 5, 6]) {
      expect(repository.findByEntityId(id)?.entityId).toBe(id);
    }
  });
});
