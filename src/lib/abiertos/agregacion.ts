/**
 * Datos abiertos del sistema de denuncias que no delatan a nadie.
 *
 * Publicar "1 denuncia por nepotismo en el municipio X en octubre" equivale a publicar la
 * denuncia: en un ente chico, la persona denunciada deduce quién fue. Por eso:
 *
 * 1. Nunca se publican filas por denuncia, relatos, nombres ni folios.
 * 2. El tiempo se agrega por mes y el territorio por entidad federativa.
 * 3. Supresión primaria: toda celda con menos de K denuncias se publica sin valor.
 * 4. Supresión por diferencia: si una tabla tiene celdas suprimidas, sus totales se
 *    redondean al múltiplo de K más cercano, para que no se puedan despejar restando.
 *
 * K es 5 por defecto (SICODE_K_ANONIMATO). Es un piso, no una garantía absoluta: quien
 * publique debe revisar además que una combinación de tablas no acote a un grupo pequeño.
 */
import { CONDUCTA_POR_CLAVE, ENTIDADES } from "../catalogos";
import { ESTADOS, type Denuncia } from "../tipos";

export const K_DEFECTO = 5;

export interface Celda {
  valor: number | null;
  suprimida: boolean;
}

export interface Tabla {
  id: string;
  titulo: string;
  descripcion: string;
  columnas: { clave: string; titulo: string; tipo: "texto" | "entero" | "numero" }[];
  filas: Record<string, string | number | null>[];
  /** Cuántas celdas se ocultaron y si el total se redondeó. */
  proteccion: { celdasSuprimidas: number; totalRedondeado: boolean };
}

export interface ConjuntoAbierto {
  generado: string;
  k: number;
  totalDenuncias: Celda;
  tablas: Tabla[];
}

const contar = <T,>(lista: T[], clave: (x: T) => string | undefined): Map<string, number> => {
  const m = new Map<string, number>();
  for (const x of lista) {
    const k = clave(x);
    if (k === undefined) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
};

export function proteger(n: number, k: number): Celda {
  return n > 0 && n < k ? { valor: null, suprimida: true } : { valor: n, suprimida: false };
}

const redondear = (n: number, k: number) => Math.round(n / k) * k;

/** Tabla de una dimensión con su total protegido. */
function tablaConteo(
  id: string,
  titulo: string,
  descripcion: string,
  dimension: { clave: string; titulo: string },
  conteos: Map<string, number>,
  etiqueta: (clave: string) => string,
  k: number,
  orden: "valor" | "clave" = "valor",
): Tabla {
  const entradas = [...conteos.entries()].sort((a, b) => (orden === "valor" ? b[1] - a[1] : a[0].localeCompare(b[0])));
  let suprimidas = 0;
  const filas: Tabla["filas"] = entradas.map(([clave, n]) => {
    const c = proteger(n, k);
    if (c.suprimida) suprimidas++;
    return { [dimension.clave]: etiqueta(clave), denuncias: c.valor, nota: c.suprimida ? `menos de ${k}` : null };
  });
  const total = entradas.reduce((s, [, n]) => s + n, 0);
  const totalPublicado = suprimidas ? redondear(total, k) : total;
  filas.push({
    [dimension.clave]: "Total",
    denuncias: total > 0 && total < k ? null : totalPublicado,
    nota: total > 0 && total < k ? `menos de ${k}` : suprimidas ? `redondeado a múltiplos de ${k}` : null,
  });
  return {
    id,
    titulo,
    descripcion,
    columnas: [
      { clave: dimension.clave, titulo: dimension.titulo, tipo: "texto" },
      { clave: "denuncias", titulo: "Denuncias", tipo: "entero" },
      { clave: "nota", titulo: "Nota de protección", tipo: "texto" },
    ],
    filas,
    proteccion: { celdasSuprimidas: suprimidas, totalRedondeado: suprimidas > 0 },
  };
}

const mediana = (v: number[]) => {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

const dias = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000));

