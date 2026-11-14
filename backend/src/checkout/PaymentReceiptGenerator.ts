import PDFDocument from "pdfkit";
import type { CheckoutPayment } from "./CheckoutPaymentHistory";

export class PaymentReceiptGenerator {
  generate(payment: CheckoutPayment): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({
        size: "A4",
        margin: 50,
        info: { Title: "Constancia de operación - Yupay Finance" },
      });
      const chunks: Buffer[] = [];
      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);

      document.font("Helvetica-Bold").fontSize(22).fillColor("#1F4E5A")
        .text("Yupay Finance");
      document.moveDown();
      document.font("Helvetica-Bold").fontSize(16).fillColor("black")
        .text(payment.outcome === "APPROVED" ? "Constancia de operación aprobada" : "Constancia de operación rechazada");
      document.moveDown();
      document.font("Helvetica").fontSize(11)
        .text(`Referencia de operación (DEMO): ${payment.reference}`)
        .text(`Fecha: ${new Date(payment.occurredAt).toLocaleString("es-PE", { timeZone: "UTC" })}`)
        .text("Concepto: Suscripción al Plan Pro")
        .text("Monto: No disponible. Esta operación es una simulación sin cobro real.")
        .text(`Estado: ${payment.outcome === "APPROVED" ? "Aprobada (simulación)" : "Rechazada (simulación)"}`);
      document.moveDown(2);
      document.font("Helvetica-Bold").fillColor("#6B7280")
        .text("Documento de demostración; no es un comprobante tributario ni acredita un cobro real.", {
          width: 495,
        });
      document.end();
    });
  }
}
