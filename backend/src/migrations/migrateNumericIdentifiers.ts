import { migrateNumericIdentifiers, NumericMigrationError } from "./NumericIdentifierMigration";

export async function runNumericMigration(arguments_: string[]): Promise<void> {
  const keys = new Set(["--source", "--output", "--backup", "--apply-copy"]);
  const options = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index++) {
    const key = arguments_[index];
    if (!keys.has(key) || options.has(key)) throw new Error("Argumentos inválidos o repetidos.");
    if (key === "--apply-copy") options.set(key, "true");
    else {
      const value = arguments_[++index];
      if (!value || value.startsWith("--")) throw new Error("Falta la ruta de un argumento.");
      options.set(key, value);
    }
  }
  if (options.size !== 4) throw new Error("Uso: --source <origen> --output <salida-nueva> --backup <respaldo-nuevo> --apply-copy");
  const result = await migrateNumericIdentifiers({
    source: options.get("--source")!, output: options.get("--output")!,
    backup: options.get("--backup")!, applyCopy: true,
  });
  console.log(JSON.stringify({ status: "COPY_MIGRATED", ...result }));
}

if (require.main === module) {
  runNumericMigration(process.argv.slice(2)).catch((error: unknown) => {
    const reason = error instanceof NumericMigrationError ? ` Motivo: ${error.message}` : "";
    console.error(`No se completó la copia migrada. La fuente se conserva. Si se crearon destinos, consérvalos para revisión y utiliza rutas nuevas al reintentar. Revisa el esquema y las rutas con el procedimiento documentado.${reason}`);
    process.exitCode = 1;
  });
}