export function construirDatosAbiertos(denuncias: Denuncia[], k = K_DEFECTO, hoy = new Date()): ConjuntoAbierto {
  const tablas: Tabla[] = [];

  tablas.push(
    tablaConteo(
      "por_mes",
      "Denuncias recibidas por mes",
      "Mes de recepción. No se publica el día.",
      { clave: "mes", titulo: "Mes" },
      contar(denuncias, (d) => d.fechaRecepcion.slice(0, 7)),
      (c) => c,
      k,
      "clave",
    ),
  );

  tablas.push(
    tablaConteo(
      "por_estado_tramite",
      "Denuncias por estado del trámite",
      "Situación actual de cada denuncia en el flujo de atención.",
      { clave: "estado_tramite", titulo: "Estado del trámite" },
      contar(denuncias, (d) => d.status),
      (c) => ESTADOS[c as keyof typeof ESTADOS]?.etiqueta ?? c,
      k,
    ),
  );

  tablas.push(
    tablaConteo(
      "por_entidad",
      "Denuncias por entidad federativa",
      "Entidad donde ocurrieron los hechos. No se publica municipio ni ente público.",
      { clave: "entidad", titulo: "Entidad federativa" },
      contar(denuncias, (d) => d.lugar.entidad ?? "NE"),
      (c) => ENTIDADES[c] ?? "No especificada",
      k,
    ),
  );

  // Una denuncia puede marcar varias conductas: los renglones no suman el total de denuncias.
  const porConducta = new Map<string, number>();
  for (const d of denuncias) {
    for (const c of d.conductas.length ? d.conductas : ["SIN_MARCAR"]) porConducta.set(c, (porConducta.get(c) ?? 0) + 1);
  }
  const conductas = tablaConteo(
    "por_conducta",
    "Denuncias por tipo de conducta",
    "Conducta marcada por quien denuncia. Una denuncia puede marcar varias, así que los renglones no suman el total.",
    { clave: "conducta", titulo: "Conducta" },
    porConducta,
    (c) => CONDUCTA_POR_CLAVE.get(c)?.titulo ?? "Sin marcar",
    k,
  );
  conductas.filas.pop(); // sin renglón de total: sería engañoso
  tablas.push(conductas);

  tablas.push(
    tablaConteo(
      "por_modalidad",
      "Denuncias anónimas y con datos de contacto",
      "Proporción de personas que eligieron denunciar sin dejar datos.",
      { clave: "modalidad", titulo: "Modalidad" },
      contar(denuncias, (d) => (d.anonimo ? "anonima" : "con_contacto")),
      (c) => (c === "anonima" ? "Anónima" : "Con datos de contacto"),
      k,
    ),
  );

  tablas.push(
    tablaConteo(
      "por_corroboracion",
      "Denuncias por nivel de respaldo en datos públicos",
      "Resultado del cruce con los sistemas de la PDN. No indica si la denuncia es cierta.",
      { clave: "nivel", titulo: "Nivel de respaldo" },
      contar(denuncias, (d) => d.corroboracion?.semaforo.color ?? "sin_corroborar"),
      (c) =>
        ({ rojo: "Respaldo fuerte", amarillo: "Respaldo parcial", verde: "Sin respaldo en las fuentes", sin_corroborar: "Aún sin corroborar" })[c] ?? c,
      k,
    ),
  );

  // Tiempos de atención por autoridad: solo autoridades con K o más denuncias cerradas.
  const cerradas = denuncias.filter((d) => (d.status === "ATENDIDA" || d.status === "IMPROCEDENTE") && d.institucionActual);
  const porAutoridad = new Map<string, number[]>();
  for (const d of cerradas) {
    const lista = porAutoridad.get(d.institucionActual!) ?? [];
    lista.push(dias(d.fechaRecepcion, d.fechaActualizacion));
    porAutoridad.set(d.institucionActual!, lista);
  }
  let ocultas = 0;
  const filasTiempo: Tabla["filas"] = [];
  for (const [autoridad, lista] of [...porAutoridad.entries()].sort((a, b) => b[1].length - a[1].length)) {
    if (lista.length < k) {
      ocultas++;
      continue;
    }
    filasTiempo.push({ autoridad, denuncias_cerradas: lista.length, mediana_dias: mediana(lista) });
  }
  if (ocultas) filasTiempo.push({ autoridad: `Otras autoridades (${ocultas}) con menos de ${k} denuncias cerradas`, denuncias_cerradas: null, mediana_dias: null });
  tablas.push({
    id: "tiempos_por_autoridad",
    titulo: "Tiempo de atención por autoridad",
    descripcion: `Mediana de días entre la recepción y el cierre. Solo autoridades con ${k} o más denuncias cerradas.`,
    columnas: [
      { clave: "autoridad", titulo: "Autoridad", tipo: "texto" },
      { clave: "denuncias_cerradas", titulo: "Denuncias cerradas", tipo: "entero" },
      { clave: "mediana_dias", titulo: "Mediana de días", tipo: "numero" },
    ],
    filas: filasTiempo,
    proteccion: { celdasSuprimidas: ocultas, totalRedondeado: false },
  });

  return {
    generado: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(hoy),
    k,
    totalDenuncias: proteger(denuncias.length, k),
    tablas,
  };
}

export function aCsv(t: Tabla): string {
  const celda = (v: string | number | null) => {
    if (v === null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    t.columnas.map((c) => c.clave).join(","),
    ...t.filas.map((f) => t.columnas.map((c) => celda(f[c.clave] ?? null)).join(",")),
  ].join("\n") + "\n";
}

/** Descriptor Frictionless Data Package: permite reutilizar el conjunto sin leer documentación. */
export function descriptor(c: ConjuntoAbierto, base: string) {
  return {
    name: "sicode-denuncias-agregadas",
    title: "Denuncias por faltas administrativas y hechos de corrupción: datos agregados",
    description:
      `Tablas agregadas generadas por SICODE. Las celdas con menos de ${c.k} denuncias se publican sin valor ` +
      `y los totales afectados se redondean a múltiplos de ${c.k} para proteger la identidad de quienes denuncian.`,
    created: c.generado,
    licenses: [{ name: "CC-BY-4.0", title: "Creative Commons Atribución 4.0", path: "https://creativecommons.org/licenses/by/4.0/deed.es" }],
    resources: c.tablas.map((t) => ({
      name: t.id.replace(/_/g, "-"),
      title: t.titulo,
      description: t.descripcion,
      path: `${base}/api/abiertos/${t.id}.csv`,
      format: "csv",
      mediatype: "text/csv",
      encoding: "utf-8",
      schema: {
        fields: t.columnas.map((col) => ({
          name: col.clave,
          title: col.titulo,
          type: col.tipo === "texto" ? "string" : col.tipo === "entero" ? "integer" : "number",
        })),
        missingValues: [""],
      },
    })),
  };
}
