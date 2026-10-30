import { useState } from "react";
import type { FormEvent } from "react";
import "./FormularioInversion.css";

export type TipoInstrumento = "AHORROS" | "PLAZO_FIJO";

const DEPARTAMENTOS = ["Lima", "Arequipa", "Cusco"];
const PLAZOS_DIAS = [180, 360, 540, 720, 900, 1080];

interface Props {
  tipoInstrumento: TipoInstrumento;
  onTipoInstrumentoChange: (tipo: TipoInstrumento) => void;
}

interface ParametrosAhorro {
  monto: string;
  departamento: string;
}

interface ParametrosPlazoFijo extends ParametrosAhorro {
  plazoDias: string;
  modalidadPago: string;
}

export function FormularioInversion({
  tipoInstrumento,
  onTipoInstrumentoChange,
}: Props) {
  const [parametrosAhorro, setParametrosAhorro] = useState<ParametrosAhorro>({
    monto: "",
    departamento: "",
  });
  const [parametrosPlazoFijo, setParametrosPlazoFijo] =
    useState<ParametrosPlazoFijo>({
      monto: "",
      departamento: "",
      plazoDias: "",
      modalidadPago: "",
    });
  const [confirmacion, setConfirmacion] = useState("");

  function cambiarInstrumento(tipo: TipoInstrumento) {
    onTipoInstrumentoChange(tipo);
    setConfirmacion("");
  }

  function guardarParametros(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setConfirmacion("Parámetros guardados temporalmente para la simulación.");
  }

  return (
    <section className="formulario-inversion" aria-labelledby="titulo-inversion">
      <h2 id="titulo-inversion">Configura tu inversión</h2>
      <fieldset className="selector-instrumento">
        <legend>Selecciona el tipo de instrumento financiero</legend>
        <label>
          <input
            type="radio"
            name="tipoInstrumento"
            value="AHORROS"
            checked={tipoInstrumento === "AHORROS"}
            onChange={() => cambiarInstrumento("AHORROS")}
          />
          Cuenta de Ahorros
        </label>
        <label>
          <input
            type="radio"
            name="tipoInstrumento"
            value="PLAZO_FIJO"
            checked={tipoInstrumento === "PLAZO_FIJO"}
            onChange={() => cambiarInstrumento("PLAZO_FIJO")}
          />
          Depósito a Plazo Fijo
        </label>
      </fieldset>

      <form className="parametros-inversion" onSubmit={guardarParametros}>
        <h3>
          {tipoInstrumento === "AHORROS"
            ? "Parámetros de Cuenta de Ahorros"
            : "Parámetros de Depósito a Plazo Fijo"}
        </h3>

        <div className="campos-inversion">
          <label>
            {tipoInstrumento === "AHORROS"
              ? "Monto total a invertir (S/)"
              : "Monto del depósito (S/)"}
            <input
              type="number"
              min={tipoInstrumento === "AHORROS" ? "0.01" : "500"}
              step="0.01"
              required
              value={
                tipoInstrumento === "AHORROS"
                  ? parametrosAhorro.monto
                  : parametrosPlazoFijo.monto
              }
              onChange={(evento) => {
                setConfirmacion("");
                if (tipoInstrumento === "AHORROS") {
                  setParametrosAhorro({
                    ...parametrosAhorro,
                    monto: evento.target.value,
                  });
                } else {
                  setParametrosPlazoFijo({
                    ...parametrosPlazoFijo,
                    monto: evento.target.value,
                  });
                }
              }}
            />
          </label>

          <label>
            Departamento de residencia
            <select
              required
              value={
                tipoInstrumento === "AHORROS"
                  ? parametrosAhorro.departamento
                  : parametrosPlazoFijo.departamento
              }
              onChange={(evento) => {
                setConfirmacion("");
                if (tipoInstrumento === "AHORROS") {
                  setParametrosAhorro({
                    ...parametrosAhorro,
                    departamento: evento.target.value,
                  });
                } else {
                  setParametrosPlazoFijo({
                    ...parametrosPlazoFijo,
                    departamento: evento.target.value,
                  });
                }
              }}
            >
              <option value="" disabled>
                Selecciona un departamento
              </option>
              {DEPARTAMENTOS.map((departamento) => (
                <option key={departamento} value={departamento}>
                  {departamento}
                </option>
              ))}
            </select>
          </label>

          {tipoInstrumento === "PLAZO_FIJO" && (
            <>
              <label>
                Plazo
                <select
                  required
                  value={parametrosPlazoFijo.plazoDias}
                  onChange={(evento) => {
                    setConfirmacion("");
                    setParametrosPlazoFijo({
                      ...parametrosPlazoFijo,
                      plazoDias: evento.target.value,
                    });
                  }}
                >
                  <option value="" disabled>
                    Selecciona el plazo
                  </option>
                  {PLAZOS_DIAS.map((dias) => (
                    <option key={dias} value={dias}>
                      {dias} días
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Modalidad de pago de intereses
                <select
                  required
                  value={parametrosPlazoFijo.modalidadPago}
                  onChange={(evento) => {
                    setConfirmacion("");
                    setParametrosPlazoFijo({
                      ...parametrosPlazoFijo,
                      modalidadPago: evento.target.value,
                    });
                  }}
                >
                  <option value="" disabled>
                    Selecciona la modalidad
                  </option>
                  <option value="AT_MATURITY">Al vencimiento</option>
                  <option value="MONTHLY">Mensual</option>
                </select>
              </label>
            </>
          )}
        </div>

        {tipoInstrumento === "PLAZO_FIJO" && (
          <p className="ayuda-inversion">
            El monto mínimo para un depósito a plazo fijo es S/ 500.
          </p>
        )}

        <button className="boton-inversion" type="submit">
          Guardar parámetros
        </button>
        {confirmacion && (
          <p className="confirmacion-inversion" role="status">
            {confirmacion}
          </p>
        )}
      </form>
    </section>
  );
}
