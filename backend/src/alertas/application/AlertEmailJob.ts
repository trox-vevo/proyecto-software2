import type { ServicioEnvioCorreo } from "./ServicioEnvioCorreo";

/** Logger mínimo; console ya lo cumple. */
export interface AlertEmailJobLogger {
  error(message: string, error?: unknown): void;
}

// Tope por ciclo: si la cola nunca se vaciara (por un error al confirmar los mensajes),
// el ciclo termina igual en lugar de quedarse dando vueltas.
const MAX_LOTES_POR_CICLO = 10;

/**
 * US40: cada cierto tiempo envía los correos pendientes de la cola. Sigue el mismo patrón que
 * startSubscriptionMaintenanceJob: un ciclo a la vez, uno inmediato al arrancar, y devuelve
 * una función para detenerlo que espera a que termine el ciclo en curso.
 */
export function startAlertEmailJob(
  service: Pick<ServicioEnvioCorreo, "procesarLote">,
  intervalMs = 30_000,
  logger: AlertEmailJobLogger = console,
): () => Promise<void> {
  if (!Number.isSafeInteger(intervalMs) || intervalMs <= 0) {
    throw new RangeError("El intervalo del envío de correos debe ser un entero positivo.");
  }

  let activeRun: Promise<void> | null = null;
  const run = () => {
    if (activeRun) return activeRun;
    activeRun = (async () => {
      try {
        for (let lotes = 0; lotes < MAX_LOTES_POR_CICLO; lotes++) {
          if ((await service.procesarLote()) === 0) break;
        }
      } catch (error) {
        logger.error("Falló el envío de correos de alerta.", error);
      }
    })().finally(() => {
      activeRun = null;
    });
    return activeRun;
  };

  void run();
  const timer = setInterval(() => void run(), intervalMs);
  return async () => {
    clearInterval(timer);
    await activeRun;
  };
}
