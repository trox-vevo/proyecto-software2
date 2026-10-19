import { Router } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { agregarCoberturaFSD } from "./IntegradorCoberturaFSD";

interface CuentaJson {
  id: string;
}

export const fsdRouter = Router();

fsdRouter.get("/coberturas", (_req, res) => {
  try {
    const archivo = path.join(process.cwd(), "data", "cuentas.json");
    const contenido: unknown = JSON.parse(readFileSync(archivo, "utf-8"));

    if (!Array.isArray(contenido)) {
      throw new Error("El archivo de cuentas no contiene una lista válida");
    }

    const cuentas = contenido as CuentaJson[];

    const filas = cuentas.map((cuenta) => ({
      cuentaId: cuenta.id
    }));

    const resultados = agregarCoberturaFSD(filas);

    res.json({ resultados });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "No se pudo consultar la información FSD"
    });
  }
});
