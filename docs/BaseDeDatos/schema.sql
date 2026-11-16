-- Yupay Finance: esquema completo de la base de datos (SQLite).
-- Generado automáticamente con: node scripts/export-schema.mjs
-- Los datos de demostración del catálogo están en backend/db/seed.sql.
CREATE TABLE IF NOT EXISTS checkout_payment_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT CHECK(id BETWEEN 1 AND 9007199254740991),
          user_id INTEGER NOT NULL REFERENCES users(id),
          reference TEXT NOT NULL UNIQUE,
          outcome TEXT NOT NULL CHECK(outcome IN ('APPROVED', 'DECLINED')),
          occurred_at TEXT NOT NULL,
          plan_id TEXT NOT NULL CHECK(plan_id = 'PRO'),
          amount REAL,
          currency TEXT NOT NULL CHECK(currency = 'PEN'),
          receipt_status TEXT NOT NULL CHECK(receipt_status IN ('AVAILABLE', 'NOT_APPLICABLE'))
        );

CREATE TABLE IF NOT EXISTS economist_reports (
  entity_id INTEGER PRIMARY KEY REFERENCES financial_entities(id),
  summary TEXT NOT NULL,
  strengths TEXT NOT NULL,
  risks TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  author TEXT NOT NULL,
  published_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favorite_simulations (
        id INTEGER PRIMARY KEY CONSTRAINT favorite_id_safe CHECK (id BETWEEN 1 AND 9007199254740991),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
          CONSTRAINT favorite_user_id_safe CHECK (user_id BETWEEN 1 AND 9007199254740991),
        fingerprint TEXT NOT NULL,
        instrument TEXT NOT NULL CHECK (instrument IN ('AHORROS', 'PLAZO_FIJO')),
        parameters_json TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_id, fingerprint)
      );

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

CREATE TABLE IF NOT EXISTS fixed_deposit_products (
  id INTEGER PRIMARY KEY CHECK (id > 0),
  entity_id INTEGER NOT NULL REFERENCES financial_entities(id),
  department TEXT NOT NULL,
  tea TEXT NOT NULL,
  minimum_amount TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_preferences (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          alert_types TEXT NOT NULL,
          frequency TEXT NOT NULL CHECK(frequency IN ('INMEDIATA', 'RESUMEN_DIARIO'))
        );

CREATE TABLE IF NOT EXISTS password_recovery_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT CHECK(id BETWEEN 1 AND 9007199254740991),
          user_id INTEGER NOT NULL REFERENCES users(id) CHECK(user_id BETWEEN 1 AND 9007199254740991),
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          used INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

CREATE TABLE IF NOT EXISTS plan_change_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT CHECK(id BETWEEN 1 AND 9007199254740991),
          user_id INTEGER NOT NULL REFERENCES users(id) CHECK(user_id BETWEEN 1 AND 9007199254740991),
          from_plan TEXT NOT NULL CHECK(from_plan = 'PRO'),
          to_plan TEXT NOT NULL CHECK(to_plan = 'BASICO'),
          reason TEXT NOT NULL CHECK(reason IN ('PERIOD_EXPIRED', 'RENEWAL_PAYMENT_FAILED')),
          changed_at TEXT NOT NULL,
          plan_expires_at TEXT NOT NULL,
          event_id TEXT UNIQUE
        );

CREATE TABLE IF NOT EXISTS plan_change_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT CHECK(id BETWEEN 1 AND 9007199254740991),
          user_id INTEGER NOT NULL REFERENCES users(id) CHECK(user_id BETWEEN 1 AND 9007199254740991),
          email TEXT NOT NULL,
          plan_expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          sent_at TEXT,
          reason TEXT NOT NULL DEFAULT 'PERIOD_EXPIRED'
            CHECK(reason IN ('PERIOD_EXPIRED', 'RENEWAL_PAYMENT_FAILED')),
          UNIQUE(user_id, plan_expires_at)
        );

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

CREATE TABLE IF NOT EXISTS sbs_risk_profiles (
  entity_id INTEGER PRIMARY KEY REFERENCES financial_entities(id),
  risk_rating TEXT NOT NULL,
  capital_adequacy_ratio TEXT NOT NULL,
  delinquency_rate TEXT NOT NULL,
  liquidity_ratio TEXT NOT NULL,
  report_date TEXT NOT NULL,
  source_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscription_payment_failure_events (
          event_id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) CHECK(user_id BETWEEN 1 AND 9007199254740991),
          period_expires_at TEXT NOT NULL,
          occurred_at TEXT NOT NULL
        );

CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 9007199254740991),
          username TEXT NOT NULL,
          email TEXT NOT NULL COLLATE NOCASE UNIQUE,
          password_hash TEXT NOT NULL,
          plan TEXT NOT NULL DEFAULT 'BASICO',
          created_at TEXT NOT NULL,
          plan_cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK(plan_cancel_at_period_end IN (0, 1))
        , plan_expires_at TEXT);

CREATE INDEX IF NOT EXISTS idx_fixed_deposit_products_department ON fixed_deposit_products(department);

-- US21: relación adicional; ninguna columna o fila de las tablas originales se modifica.
CREATE TABLE IF NOT EXISTS savings_account_entities (
  account_id TEXT NOT NULL PRIMARY KEY REFERENCES savings_accounts(id),
  entity_id INTEGER NOT NULL REFERENCES financial_entities(id)
);
