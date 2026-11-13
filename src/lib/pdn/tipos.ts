import type { NombrePersona } from "../texto";

/** Registros de la PDN ya normalizados a lo mínimo que el motor necesita. */

export interface Falta {
  clave: string;
  valor?: string;
  descripcion?: string;
}

export interface Sancion {
  clave: string;
  inhabilitacionHasta?: string;
}

export interface SancionServidor {
  id: string;
  proveedor: string;
  expediente?: string;
  fecha?: string;
  persona: NombrePersona;
  ente?: string;
  entidadFederativa?: string;
  cargo?: string;
  faltas: Falta[];
  sanciones: Sancion[];
  urlResolucion?: string;
}

export interface SancionParticular {
  id: string;
  proveedor: string;
  expediente?: string;
  fecha?: string;
  tipo: "MORAL" | "FISICA";
  razonSocial?: string;
  rfc?: string;
  persona?: NombrePersona;
  ente?: string;
  faltas: Falta[];
  sanciones: Sancion[];
  urlResolucion?: string;
}

export interface ResumenEnte {
  ente: string;
  entidadFederativa?: string;
  proveedor: string;
  total: number;
  graves: number;
  noGraves: number;
  porFalta: Record<string, number>;
  ultimoAnio?: number;
}

export interface ServidorContrataciones {
  proveedor: string;
  persona: NombrePersona;
  institucion?: string;
  puesto?: string;
  nivelesResponsabilidad: string[];
  tiposProcedimiento: string[];
  ejercicio?: string;
}

export interface ContratoS6 {
  ocid: string;
  ciclo?: number;
  comprador?: string;
  titulo?: string;
  metodo?: string;
  justificacion?: string;
  numOferentes?: number;
  oferentes: { id?: string; nombre: string }[];
  proveedores: { id?: string; nombre: string }[];
  montoAdjudicado?: number;
  moneda?: string;
  fechaAdjudicacion?: string;
  diasParaOfertar?: number;
  url?: string;
}

export interface InteresDeclarado {
  tipo: "PARTICIPACION" | "REPRESENTACION" | "CLIENTE" | "TOMA_DECISIONES";
  empresa: string;
  rfc?: string;
  detalle?: string;
}

export interface DeclaracionS1 {
  id: string;
  proveedor: string;
  persona: NombrePersona;
  institucion?: string;
  cargo?: string;
  tipo?: string;
  actualizacion?: string;
  intereses: InteresDeclarado[];
}

export interface ResultadoFuente<T> {
  datos: T[];
  modo: "local" | "api";
  estado: "ok" | "sin_resultados" | "no_accesible";
  ms: number;
  /** Hubo más resultados de los que se revisaron. */
  truncado?: boolean;
  detalle?: string;
}

/**
 * Lo que el motor necesita de la PDN. Hay una implementación real (índices locales para
 * S2 y S3, API con caché para S6 y S1) y una en memoria para pruebas y modo demostración.
 */
export interface FuentesPDN {
  sancionesServidor(p: NombrePersona): Promise<ResultadoFuente<SancionServidor>>;
  sancionesParticular(q: {
    razonSocial?: string;
    rfc?: string;
    persona?: NombrePersona;
  }): Promise<ResultadoFuente<SancionParticular>>;
  sancionesEnte(ente: string, entidadFederativa?: string): Promise<ResultadoFuente<ResumenEnte>>;
  servidoresContrataciones(p: NombrePersona): Promise<ResultadoFuente<ServidorContrataciones>>;
  contratosProveedor(q: { razonSocial?: string; rfc?: string }): Promise<ResultadoFuente<ContratoS6>>;
  declaraciones(p: NombrePersona): Promise<ResultadoFuente<DeclaracionS1>>;
}

export const URL_PDN = {
  S1: "https://www.plataformadigitalnacional.org/declaraciones",
  S2: "https://www.plataformadigitalnacional.org/servidores",
  S3: "https://www.plataformadigitalnacional.org/sancionados",
  S6: "https://www.plataformadigitalnacional.org/contrataciones",
} as const;
