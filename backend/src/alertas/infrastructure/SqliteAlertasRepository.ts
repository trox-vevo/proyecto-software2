import type { DatabaseSync } from "node:sqlite";
import type { AlertEvent } from "../../notifications/queue/domain/QueueContracts";
import type { FilaAlerta, RepositorioAlertas } from "../domain/Alertas";

interface FilaCola {
  id: number;
  event_json: string;
  created_at: string;
  leida: number;
}

interface FilaEntidad {
  name: string;
  fsd_coverage: string | null;
  risk_rating: string | null;
}

const MAX_ALERTAS = 200;

/**
 * US36 / TS-110. Lee market_notification_queue (de US39) sin modificarla: el estado "leída" va en su
 * propia tabla, porque los estados de la cola (SENT, FAILED...) significan "entregada", no "leída".
 * Debe crearse después de SqliteNotificationQueueRepository, que es quien crea la tabla de la cola.
 */
export class SqliteAlertasRepository implements RepositorioAlertas {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`CREATE TABLE IF NOT EXISTS alert_reads (
      notification_id INTEGER PRIMARY KEY REFERENCES market_notification_queue(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      read_at TEXT NOT NULL
    )`);
  }

  listarPorUsuario(userId: number): FilaAlerta[] {
    const filas = this.database
      .prepare(
        `SELECT q.id, q.event_json, q.created_at, (r.notification_id IS NOT NULL) AS leida
         FROM market_notification_queue q
         LEFT JOIN alert_reads r ON r.notification_id = q.id
         WHERE q.user_id = ? AND q.frequency = 'INMEDIATA'
         ORDER BY q.id DESC LIMIT ?`,
      )
      .all(userId, MAX_ALERTAS) as unknown as FilaCola[];

    const buscarEntidad = this.database.prepare(
      `SELECT e.name, e.fsd_coverage, s.risk_rating
       FROM financial_entities e
       LEFT JOIN sbs_risk_profiles s ON s.entity_id = e.id
       WHERE e.id = ?`,
    );

    return filas.map((fila) => {
      const event = JSON.parse(fila.event_json) as AlertEvent;
      const entidad = buscarEntidad.get(event.entityId) as unknown as FilaEntidad | undefined;
      return {
        id: fila.id,
        event,
        creadaEn: fila.created_at,
        leida: Number(fila.leida) === 1,
        entidad: entidad?.name ?? null,
        fsdCoverage: entidad?.fsd_coverage ?? null,
        calificacionActual: entidad?.risk_rating ?? null,
      };
    });
  }

  marcarLeida(userId: number, id: number, ahora: string): boolean {
    const existe = this.database
      .prepare("SELECT 1 AS ok FROM market_notification_queue WHERE id = ? AND user_id = ? AND frequency = 'INMEDIATA'")
      .get(id, userId);
    if (!existe) return false;
    // INSERT OR IGNORE: marcar de nuevo una alerta ya leída conserva la fecha original.
    this.database
      .prepare("INSERT OR IGNORE INTO alert_reads (notification_id, user_id, read_at) VALUES (?, ?, ?)")
      .run(id, userId, ahora);
    return true;
  }
}
