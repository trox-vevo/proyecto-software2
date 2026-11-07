import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { FavoriteService } from "../../src/favorites/application/FavoriteService";
import type { NewFavorite } from "../../src/favorites/domain/Favorite";
import { SqliteFavoriteRepository } from "../../src/favorites/infrastructure/SqliteFavoriteRepository";
import { FixedDepositSimulationService } from "../../src/simulation/application/FixedDepositSimulationService";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function databaseFile(): string {
  const directory = mkdtempSync(join(tmpdir(), "yupay-numeric-favorites-"));
  directories.push(directory);
  return join(directory, "users.sqlite");
}

function createNumericUsers(file: string): void {
  const database = new DatabaseSync(file);
  database.exec("CREATE TABLE users (id INTEGER PRIMARY KEY); INSERT INTO users DEFAULT VALUES;");
  database.close();
}

const pending: NewFavorite = {
  userId: 1,
  fingerprint: "numeric-contract",
  parameters: { instrument: "AHORROS", accountId: "AH-001", days: 365 },
  snapshot: { accountId: "AH-001" },
  createdAt: "2026-11-06T00:00:00.000Z",
};
const products = { findFixedDepositsByDepartment: async () => [] };
const simulation = new FixedDepositSimulationService(products);
const accounts = { obtenerTodas: () => [] };
const savings = { instrument: "AHORROS", accountId: "AH-001", days: 365 };

