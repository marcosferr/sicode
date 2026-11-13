/** Tipos compartidos por el motor, el almacén y la interfaz. */

export type EstadoDenuncia =
  | "SIN_TURNAR"
  | "TURNADA"
  | "REGISTRADA"
  | "EN_PROCESO"
  | "ATENDIDA"
  | "IMPROCEDENTE";

export const ESTADOS: Record<EstadoDenuncia, { etiqueta: string; descripcion: string }> = {
  SIN_TURNAR: {
    etiqueta: "Sin turnar",
    descripcion: "La denuncia fue recibida y está pendiente de su primer turnado a la autoridad competente.",
  },
  TURNADA: {
    etiqueta: "Turnada",
    descripcion: "La denuncia fue enviada al buzón de la autoridad competente y está pendiente de aceptación.",
  },
  REGISTRADA: {
    etiqueta: "Registrada",
    descripcion: "La autoridad competente aceptó la denuncia y la registró formalmente para su atención.",
  },
  EN_PROCESO: {
    etiqueta: "En proceso",
    descripcion: "La denuncia está siendo investigada y atendida por la autoridad competente.",
  },
  ATENDIDA: {
    etiqueta: "Atendida",
    descripcion: "La denuncia fue procesada y cuenta con un resultado.",
  },
  IMPROCEDENTE: {
    etiqueta: "Improcedente",
    descripcion: "La autoridad determinó que la denuncia no puede continuar y explicó el motivo.",
  },
};

export type TipoInvolucrado = "SERVIDOR_PUBLICO" | "EMPRESA" | "PARTICULAR";

export interface Involucrado {
  tipo: TipoInvolucrado;
  /** Persona: nombre tal como lo escribió quien denuncia. */
  nombre?: string;
  cargo?: string;
  institucion?: string;
  /** Empresa. */
  razonSocial?: string;
  rfc?: string;
}

export interface Lugar {
  /** Clave INEGI de dos dígitos de la entidad federativa. */
  entidad?: string;
  municipio?: string;
  institucion?: string;
}

export interface InformeLimpieza {
  tipo: string;
  /** Lo que el archivo revelaba antes de limpiarlo, en lenguaje llano. */
  hallazgos: string[];
  /** Lo que no se pudo limpiar automáticamente y la persona debe revisar. */
  advertencias: string[];
  limpiado: boolean;
  bytesAntes: number;
  bytesDespues: number;
}

export interface Evidencia {
  id: string;
  nombre: string;
  tipo: string;
  tamano: number;
  sha256: string;
  limpieza: InformeLimpieza;
}

export interface Mensaje {
  id: string;
  autor: "AUTORIDAD" | "DENUNCIANTE";
  texto: string;
  /** Solo día (AAAA-MM-DD): la hora exacta ayudaría a correlacionar con otros registros. */
  fecha: string;
}

export interface EntradaBitacora {
  fecha: string;
  actor: string;
  accion: string;
  detalle?: string;
}

export interface Denuncia {
  id: string;
  folio: string;
  status: EstadoDenuncia;
  /** Solo día. */
  fechaRecepcion: string;
  fechaActualizacion: string;
  anonimo: boolean;
  /** Datos de contacto cifrados (AES-256-GCM). Vacío en denuncias anónimas. */
  contactoCifrado?: string;
  narracionHechos: string;
  conductas: string[];
  /** Mes del hecho (AAAA-MM) o vacío. */
  fechaHecho?: string;
  lugar: Lugar;
  involucrados: Involucrado[];
  referenciaContratacion?: string;
  evidencias: Evidencia[];
  secretoHash: string;
  intentosFallidos: number;
  bloqueadoHasta?: string;
  prioridad?: "ALTA" | "MEDIA" | "BAJA";
  institucionActual?: string;
  operadorAsignado?: string;
  resumenPublicoCierre?: string;
  mensajes: Mensaje[];
  corroboracion?: Corroboracion;
  bitacora: EntradaBitacora[];
}

/* ---------- Corroboración ---------- */

export type Sistema = "S1" | "S2" | "S3" | "S6" | "S5";

/** A: registro oficial con identificador. B: registro oficial, coincide nombre y ente.
 *  C: coincide solo el nombre. D: sin respaldo; no mueve el semáforo. */
export type Confiabilidad = "A" | "B" | "C" | "D";

export interface Fuente {
  sistema: Sistema;
  /** Proveedor de datos dentro de la PDN (p. ej. una secretaría estatal). */
  proveedor?: string;
  /** Dónde puede comprobarlo una persona. */
  url: string;
  /** Identificador del registro en la fuente. */
  referencia?: string;
  modo: "local" | "api";
  fechaConsulta: string;
}

export interface Indicio {
  id: string;
  categoria: string;
  tipo: "hecho" | "posible_alerta" | "contexto";
  /** Redacción neutra: describe el dato, no califica a la persona. */
  descripcion: string;
  detalle?: string;
  sujeto: string;
  confiabilidad: Confiabilidad;
  reglaDura?: string;
  fuente: Fuente;
  /** Otra explicación posible del mismo dato, para evitar lecturas apresuradas. */
  explicacionAlternativa?: string;
}

export interface Consulta {
  sistema: Sistema;
  descripcion: string;
  modo: "local" | "api";
  estado: "ok" | "sin_resultados" | "no_accesible";
  resultados: number;
  ms: number;
  detalle?: string;
}

export interface Hipotesis {
  id: string;
  enunciado: string;
  comoVerificar: string;
  estado: "abierta" | "con_respaldo" | "sin_respaldo";
  indicios: string[];
}

export interface Semaforo {
  color: "verde" | "amarillo" | "rojo";
  puntaje: number;
  colorPorPuntaje: "verde" | "amarillo" | "rojo";
  reglasDuras: { regla: string; descripcion: string; indicio: string }[];
  contribuciones: {
    indicio: string;
    categoria: string;
    severidad: number;
    confiabilidad: Confiabilidad;
    aporte: number;
  }[];
  tareasVerificacion: { indicio: string; motivo: string }[];
  brechas: string[];
  queCambiaria: string[];
  criterio: { version: string; sha256: string };
}

export interface ClasificacionSugerida {
  clave: string;
  nombre: string;
  tipo: "FALTA_GRAVE" | "FALTA_NO_GRAVE" | "FALTA_PARTICULARES" | "HECHO_CORRUPCION";
  fundamento: string;
  motivos: string[];
}

export interface Corroboracion {
  fecha: string;
  entidadesExtraidas: {
    personas: { nombre: string; cargo?: string; institucion?: string }[];
    empresas: { razonSocial: string; rfc?: string }[];
    entes: string[];
    rfcs: string[];
    montos: string[];
    contratos: string[];
  };
  hipotesis: Hipotesis[];
  indicios: Indicio[];
  consultas: Consulta[];
  semaforo: Semaforo;
  clasificacion: ClasificacionSugerida[];
}
