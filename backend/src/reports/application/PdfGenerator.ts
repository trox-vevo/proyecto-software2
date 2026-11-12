import type { SolvencyReport } from "../domain/SolvencyReport";

// US30: puerto. Cambiar de librería de PDF solo requiere otra implementación.
export interface PdfGenerator {
  generate(report: SolvencyReport): Promise<Buffer>;
}
