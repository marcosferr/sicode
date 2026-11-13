/**
 * Aviso de riesgo de identificación en el relato.
 *
 * Una denuncia puede ser anónima en el formulario y delatar a su autor en el texto:
 * "soy la única contadora del área", "me lo dijo a mí en su oficina a las 9:15".
 * Este módulo marca esas frases mientras la persona escribe y sugiere cómo decir lo
 * mismo sin exponerse.
 *
 * Corre completo en el navegador, con reglas. No usa modelos de lenguaje ni envía el
 * texto a ningún servicio: mandar el relato a un tercero para "protegerlo" sería
 * precisamente la fuga que se quiere evitar.
 *
 * Límite: son reglas, no comprensión. Reducen descuidos frecuentes; no garantizan que
 * un relato sea imposible de atribuir.
 */
import { conLimitesUnicode } from "../texto";

export type NivelRiesgo = "bajo" | "medio" | "alto";

export interface HallazgoRelato {
  tipo: string;
  titulo: string;
  nivel: Exclude<NivelRiesgo, "bajo">;
  fragmento: string;
  inicio: number;
  fin: number;
  consejo: string;
}

interface Regla {
  tipo: string;
  titulo: string;
  nivel: Exclude<NivelRiesgo, "bajo">;
  patron: RegExp;
  consejo: string;
}

const L = "a-záéíóúüñ";
const PARENTESCO =
  "espos[oa]|marido|mujer|pareja|novi[oa]|herman[oa]|pap[aá]|mam[aá]|padre|madre|hij[oa]|cuñad[oa]|suegr[oa]|prim[oa]|t[ií][oa]|sobrin[oa]|abuel[oa]|compadre|comadre";
const TRABAJO =
  "jefe|jefa|jefe direct[oa]|jefa directa|supervisor|supervisora|subordinad[oa]|compañer[oa]|coleg[ao]|asistente|secretari[oa]|director|directora|coordinador|coordinadora|titular";

