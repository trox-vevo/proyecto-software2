-- Yupay Finance: nombres reales, tasas/canales/riesgos/informes FICTICIOS de demostración.
-- Solo la participación FSD procede de fuentes oficiales: db/fsd-verificacion-2026-11-15.json.
-- Consulta: 2026-11-15. vigenteHasta = revisión LOCAL hasta 2026-12-15, NO vigencia oficial.
-- COOPAC: NO_VERIFICADO en FSD tradicional; régimen FSDC distinto, sin afirmar desprotección.
-- INSERT OR IGNORE: no modifica filas existentes. Para actualizarlas manualmente, ver docs/CORRECCION_FSD.md.

INSERT OR IGNORE INTO financial_entities (id, name, has_physical_branches, has_atms, has_digital_banking, has_mobile_app, fsd_coverage) VALUES
  (1, 'Banco de Crédito del Perú (BCP)', 1, 1, 1, 1, '{"estado":"CUBIERTO","entidadFinanciera":"Banco de Crédito del Perú (BCP)","fechaVerificacion":"2026-11-15","vigenteHasta":"2026-12-15","fuente":"https://fsd.org.pe/miembros/"}'),
  (2, 'BBVA Perú', 1, 0, 1, 0, '{"estado":"CUBIERTO","entidadFinanciera":"BBVA Perú","fechaVerificacion":"2026-11-15","vigenteHasta":"2026-12-15","fuente":"https://fsd.org.pe/miembros/"}'),
  (3, 'Interbank', 0, 1, 0, 1, '{"estado":"CUBIERTO","entidadFinanciera":"Interbank","fechaVerificacion":"2026-11-15","vigenteHasta":"2026-12-15","fuente":"https://fsd.org.pe/miembros/"}'),
  (4, 'Scotiabank Perú', 0, 0, 0, 0, '{"estado":"CUBIERTO","entidadFinanciera":"Scotiabank Perú","fechaVerificacion":"2026-11-15","vigenteHasta":"2026-12-15","fuente":"https://fsd.org.pe/miembros/"}'),
  (5, 'Cooperativa Abaco', 1, 1, 1, 1, '{"estado":"NO_VERIFICADO","entidadFinanciera":"Cooperativa Abaco","fechaVerificacion":"2026-11-15","vigenteHasta":null,"fuente":"https://www.sbs.gob.pe/app/pp/empresasweb/Paginas/EmpCaptarDep.aspx"}'),
  (6, 'Cooperativa Pacífico', 1, 0, 0, 1, '{"estado":"NO_VERIFICADO","entidadFinanciera":"Cooperativa Pacífico","fechaVerificacion":"2026-11-15","vigenteHasta":null,"fuente":"https://www.sbs.gob.pe/app/pp/empresasweb/Paginas/EmpCaptarDep.aspx"}');

-- El id del producto es el id de su entidad (US25/US26 dependen de eso)
INSERT OR IGNORE INTO fixed_deposit_products (id, entity_id, department, tea, minimum_amount) VALUES
  (1, 1, 'Lima', '0.055', '500'),
  (2, 2, 'Lima', '0.06', '1000'),
  (3, 3, 'Lima', '0.0575', '500'),
  (4, 4, 'Lima', '0.045', '500'),
  (5, 5, 'Lima', '0.05', '500'),
  (6, 6, 'Cusco', '0.065', '500');

INSERT OR IGNORE INTO savings_accounts (id, holder, balance, annual_rate, opened_at, monthly_maintenance_fee, has_physical_branches, has_atms, has_digital_banking, has_mobile_app, fsd_coverage) VALUES
  ('AH-001', 'Ana Torres', '1000.00', '0.05', '2023-01-10', '0.00', 1, 1, 1, 1, NULL),
  ('AH-002', 'Beto Quispe', '5000.00', '0.02', '2022-06-01', '0.00', 1, 0, 1, 0, NULL),
  ('AH-003', 'Carla Rojas', '300.00', '0.1', '2024-03-15', '5.00', 0, 1, 0, 1, NULL),
  ('AH-004', 'Diego Salas', '12500.50', '0.035', '2021-11-20', '0.00', 0, 0, 0, 0, NULL),
  ('AH-005', 'Elena Vargas', '850.75', '0.045', '2024-08-05', '8.50', 1, 1, 1, 1, NULL),
  ('AH-006', 'Fabio Medina', '2200.00', '0.03', '2023-09-30', '3.00', 1, 0, 0, 1, NULL);

-- US21: únicamente asociaciones explícitas, sin deducir por titular o modificar la cuenta.
WITH associations(account_id, entity_id, entity_name) AS (VALUES
  ('AH-001', 1, 'Banco de Crédito del Perú (BCP)'),
  ('AH-002', 2, 'BBVA Perú'),
  ('AH-003', 3, 'Interbank'),
  ('AH-004', 4, 'Scotiabank Perú'),
  ('AH-005', 5, 'Cooperativa Abaco'),
  ('AH-006', 6, 'Cooperativa Pacífico')
)
INSERT OR IGNORE INTO savings_account_entities (account_id, entity_id)
SELECT a.account_id, a.entity_id FROM associations a
JOIN savings_accounts s ON s.id = a.account_id
JOIN financial_entities e ON e.id = a.entity_id AND e.name = a.entity_name;

