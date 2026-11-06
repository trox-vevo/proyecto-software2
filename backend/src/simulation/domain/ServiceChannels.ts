// Value object (US18): canales de atención física de una entidad. Sin identidad ni ciclo de vida;
// la entidad financiera completa pertenece al contexto "Catálogo y Riesgo" (ver CLAUDE.md §7).
export class ServiceChannels {
  constructor(
    readonly hasPhysicalBranches: boolean,
    readonly hasAtms: boolean,
  ) {
    Object.freeze(this);
  }
}
