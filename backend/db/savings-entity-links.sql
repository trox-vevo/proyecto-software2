-- US21: relación adicional; ninguna columna o fila de las tablas originales se modifica.
CREATE TABLE IF NOT EXISTS savings_account_entities (
  account_id TEXT NOT NULL PRIMARY KEY REFERENCES savings_accounts(id),
  entity_id INTEGER NOT NULL REFERENCES financial_entities(id)
);