const REGLAS: Regla[] = ([
  {
    tipo: "nombre_propio",
    titulo: "Dices tu nombre",
    nivel: "alto",
    patron: new RegExp(`\\b(?:[Mm]e llamo|[Mm]i nombre es|[Qq]uien suscribe,?|[Ee]l que suscribe,?|[Ll]a que suscribe,?)\\s+[A-ZÁÉÍÓÚÑ][${L}]+(?:\\s+(?:de |del |la )?[A-ZÁÉÍÓÚÑ][${L}]+){0,3}`, "g"),
    consejo: "Quita tu nombre. La denuncia no lo necesita para ser atendida.",
  },
  {
    tipo: "contacto",
    titulo: "Incluye un correo electrónico",
    nivel: "alto",
    patron: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
    consejo: "Quita el correo. Podrás dar seguimiento con tu folio y tu clave, sin dejar datos de contacto.",
  },
  {
    tipo: "contacto",
    titulo: "Incluye un número de teléfono",
    nivel: "alto",
    patron: /(?<![\d$.,])(?:\+?52[\s.-]?)?(?:\d[\s.-]?){10}(?![\d.,])/g,
    consejo: "Quita el teléfono. Si es el de la persona denunciada, anótalo en la sección de personas involucradas.",
  },
  {
    tipo: "identificador",
    titulo: "Incluye una CURP",
    nivel: "alto",
    patron: /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/g,
    consejo: "Quita la CURP: identifica a una persona de forma única.",
  },
  {
    tipo: "identificador",
    titulo: "Incluye un número de empleado o de nómina",
    nivel: "alto",
    patron: /\b(?:mi\s+)?(?:n[uú]mero|n[uú]m\.?|no\.?)\s+de\s+(?:emplead[oa]|n[oó]mina|plaza|expediente|gafete)\s*(?:es\s*)?:?\s*#?\w{3,}/gi,
    consejo: "Quita el número: permite ubicarte en los registros de la institución.",
  },
  {
    tipo: "unicidad",
    titulo: "Dices que solo tú pudiste saberlo",
    nivel: "alto",
    patron: new RegExp(
      `\\b(?:soy|fui|era|he sido)\\s+(?:el|la)\\s+[úu]nic[oa]\\b[^.;\\n]{0,60}|\\b(?:solo|sólo|solamente|únicamente)\\s+yo\\b[^.;\\n]{0,40}|\\bnadie\\s+m[aá]s\\s+(?:sabe|sab[ií]a|vio|estaba|ten[ií]a|tiene)\\b[^.;\\n]{0,40}|\\b(?:solo|sólo|únicamente)\\s+(?:a m[ií]|me lo)\\b[^.;\\n]{0,40}`,
      "gi",
    ),
    consejo: "Si solo tú pudiste saberlo, la frase te señala. Describe el hecho sin decir quién más lo sabía.",
  },
  {
    tipo: "grupo_pequeno",
    titulo: "Describes un grupo muy pequeño de testigos",
    nivel: "alto",
    patron: /\b(?:[ée]ramos|est[aá]bamos|fuimos|somos)\s+(?:solo\s+|sólo\s+|solamente\s+|únicamente\s+)?(?:dos|tres|cuatro|2|3|4)\b[^.;\n]{0,50}/gi,
    consejo: "Con tan pocas personas presentes es fácil deducir quién denunció. Puedes decir «había otras personas» sin dar el número.",
  },
  {
    tipo: "rol_propio",
    titulo: "Dices cuál es tu puesto",
    nivel: "alto",
    patron: new RegExp(
      `\\b(?:yo\\s+)?(?:soy|trabajo como|laboro como|me desempeño como|funjo como|estoy como)\\s+(?:el|la|un|una)?\\s*(?!${PARENTESCO})[${L}]{4,}(?:\\s+(?:de|del|de la|en)\\s+[${L}A-ZÁÉÍÓÚÑ]+){0,3}|\\bmi\\s+(?:puesto|cargo|plaza)\\s+es\\s+[^.;\\n]{3,50}|\\ben\\s+mi\\s+calidad\\s+de\\s+[^.;\\n]{3,50}`,
      "gi",
    ),
    consejo: "Tu puesto reduce mucho el círculo de quién pudo denunciar. Cuenta lo que pasó sin decir desde qué puesto lo viste.",
  },
  {
    tipo: "relacion",
    titulo: "Mencionas un vínculo de trabajo contigo",
    nivel: "medio",
    patron: new RegExp(`\\bmi\\s+(?:${TRABAJO})\\b`, "gi"),
    consejo: "«Mi jefe» indica que trabajas ahí. Usa el cargo o el nombre de la persona: «el director de obras».",
  },
  {
    tipo: "relacion",
    titulo: "Mencionas un vínculo familiar o personal contigo",
    nivel: "medio",
    patron: new RegExp(`\\bmi\\s+(?:${PARENTESCO}|vecin[oa]|amig[oa]|client[ea]|proveedor)\\b`, "gi"),
    consejo: "El vínculo personal acota quién eres. Nombra a la persona por su cargo o su nombre.",
  },
  {
    tipo: "area_propia",
    titulo: "Ubicas tu área de trabajo",
    nivel: "medio",
    patron: /\ben\s+mi\s+(?:[aá]rea|oficina|departamento|direcci[oó]n|turno|equipo|ventanilla|escuela|unidad)\b|\bdonde\s+(?:yo\s+)?(?:trabajo|laboro)\b/gi,
    consejo: "Nombra el área sin decir que es la tuya: «en la Dirección de Obras» en lugar de «en mi área».",
  },
  {
    tipo: "antiguedad",
    titulo: "Dices cuánto tiempo llevas en el lugar",
    nivel: "medio",
    patron: /\b(?:llevo|tengo|cumpl[ií])\s+(?:\w+\s+)?(?:\d+|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte)\s+(?:años?|meses)\s+(?:trabajando|laborando|en\s+(?:el|la|esta|este))\b[^.;\n]{0,30}/gi,
    consejo: "La antigüedad ayuda a identificarte en una plantilla. Puedes omitirla.",
  },
  {
    tipo: "presencia",
    titulo: "Dices la hora exacta en que estabas presente",
    nivel: "medio",
    patron: /\b(?:yo\s+)?(?:estaba|estuve|me encontraba|llegu[eé]|entr[eé]|sal[ií]|presenci[eé]|vi|escuch[eé]|me citaron|me cit[oó]|me recibi[oó]|me atendi[oó])\b[^.;\n]{0,70}?\b(?:a\s+las?\s+\d{1,2}(?:[:.]\d{2})?(?:\s?(?:am|pm|a\.\s?m\.|p\.\s?m\.|hrs?|horas))?|\d{1,2}[:.]\d{2}\s?(?:am|pm|hrs?|horas)?)/gi,
    consejo: "Una hora exacta junto a tu presencia permite ubicarte en bitácoras o cámaras. Usa «por la mañana» o «a mediodía».",
  },
  {
    tipo: "trato_directo",
    titulo: "Describes algo que te dijeron o pidieron solo a ti",
    nivel: "medio",
    patron: /\bme\s+(?:pidi[oó]|dijo|exigi[oó]|ofreci[oó]|entreg[oó]|orden[oó]|amenaz[oó])\b[^.;\n]{0,60}\b(?:en\s+privado|a\s+solas|en\s+su\s+oficina|por\s+(?:whatsapp|mensaje|tel[eé]fono|llamada))\b/gi,
    consejo: "Si la conversación fue a solas, la otra persona sabrá que fuiste tú. Valora si puedes describir el hecho sin esa escena, o aportar una evidencia que no dependa de tu testimonio.",
  },
] satisfies Regla[]).map((r) => ({ ...r, patron: conLimitesUnicode(r.patron) }));

