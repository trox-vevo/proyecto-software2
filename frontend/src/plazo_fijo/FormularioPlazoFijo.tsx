import { useId, type FormEvent } from "react";
import {
  esModalidadPago,
  esPlazoPermitido,
  PLAZOS_PERMITIDOS,
  type ParametrosPlazoFijo,
} from "./tipos";
import "./PlazoFijo.css";

// Ubicaciones de entrada; la disponibilidad de productos la decide el backend.
const DEPARTAMENTOS = [
  "Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca",
  "Callao", "Cusco", "Huancavelica", "Huánuco", "Ica", "Junín", "La Libertad",
  "Lambayeque", "Lima", "Loreto", "Madre de Dios", "Moquegua", "Pasco",
  "Piura", "Puno", "San Martín", "Tacna", "Tumbes", "Ucayali",
];

interface Props {
  parametros: ParametrosPlazoFijo;
  onCambiar: (parametros: ParametrosPlazoFijo) => void;
  onSimular: () => void;
  cargando?: boolean;
  /** US07: mensajes de error que se muestran en rojo debajo del monto. */
  errores?: string[];
}

/** Vista controlada de US06. El estado pertenece al flujo, no al almacenamiento. */
export function FormularioPlazoFijo({ parametros, onCambiar, onSimular, cargando = false, errores = [] }: Props) {
  const id = useId();
  const hayErrores = errores.length > 0;

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cargando || !event.currentTarget.reportValidity()) return;
    if (!esPlazoPermitido(parametros.termDays) || !esModalidadPago(parametros.paymentMode)) return;
    onSimular();
  }

  return (
    <form className="plazo-formulario" onSubmit={enviar} aria-label="Parámetros de plazo fijo">
      <div>
        <label htmlFor={`${id}-monto`}>Monto de inversión (S/)</label>
        <input id={`${id}-monto`} name="amount" type="text" inputMode="decimal"
          required pattern="[0-9]+([.][0-9]{1,2})?"
          aria-describedby={hayErrores ? `${id}-ayuda ${id}-error` : `${id}-ayuda`}
          aria-invalid={hayErrores}
          value={parametros.amount}
          onChange={(event) => onCambiar({ ...parametros, amount: event.target.value })} />
        <small id={`${id}-ayuda`}>Usa un punto para los decimales, por ejemplo 1000.00.</small>
        {hayErrores && <p id={`${id}-error`} className="plazo-error" role="alert">{errores.join(" ")}</p>}
      </div>
      <div>
        <label htmlFor={`${id}-departamento`}>Departamento</label>
        <select id={`${id}-departamento`} name="department" required value={parametros.department}
          onChange={(event) => onCambiar({ ...parametros, department: event.target.value })}>
          {DEPARTAMENTOS.map((nombre) => <option key={nombre} value={nombre}>{nombre}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-modalidad`}>Modalidad de pago de intereses</label>
        <select id={`${id}-modalidad`} name="paymentMode" value={parametros.paymentMode}
          onChange={(event) => {
            const value = event.target.value;
            if (esModalidadPago(value)) onCambiar({ ...parametros, paymentMode: value });
          }}>
          <option value="AT_MATURITY">Al final del plazo</option>
          <option value="MONTHLY">Mensual</option>
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-plazo`}>Plazo en días</label>
        <select id={`${id}-plazo`} name="termDays" value={parametros.termDays}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (esPlazoPermitido(value)) onCambiar({ ...parametros, termDays: value });
          }}>
          {PLAZOS_PERMITIDOS.map((dias) => <option key={dias} value={dias}>{dias} días</option>)}
        </select>
      </div>
      <button type="submit" disabled={cargando}>{cargando ? "Simulando…" : "Simular plazo fijo"}</button>
    </form>
  );
}
