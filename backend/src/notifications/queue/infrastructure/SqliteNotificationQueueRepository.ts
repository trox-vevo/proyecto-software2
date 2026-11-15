import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { NotificationFrequency } from "../../NotificationPreferences";
import type { NotificationQueueRepository, QueueInput, QueuedNotification } from "../domain/QueueContracts";
import { frequency, isoDate, userId, validateInput } from "../domain/QueueValidation";

interface QueueRow {
  id: number; event_json: string; user_id: number; frequency: NotificationFrequency;
  idempotency_key: string; status: QueuedNotification["status"]; available_at: string;
  created_at: string; claim_token: string | null; lease_until: string | null; last_error: string | null;
}

/** Recibe una conexión del composition root; su propietario es quien la cierra. */
export class SqliteNotificationQueueRepository implements NotificationQueueRepository {
  constructor(private readonly database: DatabaseSync) {
    database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000");
    database.exec(`CREATE TABLE IF NOT EXISTS market_notification_queue (
      id INTEGER PRIMARY KEY CHECK(id BETWEEN 1 AND 9007199254740991),
      event_id TEXT NOT NULL, event_json TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) CHECK(user_id BETWEEN 1 AND 9007199254740991),
      frequency TEXT NOT NULL CHECK(frequency IN ('INMEDIATA','RESUMEN_DIARIO')),
      idempotency_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('PENDING','CLAIMED','SENT','FAILED')),
      available_at TEXT NOT NULL, created_at TEXT NOT NULL,
      claim_token TEXT, lease_until TEXT, last_error TEXT,
      UNIQUE(event_id, user_id)
    ); CREATE INDEX IF NOT EXISTS market_notification_ready
      ON market_notification_queue(frequency, status, available_at, id)`);
  }

  private transaction<T>(work: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.database.exec("COMMIT");
      return result;
    } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }

  enqueueBatch(items: readonly QueueInput[], now: string): number {
    isoDate(now);
    const inputs = items.map(validateInput);
    return this.transaction(() => {
      let inserted = 0;
      for (const item of inputs) {
        const payload = JSON.stringify(item.event);
        const existing = this.database.prepare("SELECT event_json FROM market_notification_queue WHERE event_id = ? LIMIT 1")
          .get(item.event.eventId);
        if (existing && existing.event_json !== payload) throw new Error("El identificador de evento ya tiene otro contenido.");
        const result = this.database.prepare(`INSERT INTO market_notification_queue
          (event_id,event_json,user_id,frequency,idempotency_key,status,available_at,created_at)
          VALUES (?,?,?,?,?,'PENDING',?,?) ON CONFLICT(event_id,user_id) DO NOTHING`)
          .run(item.event.eventId, payload, item.userId, item.frequency,
            JSON.stringify([item.event.eventId, item.userId]), item.availableAt, now);
        inserted += Number(result.changes);
      }
      return inserted;
    });
  }

  private decode(row: QueueRow): QueuedNotification {
    return { id: userId(row.id), event: JSON.parse(row.event_json), userId: userId(row.user_id),
      frequency: row.frequency, idempotencyKey: row.idempotency_key, status: row.status,
      availableAt: row.available_at, createdAt: row.created_at, claimToken: row.claim_token,
      leaseUntil: row.lease_until, lastError: row.last_error };
  }

  findById(id: number): QueuedNotification | null {
    userId(id);
    const row = this.database.prepare("SELECT * FROM market_notification_queue WHERE id = ?").get(id);
    return row ? this.decode(row as unknown as QueueRow) : null;
  }

  private ready(kind: NotificationFrequency, limit: number, now: string): QueueRow[] {
    frequency(kind); isoDate(now);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new RangeError("Límite entre 1 y 1000 requerido.");
    return this.database.prepare(`SELECT * FROM market_notification_queue WHERE frequency = ? AND available_at <= ?
      AND (status = 'PENDING' OR (status = 'CLAIMED' AND lease_until <= ?))
      ORDER BY available_at, id LIMIT ?`).all(kind, now, now, limit) as unknown as QueueRow[];
  }

  pending(kind: NotificationFrequency, limit: number, now: string): QueuedNotification[] {
    return this.ready(kind, limit, now).map((row) => this.decode(row));
  }

  claimPending(kind: NotificationFrequency, limit: number, now: string, leaseMs: number): QueuedNotification[] {
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 1 || leaseMs > 86_400_000) throw new RangeError("Reserva entre 1 ms y 24 h requerida.");
    isoDate(now);
    const until = new Date(Date.parse(now) + leaseMs).toISOString();
    return this.transaction(() => this.ready(kind, limit, now).map((row) => {
      const token = randomUUID();
      this.database.prepare("UPDATE market_notification_queue SET status='CLAIMED', claim_token=?, lease_until=? WHERE id=?")
        .run(token, until, row.id);
      return this.decode({ ...row, status: "CLAIMED", claim_token: token, lease_until: until });
    }));
  }

  markDelivered(id: number, token: string, now: string): boolean {
    return this.finish(id, token, now, "SENT", null);
  }
  markFailed(id: number, token: string, error: string, now: string): boolean {
    if (typeof error !== "string" || !error.trim() || error.length > 2000) throw new TypeError("Error de entrega inválido.");
    return this.finish(id, token, now, "FAILED", error);
  }
  private finish(id: number, token: string, now: string, status: "SENT" | "FAILED", error: string | null): boolean {
    userId(id); isoDate(now);
    if (typeof token !== "string" || !token) throw new TypeError("Token de reserva requerido.");
    return Number(this.database.prepare(`UPDATE market_notification_queue SET status=?, last_error=?, claim_token=NULL, lease_until=NULL
      WHERE id=? AND status='CLAIMED' AND claim_token=? AND lease_until > ?`).run(status, error, id, token, now).changes) === 1;
  }
}
