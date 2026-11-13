/**
 * Normalización y comparación de nombres de personas, empresas y entes públicos.
 *
 * Las fuentes de la PDN no normalizan: "HERNÁNDEZ" y "HERNANDEZ" son cadenas distintas
 * para sus buscadores. Por eso todo cruce pasa primero por `normalizar`.
 */

/** Formas jurídicas mexicanas (ya sin puntuación), de la más larga a la más corta. */
const FORMAS_JURIDICAS = [
  "S A P I DE C V",
  "SAPI DE CV",
  "S A B DE C V",
  "SAB DE CV",
  "S DE R L DE C V",
  "S DE RL DE CV",
  "SRL DE CV",
  "S A DE C V",
  "SA DE CV",
  "S A S DE C V",
  "SAS DE CV",
  "S C DE R L DE C V",
  "S P R DE R L",
  "SPR DE RL",
  "S DE R L",
  "S DE RL",
  "S A S",
  "SAS",
  "S A",
  "SA",
  "S C",
  "SC",
  "A C",
  "AC",
  "S A P I",
  "SAPI",
];

export function quitarAcentos(texto: string): string {
  return texto.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/** Mayúsculas, sin acentos, sin puntuación, espacios simples. */
export function normalizar(texto: string | null | undefined): string {
  if (!texto) return "";
  return quitarAcentos(texto)
    .toUpperCase()
    .replace(/[^A-Z0-9&Ñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Separa "Telefonía IP, S.A. de C.V." en la base normalizada y su forma jurídica. */
export function separarFormaJuridica(nombre: string): { base: string; forma: string | null } {
  const n = normalizar(nombre);
  for (const forma of FORMAS_JURIDICAS) {
    if (n.endsWith(" " + forma)) {
      return { base: n.slice(0, -forma.length - 1).trim(), forma };
    }
  }
  return { base: n, forma: null };
}

/** Clave de comparación de una empresa: nombre normalizado sin forma jurídica. */
export function claveEmpresa(nombre: string): string {
  return separarFormaJuridica(nombre).base;
}

const PARTICULAS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "Y", "EL", "EN"]);

export function tokens(texto: string, quitarParticulas = false): string[] {
  const t = normalizar(texto).split(" ").filter((x) => x.length > 1);
  return quitarParticulas ? t.filter((x) => !PARTICULAS.has(x)) : t;
}

function bigramas(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = ` ${s} `;
  for (let i = 0; i < t.length - 1; i++) {
    const b = t.slice(i, i + 2);
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  return m;
}

/** Coeficiente de Dice sobre bigramas (0 a 1). Tolera errores de tipeo. */
export function dice(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigramas(a);
  const B = bigramas(b);
  let comunes = 0;
  let totalA = 0;
  let totalB = 0;
  for (const v of A.values()) totalA += v;
  for (const [k, v] of B) {
    totalB += v;
    comunes += Math.min(v, A.get(k) ?? 0);
  }
  return (2 * comunes) / (totalA + totalB);
}

/**
 * Similitud 0–1 entre dos nombres. Combina secuencia (Dice), el mismo nombre en otro
 * orden ("PÉREZ LÓPEZ JUAN" frente a "JUAN PÉREZ LÓPEZ") y contención de palabras.
 */
export function similitud(a: string, b: string): number {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  const jaccard = inter / union;
  const contencion = inter / Math.min(ta.size, tb.size);
  const secuencia = dice(na, nb);
  const ordenada = dice([...ta].sort().join(" "), [...tb].sort().join(" "));
  const valor = Math.max(secuencia, ordenada, 0.5 * jaccard + 0.5 * contencion * secuencia);
  return Math.round(valor * 10000) / 10000;
}

export interface NombrePersona {
  nombres?: string | null;
  primerApellido?: string | null;
  segundoApellido?: string | null;
}

export function nombreCompleto(p: NombrePersona): string {
  return [p.nombres, p.primerApellido, p.segundoApellido]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Compara dos personas. Exige que el primer apellido coincida casi exacto: sin eso, un
 * parecido global alto suele ser un homónimo parcial ("JUAN PÉREZ" y "JUAN PEREA").
 * Devuelve 0 cuando no hay base para afirmar coincidencia.
 */
export function similitudPersona(a: NombrePersona, b: NombrePersona): number {
  const apA = normalizar(a.primerApellido);
  const apB = normalizar(b.primerApellido);
  const global = similitud(nombreCompleto(a), nombreCompleto(b));
  if (apA && apB) {
    if (dice(apA, apB) < 0.85) return 0;
    const nomA = tokens(a.nombres ?? "");
    const nomB = tokens(b.nombres ?? "");
    if (nomA.length && nomB.length) {
      const comparte = nomA.some((x) => nomB.some((y) => dice(x, y) >= 0.85));
      if (!comparte) return 0;
    }
    const segA = normalizar(a.segundoApellido);
    const segB = normalizar(b.segundoApellido);
    if (segA && segB && dice(segA, segB) < 0.85) return 0;
  }
  return global;
}

/** Parte un nombre escrito en un solo campo en nombres y apellidos (convención hispana). */
export function partirNombre(completo: string): NombrePersona {
  const partes = completo.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return {};
  if (partes.length === 1) return { nombres: partes[0] };
  if (partes.length === 2) return { nombres: partes[0], primerApellido: partes[1] };
  // Une partículas con el apellido que sigue: "DE LA CRUZ" cuenta como un apellido.
  const grupos: string[] = [];
  let pendiente = "";
  for (const p of partes) {
    if (PARTICULAS.has(normalizar(p)) && grupos.length > 0) {
      pendiente += p + " ";
    } else {
      grupos.push(pendiente + p);
      pendiente = "";
    }
  }
  if (grupos.length < 3) return { nombres: grupos[0], primerApellido: grupos[1] };
  return {
    nombres: grupos.slice(0, -2).join(" "),
    primerApellido: grupos[grupos.length - 2],
    segundoApellido: grupos[grupos.length - 1],
  };
}

export const RE_RFC_MORAL = /\b[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}\b/g;
export const RE_RFC_FISICA = /\b[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}\b/g;
export const RE_CURP = /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/g;

/** Valida la fecha embebida en un RFC para descartar cadenas que solo se le parecen. */
export function esRfcPlausible(rfc: string): boolean {
  const m = rfc.toUpperCase().match(/^[A-ZÑ&]{3,4}(\d{2})(\d{2})(\d{2})[A-Z0-9]{3}$/);
  if (!m) return false;
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31;
}

/**
 * En JavaScript, `\b` solo conoce letras sin acento: no ve un límite de palabra antes de
 * «éramos» ni después de «pidió». Esta función reescribe cada `\b` de una expresión como
 * un límite de palabra que sí entiende letras acentuadas.
 */
export function conLimitesUnicode(re: RegExp): RegExp {
  const limite = "(?:(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}])|(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}]))";
  const banderas = re.flags.includes("u") ? re.flags : re.flags + "u";
  return new RegExp(re.source.replace(/\\b/g, limite), banderas);
}
