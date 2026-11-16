-- Yupay Finance: catálogo financiero (datos de solo lectura para la aplicación).
-- Las tablas de usuarios, pagos, suscripciones y favoritos las crean sus propios repositorios.
-- Montos, tasas y ratios se guardan como TEXT para no perder precisión (se leen con decimal.js).
-- Los booleanos son INTEGER 0/1 (SQLite no tiene BOOLEAN).

CREATE TABLE IF NOT EXISTS financial_entities (
  id INTEGER PRIMARY KEY CHECK (id > 0),
  name TEXT NOT NULL UNIQUE,
  has_physical_branches INTEGER NOT NULL CHECK (has_physical_branches IN (0, 1)),
  has_atms INTEGER NOT NULL CHECK (has_atms IN (0, 1)),
  has_digital_banking INTEGER NOT NULL CHECK (has_digital_banking IN (0, 1)),
  has_mobile_app INTEGER NOT NULL CHECK (has_mobile_app IN (0, 1)),
  -- US21: evidencia de cobertura FSD en JSON; NULL = no verificada
  fsd_coverage TEXT
);

-- US10: depósitos a plazo fijo. Invariante: el id del producto es el id de su entidad (US25/US26 lo usan).
CREATE TABLE IF NOT EXISTS fixed_deposit_products (
  id INTEGER PRIMARY KEY CHECK (id > 0),
  entity_id INTEGER NOT NULL REFERENCES financial_entities(id),
  department TEXT NOT NULL,
  tea TEXT NOT NULL,
  minimum_amount TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fixed_deposit_products_department ON fixed_deposit_products(department);

-- US09/US11: cuentas de ahorro de demostración (mismo contenido que tenía data/cuentas.json)
CREATE TABLE IF NOT EXISTS savings_accounts (
  id TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  balance TEXT NOT NULL,
  annual_rate TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  monthly_maintenance_fee TEXT NOT NULL,
  has_physical_branches INTEGER NOT NULL CHECK (has_physical_branches IN (0, 1)),
  has_atms INTEGER NOT NULL CHECK (has_atms IN (0, 1)),
  has_digital_banking INTEGER NOT NULL CHECK (has_digital_banking IN (0, 1)),
  has_mobile_app INTEGER NOT NULL CHECK (has_mobile_app IN (0, 1)),
  fsd_coverage TEXT
);

-- US21: asociación sin modificar las columnas ni los registros originales de ahorro.
CREATE TABLE IF NOT EXISTS savings_account_entities (
  account_id TEXT NOT NULL PRIMARY KEY REFERENCES savings_accounts(id),
  entity_id INTEGER NOT NULL REFERENCES financial_entities(id)
);

-- US25: indicadores de riesgo de la SBS por entidad
CREATE TABLE IF NOT EXISTS sbs_risk_profiles (
  entity_id INTEGER PRIMARY KEY REFERENCES financial_entities(id),
  risk_rating TEXT NOT NULL,
  capital_adequacy_ratio TEXT NOT NULL,
  delinquency_rate TEXT NOT NULL,
  liquidity_ratio TEXT NOT NULL,
  report_date TEXT NOT NULL,
  source_url TEXT NOT NULL
);

-- US26: informe del economista por entidad (strengths y risks son arreglos JSON)
CREATE TABLE IF NOT EXISTS economist_reports (
  entity_id INTEGER PRIMARY KEY REFERENCES financial_entities(id),
  summary TEXT NOT NULL,
  strengths TEXT NOT NULL,
  risks TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  author TEXT NOT NULL,
  published_at TEXT NOT NULL
);