export interface AnalisisRelato {
  nivel: NivelRiesgo;
  hallazgos: HallazgoRelato[];
  resumen: string;
}

export function analizarRelato(texto: string): AnalisisRelato {
  const hallazgos: (HallazgoRelato & { orden: number })[] = [];
  for (const [orden, r] of REGLAS.entries()) {
    r.patron.lastIndex = 0;
    for (const m of texto.matchAll(r.patron)) {
      const fragmento = m[0].trim();
      if (!fragmento) continue;
      const inicio = m.index ?? 0;
      hallazgos.push({ tipo: r.tipo, titulo: r.titulo, nivel: r.nivel, fragmento, inicio, fin: inicio + m[0].length, consejo: r.consejo, orden });
    }
  }
  // Si dos reglas marcan el mismo tramo, queda la de mayor nivel (o la primera).
  // Entre reglas del mismo nivel gana la que aparece antes en la lista (la más específica).
  const peso = (h: { nivel: string }) => (h.nivel === "alto" ? 0 : 1);
  hallazgos.sort((a, b) => a.inicio - b.inicio || peso(a) - peso(b) || a.orden - b.orden);
  const sinSolape: HallazgoRelato[] = [];
  for (const { orden: _orden, ...h } of hallazgos) {
    void _orden;
    const previo = sinSolape[sinSolape.length - 1];
    if (previo && h.inicio < previo.fin) {
      if (h.nivel === "alto" && previo.nivel === "medio") sinSolape[sinSolape.length - 1] = h;
      continue;
    }
    sinSolape.push(h);
  }
  const altos = sinSolape.filter((h) => h.nivel === "alto").length;
  const medios = sinSolape.length - altos;
  const nivel: NivelRiesgo = altos ? "alto" : medios >= 2 ? "medio" : medios ? "medio" : "bajo";
  const resumen =
    nivel === "bajo"
      ? "No encontramos frases que te identifiquen."
      : nivel === "alto"
        ? `Hay ${altos} frase${altos === 1 ? "" : "s"} que puede${altos === 1 ? "" : "n"} identificarte${medios ? ` y ${medios} más que conviene revisar` : ""}.`
        : `Hay ${medios} frase${medios === 1 ? "" : "s"} que conviene revisar.`;
  return { nivel, hallazgos: sinSolape, resumen };
}
