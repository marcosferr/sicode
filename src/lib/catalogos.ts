import { conLimitesUnicode } from "./texto";
import type { ClasificacionSugerida } from "./tipos";

/** Entidades federativas con su clave INEGI. */
export const ENTIDADES: Record<string, string> = {
  "01": "Aguascalientes", "02": "Baja California", "03": "Baja California Sur", "04": "Campeche",
  "05": "Coahuila de Zaragoza", "06": "Colima", "07": "Chiapas", "08": "Chihuahua", "09": "Ciudad de México",
  "10": "Durango", "11": "Guanajuato", "12": "Guerrero", "13": "Hidalgo", "14": "Jalisco", "15": "México",
  "16": "Michoacán de Ocampo", "17": "Morelos", "18": "Nayarit", "19": "Nuevo León", "20": "Oaxaca",
  "21": "Puebla", "22": "Querétaro", "23": "Quintana Roo", "24": "San Luis Potosí", "25": "Sinaloa",
  "26": "Sonora", "27": "Tabasco", "28": "Tamaulipas", "29": "Tlaxcala",
  "30": "Veracruz de Ignacio de la Llave", "31": "Yucatán", "32": "Zacatecas",
};

type Fundamento = Omit<ClasificacionSugerida, "motivos">;

const LGRA = "Ley General de Responsabilidades Administrativas";
const CPF = "Código Penal Federal";

/** Fundamentos orientativos. Los valida el área jurídica de la autoridad, no el sistema. */
const F: Record<string, Fundamento> = {
  COHECHO: { clave: "COHECHO", nombre: "Cohecho", tipo: "FALTA_GRAVE", fundamento: `${LGRA}, art. 52` },
  PECULADO: { clave: "PECULADO", nombre: "Peculado", tipo: "FALTA_GRAVE", fundamento: `${LGRA}, art. 53` },
  DESVIO: { clave: "DESVIO_RECURSOS", nombre: "Desvío de recursos públicos", tipo: "FALTA_GRAVE", fundamento: `${LGRA}, art. 54` },
  INFORMACION: { clave: "UTILIZACION_INDEBIDA_INFORMACION", nombre: "Utilización indebida de información", tipo: "FALTA_GRAVE", fundamento: `${LGRA}, art. 55` },
  ABUSO: { clave: "ABUSO_FUNCIONES", nombre: "Abuso de funciones", tipo: "FALTA_GRAVE", fundamento: `${LGRA}, art. 57` },
  CONFLICTO: { clave: "CONFLICTO_INTERES", nombre: "Actuación bajo conflicto de interés", tipo: "FALTA_GRAVE", fundamento: `${LGRA}, art. 58` },
  CONTRATACION: { clave: "CONTRATACION_INDEBIDA", nombre: "Contratación indebida", tipo: "FALTA_GRAVE", fundamento: `${LGRA}, art. 59` },
  ENRIQUECIMIENTO: { clave: "ENRIQUECIMIENTO_OCULTO", nombre: "Enriquecimiento oculto u ocultamiento de conflicto de interés", tipo: "FALTA_GRAVE", fundamento: `${LGRA}, art. 60` },
  TRAFICO: { clave: "TRAFICO_INFLUENCIAS", nombre: "Tráfico de influencias", tipo: "FALTA_GRAVE", fundamento: `${LGRA}, art. 61` },
  ENCUBRIMIENTO: { clave: "ENCUBRIMIENTO", nombre: "Encubrimiento", tipo: "FALTA_GRAVE", fundamento: `${LGRA}, art. 62` },
  NEPOTISMO: { clave: "NEPOTISMO", nombre: "Nepotismo", tipo: "FALTA_GRAVE", fundamento: `${LGRA}, art. 63 Bis` },
  NO_GRAVE: { clave: "FALTA_NO_GRAVE", nombre: "Falta administrativa no grave", tipo: "FALTA_NO_GRAVE", fundamento: `${LGRA}, art. 49` },
  P_SOBORNO: { clave: "SOBORNO", nombre: "Soborno (particulares)", tipo: "FALTA_PARTICULARES", fundamento: `${LGRA}, art. 66` },
  P_PARTICIPACION: { clave: "PARTICIPACION_ILICITA", nombre: "Participación ilícita en procedimientos administrativos (particulares)", tipo: "FALTA_PARTICULARES", fundamento: `${LGRA}, art. 67` },
  P_TRAFICO: { clave: "TRAFICO_INFLUENCIAS_PARTICULARES", nombre: "Tráfico de influencias para inducir a la autoridad (particulares)", tipo: "FALTA_PARTICULARES", fundamento: `${LGRA}, art. 68` },
  P_COLUSION: { clave: "COLUSION", nombre: "Colusión (particulares)", tipo: "FALTA_PARTICULARES", fundamento: `${LGRA}, art. 70` },
  D_COHECHO: { clave: "CPF_COHECHO", nombre: "Cohecho", tipo: "HECHO_CORRUPCION", fundamento: `${CPF}, art. 222` },
  D_PECULADO: { clave: "CPF_PECULADO", nombre: "Peculado", tipo: "HECHO_CORRUPCION", fundamento: `${CPF}, art. 223` },
  D_ABUSO: { clave: "CPF_EJERCICIO_ABUSIVO", nombre: "Ejercicio abusivo de funciones", tipo: "HECHO_CORRUPCION", fundamento: `${CPF}, art. 220` },
  D_ATRIBUCIONES: { clave: "CPF_USO_ILICITO_ATRIBUCIONES", nombre: "Uso ilícito de atribuciones y facultades", tipo: "HECHO_CORRUPCION", fundamento: `${CPF}, art. 217` },
  D_TRAFICO: { clave: "CPF_TRAFICO_INFLUENCIA", nombre: "Tráfico de influencia", tipo: "HECHO_CORRUPCION", fundamento: `${CPF}, art. 221` },
  D_ENRIQUECIMIENTO: { clave: "CPF_ENRIQUECIMIENTO_ILICITO", nombre: "Enriquecimiento ilícito", tipo: "HECHO_CORRUPCION", fundamento: `${CPF}, art. 224` },
  D_CONCUSION: { clave: "CPF_CONCUSION", nombre: "Concusión", tipo: "HECHO_CORRUPCION", fundamento: `${CPF}, art. 218` },
};