-- US08/US13: departamento y monto mínimo de apertura de cada cuenta (datos FICTICIOS de demostración).
INSERT OR IGNORE INTO savings_account_terms (account_id, department, minimum_amount) VALUES
  ('AH-001', 'Lima', '0.00'),
  ('AH-002', 'Lima', '0.00'),
  ('AH-003', 'Lima', '100.00'),
  ('AH-004', 'Lima', '0.00'),
  ('AH-005', 'Lima', '500.00'),
  ('AH-006', 'Cusco', '0.00');

INSERT OR IGNORE INTO sbs_risk_profiles (entity_id, risk_rating, capital_adequacy_ratio, delinquency_rate, liquidity_ratio, report_date, source_url) VALUES
  (1, 'A+', '0.1620', '0.0210', '0.3150', '2026-09-30', 'https://www.sbs.gob.pe/'),
  (2, 'A', '0.1480', '0.0290', '0.2840', '2026-09-30', 'https://www.sbs.gob.pe/'),
  (3, 'B+', '0.1310', '0.0460', '0.2210', '2026-09-30', 'https://www.sbs.gob.pe/'),
  (4, 'C', '0.1070', '0.0890', '0.1520', '2026-09-30', 'https://www.sbs.gob.pe/'),
  (5, 'A-', '0.1390', '0.0350', '0.2630', '2026-09-30', 'https://www.sbs.gob.pe/'),
  (6, 'B', '0.1240', '0.0520', '0.2050', '2026-09-30', 'https://www.sbs.gob.pe/');

INSERT OR IGNORE INTO economist_reports (entity_id, summary, strengths, risks, recommendation, author, published_at) VALUES
  (1, 'Entidad con una posición financiera muy sólida. Su capital supera con holgura el mínimo exigido y su cartera presenta baja morosidad.', '["Ratio de capital global por encima del promedio del sistema","Morosidad baja y estable en los últimos trimestres","Buena liquidez para atender retiros"]', '["Alta competencia en tasas puede reducir su margen"]', 'Opción de bajo riesgo para depósitos a plazo fijo.', 'Área de Estudios Económicos (demostración)', '2026-10-15'),
  (2, 'Entidad sólida, con indicadores saludables y una tasa atractiva. Exige un monto mínimo de apertura mayor que el resto.', '["Capital suficiente para crecer","Morosidad controlada","Ofrece la tasa más alta de Lima"]', '["Su crecimiento rápido de colocaciones requiere seguimiento"]', 'Buena alternativa si se cuenta con el monto mínimo de S/ 1,000.', 'Área de Estudios Económicos (demostración)', '2026-10-15'),
  (3, 'Entidad con indicadores aceptables. Su morosidad está algo por encima del promedio, aunque mantiene capital y liquidez adecuados.', '["Capital dentro de lo recomendado","Tasa competitiva"]', '["Morosidad por encima del promedio del sistema","Liquidez más ajustada que la de entidades similares"]', 'Riesgo moderado: conviene no concentrar todo el ahorro en esta entidad.', 'Área de Estudios Económicos (demostración)', '2026-10-15'),
  (4, 'Entidad con debilidades financieras. Su capital está cerca del mínimo y la morosidad viene subiendo.', '["Mantiene el capital mínimo exigido"]', '["Morosidad alta y en aumento","Liquidez baja","Ofrece la tasa más baja del grupo"]', 'Riesgo alto: revisar con cuidado antes de depositar.', 'Área de Estudios Económicos (demostración)', '2026-10-15'),
  (5, 'Entidad con buena solidez. Sus indicadores son estables aunque algo menores que los de las entidades mejor calificadas.', '["Capital y liquidez estables","Morosidad moderada"]', '["Rentabilidad menor que la de otras entidades"]', 'Opción segura con riesgo bajo a medio.', 'Área de Estudios Económicos (demostración)', '2026-10-15'),
  (6, 'Entidad regional con indicadores aceptables y la tasa más alta de Cusco.', '["Tasa alta para depósitos","Capital adecuado"]', '["Morosidad algo elevada","Depende de una sola región"]', 'Riesgo moderado: buena tasa, pero conviene diversificar.', 'Área de Estudios Económicos (demostración)', '2026-10-15');

-- Extensión de la revisión LOCAL de FSD hasta 2026-12-15 en bases ya creadas (INSERT OR IGNORE no las toca).
-- Solo cambia evidencia CUBIERTO de la consulta 2026-11-15 que aún vence el 2026-11-22. Idempotente.
UPDATE financial_entities
SET fsd_coverage = json_set(fsd_coverage, '$.vigenteHasta', '2026-12-15')
WHERE json_valid(fsd_coverage)
  AND json_extract(fsd_coverage, '$.estado') = 'CUBIERTO'
  AND json_extract(fsd_coverage, '$.fechaVerificacion') = '2026-11-15'
  AND json_extract(fsd_coverage, '$.vigenteHasta') = '2026-11-22';
