import { existsSync } from "node:fs";
import { join } from "node:path";
import type Decimal from "decimal.js";
import PDFDocument from "pdfkit";
import { PaymentMode } from "../../simulation/domain/PaymentMode";
import type { SimulationResult } from "../../simulation/domain/SimulationResult";
import type { PdfGenerator } from "../application/PdfGenerator";
import type { SolvencyReport } from "../domain/SolvencyReport";

const BRAND = "#1F4E5A";
const MUTED = "#6B7280";
const LEFT = 50;
const RIGHT = 545; // A4 (595 pt) menos el margen de 50
// Si el equipo agrega un logo en PNG, se dibuja en lugar del nombre (pdfkit no acepta SVG).
const LOGO = join(process.cwd(), "assets", "logo.png");

interface Column { title: string; x: number; width: number; align: "left" | "right" }

const money = (value: Decimal) => `S/ ${value.toFixed(2)}`;
const MODE_LABEL: Record<PaymentMode, string> = {
  [PaymentMode.AT_MATURITY]: "Al final del plazo",
  [PaymentMode.MONTHLY]: "Mensual",
};

// US30 (TS-93): plantilla formal del Reporte de Solvencia.
// Un documento nuevo por llamada: las descargas simultáneas no comparten estado (TS-95).
export class PdfKitGenerator implements PdfGenerator {
  generate(report: SolvencyReport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: "Reporte de Solvencia - Yupay Finance" } });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      this.drawHeader(doc, report);
      this.drawComparisonTable(doc, report);
      this.drawRiskSection(doc, report.results);
      this.drawFooter(doc);
      doc.end();
    });
  }

  private drawHeader(doc: PDFKit.PDFDocument, report: SolvencyReport): void {
    if (existsSync(LOGO)) doc.image(LOGO, LEFT, 40, { height: 40 }).moveDown(3);
    else doc.font("Helvetica-Bold").fontSize(22).fillColor(BRAND).text("Yupay Finance", LEFT);
    doc.font("Helvetica-Bold").fontSize(16).fillColor("black").text("Reporte de Solvencia");
    doc.font("Helvetica").fontSize(11).fillColor(MUTED).text("Depósito a plazo fijo")
      .text(`Generado el ${report.generatedAt.toLocaleString("es-PE")}`);
    this.separator(doc, BRAND);

    doc.fillColor("black").fontSize(11)
      .text(`Monto: ${money(report.amount)}`)
      .text(`Plazo: ${report.termDays} días`)
      .text(`Departamento: ${report.department}`)
      .text(`Modalidad de pago de intereses: ${MODE_LABEL[report.paymentMode]}`);
    doc.moveDown();
  }

  // Cuadro comparativo de tasas, en el orden del servicio (mayor ganancia primero).
  private drawComparisonTable(doc: PDFKit.PDFDocument, report: SolvencyReport): void {
    this.sectionTitle(doc, "Cuadro comparativo de tasas");
    if (!report.results.length) {
      doc.font("Helvetica").fontSize(11).fillColor("black").text("No se encontraron opciones para estos parámetros.", LEFT);
      doc.moveDown();
      return;
    }
    const monthly = report.paymentMode === PaymentMode.MONTHLY;
    const columns: Column[] = [
      { title: "Entidad", x: LEFT, width: monthly ? 185 : 275, align: "left" },
      { title: "TEA", x: monthly ? 240 : 330, width: 70, align: "right" },
      { title: "Interés total", x: monthly ? 315 : 405, width: 105, align: "right" },
      ...(monthly ? [{ title: "Interés mensual", x: 425, width: 120, align: "right" as const }] : []),
    ];
    this.row(doc, columns, columns.map((column) => column.title), true);
    for (const result of report.results) {
      this.row(doc, columns, [
        result.entityName,
        `${result.tea.times(100).toFixed(2)} %`,
        money(result.totalInterest),
        ...(monthly ? [result.monthlyInterest ? money(result.monthlyInterest) : "-"] : []),
      ]);
    }
    doc.moveDown();
  }

  // "Gráficos de riesgo": la calificación de cada entidad (la aporta la US25).
  private drawRiskSection(doc: PDFKit.PDFDocument, results: SimulationResult[]): void {
    this.sectionTitle(doc, "Calificación de riesgo");
    if (!results.length) {
      doc.font("Helvetica").fontSize(11).fillColor("black").text("Sin entidades para calificar.", LEFT);
      doc.moveDown();
      return;
    }
    const columns: Column[] = [
      { title: "Entidad", x: LEFT, width: 300, align: "left" },
      { title: "Calificación", x: 355, width: 190, align: "right" },
    ];
    this.row(doc, columns, columns.map((column) => column.title), true);
    for (const result of results) {
      this.row(doc, columns, [result.entityName, result.riskRating ?? "Calificación no disponible"], false,
        result.riskRating ? "black" : MUTED);
    }
    doc.moveDown();
  }

  private drawFooter(doc: PDFKit.PDFDocument): void {
    this.separator(doc, MUTED);
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text(
      "Simulación referencial: las tasas y entidades son datos de demostración y no constituyen ofertas vigentes.",
      LEFT, doc.y, { width: RIGHT - LEFT },
    );
  }

  private sectionTitle(doc: PDFKit.PDFDocument, title: string): void {
    doc.font("Helvetica-Bold").fontSize(13).fillColor(BRAND).text(title, LEFT);
    doc.moveDown(0.4);
  }

  private separator(doc: PDFKit.PDFDocument, color: string): void {
    doc.moveDown(0.5).moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).strokeColor(color).stroke().moveDown(0.5);
  }

  private row(doc: PDFKit.PDFDocument, columns: Column[], cells: string[], header = false, color = "black"): void {
    // Salto de página manual: las celdas se dibujan en posiciones fijas.
    if (doc.y > doc.page.height - doc.page.margins.bottom - 40) doc.addPage();
    const y = doc.y;
    doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor(header ? "black" : color);
    const heights = cells.map((cell, index) => {
      const { x, width, align } = columns[index];
      doc.text(cell, x, y, { width, align });
      return doc.y - y;
    });
    doc.y = y + Math.max(...heights) + 4;
    if (header) doc.moveTo(LEFT, doc.y - 2).lineTo(RIGHT, doc.y - 2).strokeColor(MUTED).stroke();
    doc.x = LEFT;
  }
}
