// El controlador la traduce a HTTP 400; el mensaje está pensado para mostrarse al usuario.
export class InvalidSimulationParametersError extends Error {
  name = "InvalidSimulationParametersError";
}