export interface Conducta {
  clave: string;
  /** Texto llano que ve quien denuncia. */
  titulo: string;
  ejemplo: string;
  fundamentos: Fundamento[];
  /** Palabras que sugieren esta conducta cuando la persona no eligió ninguna. */
  pistas: RegExp;
}

export const CONDUCTAS: Conducta[] = ([
  {
    clave: "SOBORNO",
    titulo: "Pidió o recibió dinero, regalos o favores",
    ejemplo: "Por ejemplo: para agilizar un trámite, dejar pasar algo o dar un beneficio.",
    fundamentos: [F.COHECHO, F.P_SOBORNO, F.D_COHECHO],
    pistas: /\b(soborn\w*|mordida|moche|coima|dádiva|dadiva|me pidi[oó] dinero|pidi[oó] dinero|a cambio de dinero|recibi[oó] dinero|regalos? a cambio)\b/i,
  },
  {
    clave: "EXTORSION",
    titulo: "Exigió dinero o algo indebido con presión o amenazas",
    ejemplo: "Por ejemplo: cobrar por un servicio gratuito o amenazar con negar un trámite.",
    fundamentos: [F.D_CONCUSION, F.COHECHO],
    pistas: /\b(extorsi\w*|exigi[oó]|amenaz\w*|me oblig[oó]|cobro indebido|cobr[oó] por)\b/i,
  },
  {
    clave: "DESVIO",
    titulo: "Usó o se quedó con dinero o bienes públicos",
    ejemplo: "Por ejemplo: recursos de un programa, vehículos, materiales o nómina.",
    fundamentos: [F.PECULADO, F.DESVIO, F.D_PECULADO],
    pistas: /\b(desv[ií]\w*|se qued[oó] con|malvers\w*|peculado|aviadores?|nómina falsa|uso personal|recursos públicos)\b/i,
  },
  {
    clave: "FAVORITISMO_CONTRATO",
    titulo: "Favoreció a una empresa o persona en un contrato, compra o licitación",
    ejemplo: "Por ejemplo: dar un contrato sin concurso, acomodar las bases o inflar precios.",
    fundamentos: [F.CONTRATACION, F.P_COLUSION, F.P_PARTICIPACION, F.D_ATRIBUCIONES],
    pistas: /\b(licitaci\w*|adjudic\w*|contrato|sobreprecio|precios? inflados?|proveedor|empresa fantasma|sin concurso|a modo)\b/i,
  },
  {
    clave: "CONFLICTO",
    titulo: "Decidió sobre un asunto donde tenía un interés personal, familiar o de negocios",
    ejemplo: "Por ejemplo: es socio o pariente de quien resultó beneficiado.",
    fundamentos: [F.CONFLICTO],
    pistas: /\b(conflicto de inter[eé]s|es socio|su empresa|empresa de su|prestanombres?)\b/i,
  },
  {
    clave: "NEPOTISMO",
    titulo: "Contrató o benefició a familiares",
    ejemplo: "Por ejemplo: dio una plaza a su pareja, hijos u otros parientes.",
    fundamentos: [F.NEPOTISMO],
    pistas: /\b(nepotismo|contrat[oó] a su (espos[ao]|hij[ao]|herman[ao]|cuñad[ao]|sobrin[ao]|prim[ao]|pareja)|familiares? en la nómina)\b/i,
  },
  {
    clave: "INFLUENCIAS",
    titulo: "Usó su cargo o sus contactos para conseguir un beneficio",
    ejemplo: "Por ejemplo: presionar a otra oficina para que resuelva a favor de alguien.",
    fundamentos: [F.TRAFICO, F.P_TRAFICO, F.D_TRAFICO],
    pistas: /\b(tr[aá]fico de influencias?|palancas?|influyentismo|presion[oó] para|recomendad[oa])\b/i,
  },
  {
    clave: "ABUSO",
    titulo: "Aprovechó su puesto, su acceso o su autoridad para hacer algo que no debía",
    ejemplo: "Por ejemplo: dar permisos que no corresponden o perjudicar a alguien.",
    fundamentos: [F.ABUSO, F.D_ABUSO],
    pistas: /\b(abus[oó] de su (cargo|puesto|autoridad)|abuso de funciones|abuso de autoridad|arbitrari\w*)\b/i,
  },
  {
    clave: "ENRIQUECIMIENTO",
    titulo: "Tiene bienes o gastos que no corresponden con su sueldo",
    ejemplo: "Por ejemplo: casas, autos o viajes muy por encima de sus ingresos.",
    fundamentos: [F.ENRIQUECIMIENTO, F.D_ENRIQUECIMIENTO],
    pistas: /\b(enriquecimiento|no corresponde con su sueldo|propiedades|mansiones?|autos? de lujo|vida de lujo)\b/i,
  },
  {
    clave: "INFORMACION",
    titulo: "Usó información reservada para beneficiarse",
    ejemplo: "Por ejemplo: avisar antes a una empresa sobre una compra o una inspección.",
    fundamentos: [F.INFORMACION],
    pistas: /\b(informaci[oó]n (reservada|privilegiada|confidencial)|filtr[oó]|les avis[oó] antes)\b/i,
  },
  {
    clave: "ENCUBRIMIENTO",
    titulo: "Ocultó o dejó pasar una irregularidad",
    ejemplo: "Por ejemplo: sabía de la falta y no la reportó, o escondió documentos.",
    fundamentos: [F.ENCUBRIMIENTO],
    pistas: /\b(encubri\w*|ocult[oó]|tap[oó]|dej[oó] pasar|escondi[oó])\b/i,
  },
  {
    clave: "MAL_SERVICIO",
    titulo: "No atendió como debía, trató mal o retrasó un trámite sin razón",
    ejemplo: "Por ejemplo: negar un servicio, maltratar o no cumplir sus funciones.",
    fundamentos: [F.NO_GRAVE],
    pistas: /\b(maltrat\w*|no me atendi\w*|negligen\w*|se neg[oó] a|retras[oó]|prepoten\w*)\b/i,
  },
] satisfies Conducta[]).map((c) => ({ ...c, pistas: conLimitesUnicode(c.pistas) }));

