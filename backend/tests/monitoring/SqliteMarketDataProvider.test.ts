import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/shared/infrastructure/openDatabase";
import { SqliteMarketDataProvider } from "../../src/monitoring/infrastructure/SqliteMarketDataProvider";

describe("TS-116 catálogo local", () => {
  it("lee identidad de entidad y precisión textual, y aísla errores individuales", async () => {
    const db = openDatabase(":memory:");
    try {
      db.prepare("UPDATE fixed_deposit_products SET tea=? WHERE id=1").run("0.123456789123456789");
      const provider = new SqliteMarketDataProvider(db, () => new Date("2026-01-01T00:00:00.000Z"));
      const batch = await provider.fetchCurrent(new AbortController().signal);
      expect(batch.snapshots.find((s) => s.productId === 1)).toMatchObject({ entityId: 1,
        tea: "0.123456789123456789", source: { kind: "SQLITE_DEMO" } });
      db.exec("UPDATE sbs_risk_profiles SET liquidity_ratio='incorrecto' WHERE entity_id=1");
      db.exec("UPDATE fixed_deposit_products SET tea='NaN' WHERE id=2");
      const partial = await provider.fetchCurrent(new AbortController().signal);
      expect(partial.errors).toHaveLength(2);
      expect(partial.snapshots.find((s) => s.productId === 1)?.riskRating).toBeNull();
      expect(partial.snapshots.some((s) => s.productId === 2)).toBe(false);
      expect(partial.snapshots.length).toBeGreaterThan(1);
    } finally { db.close(); }
  });
});