describe("US28, contrato de identificadores numéricos", () => {
  it("SQLite genera la clave y la lectura entrega números JSON seguros, preservando códigos de negocio", () => {
    const file = databaseFile();
    createNumericUsers(file);
    const repository = new SqliteFavoriteRepository(file);
    try {
      const first = repository.save(pending);
      const second = repository.save({ ...pending, fingerprint: "other-parameters", parameters: { ...pending.parameters, days: 90 } });
      expect(first.favorite.id).toBe(1);
      expect(second.favorite.id).toBe(2);
      expect(first.favorite.userId).toBe(1);
      expect(first.favorite.parameters).toEqual(pending.parameters);
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    } finally { repository.close(); }
  });

  it.each(["1", "7c3b63b7-ae88-4ff5-881f-9adc8234bea1", 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, 1n])(
    "rechaza una identidad incompatible del resolvedor y del servicio %s",
    async (id) => {
      const file = databaseFile();
      createNumericUsers(file);
      const repository = new SqliteFavoriteRepository(file);
      const service = new FavoriteService(repository, accounts, simulation);
      const identity = { id: id as number, plan: "PRO" as const };
      let server: Server | undefined;
      try {
        await expect(service.save(identity, savings)).rejects.toMatchObject({ status: 401, code: "AUTHENTICATION_REQUIRED" });
        server = createApp(products, { favoriteService: service, resolveUser: async () => identity }).listen(0);
        await once(server, "listening");
        const response = await fetch(`http://localhost:${(server.address() as AddressInfo).port}/api/favorites`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(savings),
        });
        expect(response.status).toBe(401);
      } finally {
        if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
        repository.close();
      }
    },
  );

  it("valida también el propietario en la frontera directa del repositorio", () => {
    const repository = new SqliteFavoriteRepository(":memory:");
    try {
      expect(() => repository.save({ ...pending, userId: "1" as unknown as number })).toThrow(expect.objectContaining({ status: 401 }));
    } finally { repository.close(); }
  });

  it.each([false, true])("detecta el esquema UUID sin alterar los datos ni crear tablas, favoritos previos=%s", (withFavorites) => {
    const file = databaseFile();
    const legacy = new DatabaseSync(file);
    legacy.exec("CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('legacy-user-uuid');");
    if (withFavorites) legacy.exec(`
      CREATE TABLE favorite_simulations (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        fingerprint TEXT NOT NULL, instrument TEXT NOT NULL,
        parameters_json TEXT NOT NULL, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE(user_id, fingerprint)
      );
      INSERT INTO favorite_simulations VALUES ('legacy-favorite-uuid', 'legacy-user-uuid', 'old', 'AHORROS', '{}', '{}', '2026-01-01');
    `);
    legacy.close();
    const before = createHash("sha256").update(readFileSync(file)).digest("hex");
    const repository = new SqliteFavoriteRepository(file);
    try {
      expect(() => repository.save(pending)).toThrow(expect.objectContaining({ status: 503, code: "NUMERIC_ID_MIGRATION_REQUIRED" }));
    } finally { repository.close(); }
    const after = createHash("sha256").update(readFileSync(file)).digest("hex");
    expect(after).toBe(before);
    const inspect = new DatabaseSync(file, { readOnly: true });
    try {
      expect(inspect.prepare("SELECT id FROM users").get()?.id).toBe("legacy-user-uuid");
      expect(Boolean(inspect.prepare("SELECT 1 FROM sqlite_master WHERE name = 'favorite_simulations'").get())).toBe(withFavorites);
    } finally { inspect.close(); }
  });

  it("rechaza una tabla de favoritos numérica sin la relación o unicidad requeridas", () => {
    const file = databaseFile();
    createNumericUsers(file);
    const database = new DatabaseSync(file);
    database.exec("CREATE TABLE favorite_simulations (id INTEGER PRIMARY KEY, user_id INTEGER)");
    database.close();
    const repository = new SqliteFavoriteRepository(file);
    try {
      expect(() => repository.save(pending)).toThrow(expect.objectContaining({ code: "NUMERIC_ID_MIGRATION_REQUIRED" }));
    } finally { repository.close(); }
  });

  it.each([
    ["users", "INTEGER PRIMARY KEY DESC", ""],
    ["users", "INTEGER PRIMARY KEY", " WITHOUT ROWID"],
    ["favorite_simulations", "INTEGER PRIMARY KEY DESC", ""],
    ["favorite_simulations", "INTEGER PRIMARY KEY", " WITHOUT ROWID"],
  ])("rechaza una clave que no es alias rowid en %s, %s%s", (table, primaryKey, suffix) => {
    const file = databaseFile();
    const database = new DatabaseSync(file);
    database.exec(`CREATE TABLE users (id ${table === "users" ? primaryKey : "INTEGER PRIMARY KEY"})${table === "users" ? suffix : ""};`);
    if (table === "favorite_simulations") database.exec(`
      CREATE TABLE favorite_simulations (
        id ${primaryKey}, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        fingerprint TEXT NOT NULL, instrument TEXT NOT NULL,
        parameters_json TEXT NOT NULL, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE(user_id, fingerprint)
      )${suffix};
    `);
    database.close();
    const before = createHash("sha256").update(readFileSync(file)).digest("hex");
    const repository = new SqliteFavoriteRepository(file);
    try {
      expect(() => repository.save(pending)).toThrow(expect.objectContaining({ code: "NUMERIC_ID_MIGRATION_REQUIRED" }));
    } finally { repository.close(); }
    expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(before);
  });

  it("detecta un INTEGER de 64 bits fuera del rango seguro al leerlo sin redondearlo", () => {
    const file = databaseFile();
    createNumericUsers(file);
    const repository = new SqliteFavoriteRepository(file);
    const database = new DatabaseSync(file);
    try {
      database.exec("PRAGMA ignore_check_constraints = ON;");
      database.prepare(`INSERT INTO favorite_simulations
        (id, user_id, fingerprint, instrument, parameters_json, snapshot_json, created_at)
        VALUES (?, 1, ?, 'AHORROS', '{}', '{}', '2026-11-06')`).run(BigInt(Number.MAX_SAFE_INTEGER) + 1n, pending.fingerprint);
      expect(() => repository.save(pending)).toThrow(expect.objectContaining({ status: 503, code: "ENTITY_ID_OUT_OF_RANGE" }));
      expect(database.prepare("SELECT COUNT(*) AS count FROM favorite_simulations").get()?.count).toBe(1);
    } finally { database.close(); repository.close(); }
  });

  it("admite MAX_SAFE_INTEGER exactamente y revierte la siguiente inserción sin producir JSON bigint", () => {
    const file = databaseFile();
    createNumericUsers(file);
    const repository = new SqliteFavoriteRepository(file);
    const database = new DatabaseSync(file);
    try {
      database.prepare(`INSERT INTO favorite_simulations
        (id, user_id, fingerprint, instrument, parameters_json, snapshot_json, created_at)
        VALUES (?, 1, ?, 'AHORROS', '{}', '{}', '2026-11-06')`).run(BigInt(Number.MAX_SAFE_INTEGER), pending.fingerprint);
      const saved = repository.save(pending);
      expect(saved.favorite.id).toBe(Number.MAX_SAFE_INTEGER);
      expect(JSON.parse(JSON.stringify(saved)).favorite.id).toBe(Number.MAX_SAFE_INTEGER);
      expect(() => repository.save({ ...pending, fingerprint: "next-id" })).toThrow(expect.objectContaining({ status: 503, code: "ENTITY_ID_OUT_OF_RANGE" }));
      expect(database.prepare("SELECT COUNT(*) AS count FROM favorite_simulations").get()?.count).toBe(1);
    } finally { database.close(); repository.close(); }
  });

  it("la tabla nueva mantiene tipos INTEGER, unicidad y una clave foránea que rechaza huérfanos", () => {
    const file = databaseFile();
    createNumericUsers(file);
    const repository = new SqliteFavoriteRepository(file);
    const database = new DatabaseSync(file);
    try {
      database.exec("PRAGMA foreign_keys = ON;");
      const columns = database.prepare("PRAGMA table_info(favorite_simulations)").all();
      expect(columns).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "id", type: "INTEGER", pk: 1 }),
        expect.objectContaining({ name: "user_id", type: "INTEGER" }),
      ]));
      expect(() => database.prepare(`INSERT INTO favorite_simulations
        (user_id, fingerprint, instrument, parameters_json, snapshot_json, created_at)
        VALUES (999, 'orphan', 'AHORROS', '{}', '{}', '2026-11-06')`).run()).toThrow(/FOREIGN KEY/);
      expect(repository.save(pending).created).toBe(true);
      expect(repository.save(pending).created).toBe(false);
      expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      expect(database.prepare("PRAGMA integrity_check").get()?.integrity_check).toBe("ok");
    } finally { database.close(); repository.close(); }
  });
});