export const CONDUCTA_POR_CLAVE = new Map(CONDUCTAS.map((c) => [c.clave, c]));

/** Clasificación orientativa a partir de las conductas marcadas y de pistas en el relato. */
export function clasificar(conductas: string[], relato: string): ClasificacionSugerida[] {
  const salida = new Map<string, ClasificacionSugerida>();
  const agregar = (c: Conducta, motivo: string) => {
    for (const f of c.fundamentos) {
      const previo = salida.get(f.clave);
      if (previo) previo.motivos.push(motivo);
      else salida.set(f.clave, { ...f, motivos: [motivo] });
    }
  };
  for (const clave of conductas) {
    const c = CONDUCTA_POR_CLAVE.get(clave);
    if (c) agregar(c, `Quien denuncia marcó: «${c.titulo}».`);
  }
  for (const c of CONDUCTAS) {
    if (conductas.includes(c.clave)) continue;
    const m = relato.match(c.pistas);
    if (m) agregar(c, `El relato menciona «${m[0]}».`);
  }
  return [...salida.values()];
}

/** Claves del catálogo de faltas del S3 que equivalen a cada fundamento, para comparar antecedentes. */
export const FALTAS_S3_EQUIVALENTES: Record<string, string[]> = {
  COHECHO: ["COHECHO"],
  PECULADO: ["PECULADO"],
  DESVIO_RECURSOS: ["DESVIO_RECURSOS"],
  UTILIZACION_INDEBIDA_INFORMACION: ["UTILIZACION_INFORMACION"],
  ABUSO_FUNCIONES: ["ABUSO_FUNCIONES"],
  CONFLICTO_INTERES: ["ACTUACION_CONFLICTO_INTERES", "CONFLICTO_INTERES"],
  CONTRATACION_INDEBIDA: ["CONTRATACION_INDEBIDA"],
  ENRIQUECIMIENTO_OCULTO: ["ENRIQUECIMIENTO_OCULTO"],
  TRAFICO_INFLUENCIAS: ["TRAFICO_INFLUENCIAS"],
  ENCUBRIMIENTO: ["ENCUBRIMIENTO"],
  NEPOTISMO: ["NEPOTISMO"],
};
