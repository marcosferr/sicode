/**
 * Fuentes de demostración: registros FICTICIOS con el mismo formato que los de la PDN.
 * Ninguna persona, empresa ni ente de este archivo existe. Sirven para mostrar el sistema
 * sin inventar acusaciones contra personas o empresas reales.
 *
 * Se activan con SICODE_PDN=demo. Con cualquier otro valor se consulta la PDN real.
 */
import { FuentesEnMemoria, FuentesReales } from "./fuentes";
import type { ContratoS6, FuentesPDN } from "./tipos";

const ENTE = "Instituto Ficticio de Infraestructura de Valle Sereno";

const contrato = (n: number, o: Partial<ContratoS6> = {}): ContratoS6 => ({
  ocid: `ocds-demo-${1000 + n}`,
  ciclo: 2021,
  comprador: ENTE,
  titulo: "Mantenimiento de caminos rurales (registro ficticio)",
  metodo: "direct",
  justificacion: "Art. 41 fr. V (registro ficticio)",
  oferentes: [],
  proveedores: [{ id: "CDE180312AB7", nombre: "CONSTRUCTORA DEMOSTRATIVA DEL ESTE SA DE CV" }],
  montoAdjudicado: 2_450_000 + n * 310_000,
  moneda: "MXN",
  fechaAdjudicacion: `2021-0${n + 2}-15T00:00:00Z`,
  ...o,
});

export const FUENTES_DEMO = new FuentesEnMemoria({
  servidores: [
    {
      id: "demo-s3-1",
      proveedor: "Demostración",
      expediente: "DEMO/FG/014/2022",
      fecha: "2022-09-30",
      persona: { nombres: "ARMANDO", primerApellido: "FICTICIO", segundoApellido: "DEMOSTRADO" },
      ente: ENTE,
      entidadFederativa: "11",
      cargo: "DIRECTOR DE OBRAS",
      faltas: [{ clave: "ABUSO_FUNCIONES", descripcion: "Registro ficticio de demostración." }],
      sanciones: [{ clave: "INHABILITACION", inhabilitacionHasta: "2024-09-30" }],
    },
  ],
  particulares: [
    {
      id: "demo-s3-2",
      proveedor: "Demostración",
      tipo: "MORAL",
      expediente: "DEMO/PM/003/2020",
      fecha: "2020-11-05",
      razonSocial: "CONSTRUCTORA DEMOSTRATIVA DEL ESTE S.A. DE C.V.",
      rfc: "CDE180312AB7",
      ente: ENTE,
      faltas: [{ clave: "OTRO", valor: "COLUSION" }],
      sanciones: [{ clave: "INHABILITACION", inhabilitacionHasta: "2021-05-05" }],
    },
  ],
  entes: [
    {
      ente: ENTE,
      entidadFederativa: "11",
      proveedor: "Demostración",
      total: 7,
      graves: 3,
      noGraves: 4,
      porFalta: { CONTRATACION_INDEBIDA: 2, ABUSO_FUNCIONES: 1, DECLARACIONES_PATRIMONIALES_INTERESES: 4 },
      ultimoAnio: 2023,
    },
  ],
  s2: [
    {
      proveedor: "demostracion",
      persona: { nombres: "ARMANDO", primerApellido: "FICTICIO", segundoApellido: "DEMOSTRADO" },
      institucion: ENTE.toUpperCase(),
      puesto: "DIRECTOR DE OBRAS",
      nivelesResponsabilidad: ["RESOLUCIÓN", "TRAMITACIÓN"],
      tiposProcedimiento: ["CONTRATACIONES PÚBLICAS"],
      ejercicio: "2023",
    },
    {
      proveedor: "demostracion",
      persona: { nombres: "ROSALBA", primerApellido: "INVENTADA", segundoApellido: "EJEMPLAR" },
      institucion: "MUNICIPIO FICTICIO DE PUERTO CALMA",
      puesto: "JEFA DE ADQUISICIONES",
      nivelesResponsabilidad: ["ATENCIÓN"],
      tiposProcedimiento: ["CONTRATACIONES PÚBLICAS"],
      ejercicio: "2023",
    },
  ],
  contratos: [
    contrato(1),
    contrato(2),
    contrato(3),
    contrato(4, { metodo: "open", numOferentes: 1, diasParaOfertar: 6, justificacion: undefined }),
    contrato(5, { comprador: "Municipio Ficticio de Puerto Calma", ocid: "ocds-demo-2001", montoAdjudicado: 480_000 }),
  ],
  declaraciones: [
    {
      id: "demo-s1-1",
      proveedor: "DEMOSTRACION",
      persona: { nombres: "ARMANDO", primerApellido: "FICTICIO", segundoApellido: "DEMOSTRADO" },
      institucion: ENTE,
      cargo: "DIRECTOR DE OBRAS",
      tipo: "MODIFICACIÓN",
      actualizacion: "2023-05-28T00:00:00Z",
      intereses: [{ tipo: "PARTICIPACION", empresa: "Constructora Demostrativa del Este SA de CV", rfc: "CDE180312AB7", detalle: "SOCIO" }],
    },
  ],
});

export const modoDemo = () => process.env.SICODE_PDN === "demo";

export function fuentesConfiguradas(): FuentesPDN {
  return modoDemo() ? FUENTES_DEMO : new FuentesReales();
}
