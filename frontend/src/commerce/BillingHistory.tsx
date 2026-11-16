import { useEffect, useState } from "react";
import { fetchWithAuth } from "../auth/session";
import { API_URL } from "./types";
import "./commerce.css";

interface BillingTransaction {
  reference: string;
  outcome: "APPROVED" | "DECLINED";
  occurredAt: string;
  planId: "PRO";
  amount: string | null; // US31: texto con 2 decimales; null en pagos anteriores al precio
  currency: "PEN";
  receiptStatus: "AVAILABLE" | "NOT_APPLICABLE";
}

function isBillingTransaction(value: unknown): value is BillingTransaction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const transaction = value as Record<string, unknown>;
  return typeof transaction.reference === "string" &&
    /^DEMO-[a-f0-9]{24}$/i.test(transaction.reference) &&
    (transaction.outcome === "APPROVED" || transaction.outcome === "DECLINED") &&
    typeof transaction.occurredAt === "string" &&
    Number.isFinite(Date.parse(transaction.occurredAt)) &&
    transaction.planId === "PRO" &&
    (transaction.amount === null || (typeof transaction.amount === "string" && /^\d+\.\d{2}$/.test(transaction.amount))) &&
    transaction.currency === "PEN" &&
    (transaction.receiptStatus === "AVAILABLE" || transaction.receiptStatus === "NOT_APPLICABLE");
}

function isBillingHistory(value: unknown): value is { transactions: BillingTransaction[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const history = value as Record<string, unknown>;
  return Array.isArray(history.transactions) && history.transactions.every(isBillingTransaction);
}

export function BillingHistory({ onReturn }: { onReturn?: () => void }) {
  const [transactions, setTransactions] = useState<BillingTransaction[] | null>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchWithAuth(`${API_URL}/api/checkout/history`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) throw new Error("Inicia sesión para consultar tu historial de facturación.");
        if (!response.ok) throw new Error("No se pudo cargar el historial de facturación. Inténtalo nuevamente.");
        const data: unknown = await response.json();
        if (!isBillingHistory(data)) throw new Error("El servidor devolvió un historial de facturación inválido.");
        return data.transactions;
      })
      .then((data) => setTransactions(data))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial de facturación.");
        }
      });
    return () => controller.abort();
  }, []);

  async function downloadReceipt(reference: string): Promise<void> {
    if (downloading) return;
    setDownloading(reference);
    setDownloadError("");
    try {
      const response = await fetchWithAuth(
        `${API_URL}/api/checkout/history/${encodeURIComponent(reference)}/receipt`,
      );
      if (!response.ok) {
        throw new Error(response.status === 404
          ? "El comprobante ya no está disponible."
          : "No se pudo descargar el comprobante. Inténtalo nuevamente.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `Comprobante-${reference}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause: unknown) {
      setDownloadError(cause instanceof Error ? cause.message : "No se pudo descargar el comprobante.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <section className="historial-facturacion" aria-labelledby="titulo-historial-facturacion">
      <div className="historial-facturacion-encabezado">
        <div>
          <h1 id="titulo-historial-facturacion">Historial de facturación</h1>
          <p>Consulta tus operaciones del Plan Pro y descarga sus comprobantes.</p>
        </div>
        {onReturn && <button type="button" onClick={onReturn}>Volver a mi cuenta</button>}
      </div>
      <p className="historial-facturacion-aviso">
        El checkout es una demostración académica: no se realizan cobros reales.
      </p>
      {transactions === null && !error && <p role="status">Cargando historial…</p>}
      {error && <p role="alert">{error}</p>}
      {downloadError && <p role="alert">{downloadError}</p>}
      {transactions?.length === 0 && <p>No tienes transacciones de facturación todavía.</p>}
      {transactions && transactions.length > 0 && (
        <div className="historial-facturacion-tabla">
          <table>
            <caption>Operaciones de facturación, de la más reciente a la más antigua</caption>
            <thead>
              <tr>
                <th scope="col">Fecha de cobro</th>
                <th scope="col">Concepto</th>
                <th scope="col">Monto (S/.)</th>
                <th scope="col">Estado de pago</th>
                <th scope="col">Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.reference}>
                  <td><time dateTime={transaction.occurredAt}>
                    {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" })
                      .format(new Date(transaction.occurredAt))}
                  </time></td>
                  <td>Suscripción Plan Pro</td>
                  <td>{transaction.amount ?? "No disponible"}</td>
                  <td>{transaction.outcome === "APPROVED" ? "Aprobado" : "Rechazado"}</td>
                  <td>
                    {transaction.receiptStatus === "AVAILABLE" ? (
                      <button
                        type="button"
                        disabled={downloading !== null}
                        onClick={() => void downloadReceipt(transaction.reference)}
                      >
                        {downloading === transaction.reference ? "Descargando…" : "Descargar recibo"}
                      </button>
                    ) : "No disponible"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
