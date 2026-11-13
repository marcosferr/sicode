/**
 * Acceso real a la PDN.
 *
 * - S3 (sancionados) y S2 (servidores en contrataciones): índices locales armados por
 *   `npm run datos`. Ninguna consulta sale del servidor.
 * - S6 (contrataciones, 1 GB) y S1 (declaraciones, 4,8 GB): API pública con caché en disco.
 *   Las consultas van desde el servidor, nunca desde el navegador de quien denuncia.
 *
 * Las API de la PDN distinguen acentos y no filtran de forma fiable por comprador, así
 * que aquí solo se hace una búsqueda amplia; la coincidencia fina la decide el motor.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { claveEmpresa, dice, normalizar, quitarAcentos, similitud, tokens, type NombrePersona } from "../texto";
import { aContratoS6, aDeclaracionS1 } from "./convertir";
import type {
  ContratoS6,
  DeclaracionS1,
  FuentesPDN,
  ResultadoFuente,
  ResumenEnte,
  SancionParticular,
  SancionServidor,
  ServidorContrataciones,
} from "./tipos";

const API = "https://api.plataformadigitalnacional.org";
const DIR_PDN = () => path.join(process.env.RS_DIR_DATOS ?? path.join(process.cwd(), "var"), "pdn");
const DIR_CACHE = () => path.join(process.env.RS_DIR_DATOS ?? path.join(process.cwd(), "var"), "cache");
const TTL_CACHE_MS = 7 * 24 * 3600 * 1000;

/* ---------- Índices locales ---------- */

interface IndiceS3 {
  servidores: SancionServidor[];
  particulares: SancionParticular[];
  entes: ResumenEnte[];
}

let s3: Promise<IndiceS3 | null> | null = null;
let s2: Promise<Map<string, ServidorContrataciones[]> | null> | null = null;

function cargarS3(): Promise<IndiceS3 | null> {
  s3 ??= (async () => {
    const ruta = path.join(DIR_PDN(), "s3.json");
    if (!existsSync(ruta)) return null;
    return JSON.parse(await readFile(ruta, "utf8")) as IndiceS3;
  })();
  return s3;
}

/** Índice del S2 por primer apellido normalizado: 64 mil filas se recorren en milisegundos. */
function cargarS2(): Promise<Map<string, ServidorContrataciones[]> | null> {
  s2 ??= (async () => {
    const ruta = path.join(DIR_PDN(), "s2.jsonl");
    if (!existsSync(ruta)) return null;
    const mapa = new Map<string, ServidorContrataciones[]>();
    for (const linea of (await readFile(ruta, "utf8")).split("\n")) {
      if (!linea) continue;
      const fila = JSON.parse(linea) as ServidorContrataciones;
      const clave = normalizar(fila.persona.primerApellido);
      if (!clave) continue;
      const lista = mapa.get(clave);
      if (lista) lista.push(fila);
      else mapa.set(clave, [fila]);
    }
    return mapa;
  })();
  return s2;
}

export async function estadoIndices(): Promise<{ s3: boolean; s2: boolean; manifiesto?: unknown }> {
  const ruta = path.join(DIR_PDN(), "manifiesto.json");
  return {
    s3: existsSync(path.join(DIR_PDN(), "s3.json")),
    s2: existsSync(path.join(DIR_PDN(), "s2.jsonl")),
    manifiesto: existsSync(ruta) ? JSON.parse(await readFile(ruta, "utf8")) : undefined,
  };
}

/* ---------- API con caché ---------- */

async function pedir<T>(url: string, cuerpo?: unknown, o: { ms?: number; intentos?: number } = {}): Promise<T> {
  const clave = createHash("sha256").update(url + JSON.stringify(cuerpo ?? null)).digest("hex");
  const archivo = path.join(DIR_CACHE(), clave + ".json");
  if (existsSync(archivo)) {
    const guardado = JSON.parse(await readFile(archivo, "utf8")) as { t: number; d: T };
    if (Date.now() - guardado.t < TTL_CACHE_MS) return guardado.d;
  }
  let ultimo: unknown;
  for (let intento = 0; intento < (o.intentos ?? 2); intento++) {
    try {
      const r = await fetch(url, {
        method: cuerpo ? "POST" : "GET",
        headers: { "Content-Type": "application/json", "User-Agent": "resguardo-s5" },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        signal: AbortSignal.timeout(o.ms ?? 20_000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as T;
      await mkdir(DIR_CACHE(), { recursive: true });
      await writeFile(archivo, JSON.stringify({ t: Date.now(), d }));
      return d;
    } catch (e) {
      ultimo = e;
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error(String(ultimo));
}

async function medir<T>(
  modo: "local" | "api",
  f: () => Promise<{ datos: T[]; truncado?: boolean; detalle?: string } | null>,
  sinIndice = "Falta el índice local: ejecute `npm run datos`.",
): Promise<ResultadoFuente<T>> {
  const t0 = Date.now();
  try {
    const r = await f();
    if (r === null) return { datos: [], modo, estado: "no_accesible", ms: Date.now() - t0, detalle: sinIndice };
    return { ...r, modo, estado: r.datos.length ? "ok" : "sin_resultados", ms: Date.now() - t0 };
  } catch (e) {
    return {
      datos: [],
      modo,
      estado: "no_accesible",
      ms: Date.now() - t0,
      detalle: e instanceof Error ? e.message : String(e),
    };
  }
}

const GENERICAS = new Set([
  "GRUPO", "SERVICIOS", "SERVICIO", "CONSTRUCTORA", "CONSTRUCCIONES", "COMERCIALIZADORA", "DISTRIBUIDORA",
  "MEXICO", "MEXICANA", "INDUSTRIAL", "INDUSTRIAS", "SOLUCIONES", "CONSULTORES", "CONSULTORIA", "INGENIERIA",
  "PROVEEDORA", "OPERADORA", "EMPRESA", "EMPRESAS", "INTEGRALES", "INTEGRAL", "NACIONAL", "CENTRO", "SISTEMAS",
  "TECNOLOGIA", "TECNOLOGIAS", "FARMACEUTICOS", "MEDICA", "MEDICOS", "ASOCIADOS", "CORPORATIVO", "SUMINISTROS",
]);

/**
 * Palabras distintivas de una razón social, de la más a la menos prometedora.
 * La API del S6 devuelve cualquier registro que contenga alguna de las palabras buscadas,
 * así que conviene buscar por una sola palabra poco común.
 */
export function palabrasDistintivas(razonSocial: string): string[] {
  const candidatas = tokens(claveEmpresa(razonSocial), true).filter((t) => t.length >= 4);
  const propias = candidatas.filter((t) => !GENERICAS.has(t));
  return (propias.length ? propias : candidatas).slice(0, 3);
}

export function palabraDistintiva(razonSocial: string): string | null {
  return palabrasDistintivas(razonSocial)[0] ?? null;
}

export class FuentesReales implements FuentesPDN {
  sancionesServidor(p: NombrePersona) {
    return medir<SancionServidor>("local", async () => {
      const i = await cargarS3();
      if (!i) return null;
      const ap = normalizar(p.primerApellido);
      return {
        datos: i.servidores.filter((s) => dice(normalizar(s.persona.primerApellido), ap) >= 0.85),
      };
    });
  }

  sancionesParticular(q: { razonSocial?: string; rfc?: string; persona?: NombrePersona }) {
    return medir<SancionParticular>("local", async () => {
      const i = await cargarS3();
      if (!i) return null;
      const rfc = q.rfc?.toUpperCase().trim();
      const clave = q.razonSocial ? claveEmpresa(q.razonSocial) : "";
      const ap = normalizar(q.persona?.primerApellido);
      return {
        datos: i.particulares.filter((s) => {
          if (s.tipo === "MORAL") {
            if (rfc && s.rfc && s.rfc.toUpperCase() === rfc) return true;
            return Boolean(clave && s.razonSocial && similitud(claveEmpresa(s.razonSocial), clave) >= 0.7);
          }
          return Boolean(ap && dice(normalizar(s.persona?.primerApellido), ap) >= 0.85);
        }),
      };
    });
  }

  sancionesEnte(ente: string, entidadFederativa?: string) {
    return medir<ResumenEnte>("local", async () => {
      const i = await cargarS3();
      if (!i) return null;
      const objetivo = normalizar(ente);
      const datos = i.entes
        .map((e) => ({ e, s: similitud(e.ente, objetivo), misma: entidadFederativa && e.entidadFederativa === entidadFederativa ? 1 : 0 }))
        .filter((x) => x.s >= 0.8)
        .sort((a, b) => b.misma - a.misma || b.s - a.s)
        .slice(0, 3)
        .map((x) => x.e);
      return { datos };
    });
  }

  servidoresContrataciones(p: NombrePersona) {
    return medir<ServidorContrataciones>("local", async () => {
      const i = await cargarS2();
      if (!i) return null;
      return { datos: i.get(normalizar(p.primerApellido)) ?? [] };
    });
  }

  contratosProveedor(q: { razonSocial?: string; rfc?: string }) {
    return medir<ContratoS6>("api", async () => {
      const palabras = q.razonSocial ? palabrasDistintivas(q.razonSocial) : [];
      if (!palabras.length) return { datos: [], detalle: "Sin una razón social utilizable para buscar." };
      // Ojo: esta API numera las páginas desde 0.
      type Respuesta = { pagination: { total: number }; data: Record<string, unknown>[] };
      const buscar = (palabra: string, page: number, pageSize: number) =>
        pedir<Respuesta>(`${API}/s6/api/v1/search`, { page, pageSize, supplierName: palabra });

      // La API distingue acentos: se sondean las dos escrituras de cada palabra y se elige
      // la búsqueda más acotada que sí tenga resultados.
      const variantes = [...new Set(palabras.flatMap((p) => [p, quitarAcentos(p)]))];
      const sondeos = await Promise.allSettled(variantes.map(async (v) => ({ v, total: (await buscar(v, 0, 1)).pagination.total })));
      const utiles = sondeos
        .flatMap((r) => (r.status === "fulfilled" && r.value.total > 0 ? [r.value] : []))
        .sort((x, y) => x.total - y.total);
      if (!utiles.length) {
        if (sondeos.every((r) => r.status === "rejected")) throw new Error("La API del S6 no respondió.");
        return { datos: [] };
      }
      const { v, total } = utiles[0];
      const PAGINAS = 6;
      const paginas = Math.min(PAGINAS, Math.ceil(total / 50));
      const respuestas = await Promise.all(Array.from({ length: paginas }, (_, i) => buscar(v, i, 50)));
      const porOcid = new Map<string, ContratoS6>();
      for (const r of respuestas) {
        for (const c of r.data ?? []) {
          const k = aContratoS6(c);
          if (k.ocid) porOcid.set(k.ocid, k);
        }
      }
      return { datos: [...porOcid.values()], truncado: total > PAGINAS * 50 };
    }, "");
  }

  declaraciones(p: NombrePersona) {
    return medir<DeclaracionS1>("api", async () => {
      if (!p.primerApellido || !p.nombres) {
        return { datos: [], detalle: "Se necesita nombre y primer apellido para buscar declaraciones." };
      }
      const proveedores = await pedir<{ supplier_id: string; status: string }[]>(`${API}/s1/v1/providers`);
      const activos = proveedores.filter((x) => x.status === "ACTIVE");
      const consulta = {
        nombres: normalizar(p.nombres),
        primerApellido: normalizar(p.primerApellido),
        ...(p.segundoApellido ? { segundoApellido: normalizar(p.segundoApellido) } : {}),
      };
      const respuestas = await Promise.allSettled(
        activos.map(async (prov) => {
          const r = await pedir<{ results?: Record<string, unknown>[] }>(
            `${API}/s1/v1/search`,
            { page: 1, pageSize: 10, query: consulta, supplier_id: prov.supplier_id },
            { ms: 10_000, intentos: 1 },
          );
          return (r.results ?? []).map((c) => aDeclaracionS1(c, prov.supplier_id));
        }),
      );
      const datos = respuestas.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      const caidos = respuestas.filter((r) => r.status === "rejected").length;
      return {
        datos,
        detalle: caidos ? `${caidos} de ${activos.length} proveedores de declaraciones no respondieron.` : undefined,
      };
    }, "");
  }
}

/** Fuentes en memoria: pruebas y modo demostración sin red. */
export class FuentesEnMemoria implements FuentesPDN {
  constructor(
    private d: {
      servidores?: SancionServidor[];
      particulares?: SancionParticular[];
      entes?: ResumenEnte[];
      s2?: ServidorContrataciones[];
      contratos?: ContratoS6[];
      declaraciones?: DeclaracionS1[];
      caidas?: ("S1" | "S6")[];
    },
  ) {}

  private r<T>(datos: T[], modo: "local" | "api" = "local"): ResultadoFuente<T> {
    return { datos, modo, estado: datos.length ? "ok" : "sin_resultados", ms: 1 };
  }

  async sancionesServidor(p: NombrePersona) {
    const ap = normalizar(p.primerApellido);
    return this.r((this.d.servidores ?? []).filter((s) => dice(normalizar(s.persona.primerApellido), ap) >= 0.85));
  }
  async sancionesParticular(q: { razonSocial?: string; rfc?: string; persona?: NombrePersona }) {
    const clave = q.razonSocial ? claveEmpresa(q.razonSocial) : "";
    return this.r(
      (this.d.particulares ?? []).filter((s) =>
        s.tipo === "MORAL"
          ? (q.rfc && s.rfc === q.rfc.toUpperCase()) ||
            Boolean(clave && s.razonSocial && similitud(claveEmpresa(s.razonSocial), clave) >= 0.7)
          : Boolean(q.persona?.primerApellido) &&
            dice(normalizar(s.persona?.primerApellido), normalizar(q.persona?.primerApellido)) >= 0.85,
      ),
    );
  }
  async sancionesEnte(ente: string) {
    return this.r((this.d.entes ?? []).filter((e) => similitud(e.ente, ente) >= 0.8));
  }
  async servidoresContrataciones(p: NombrePersona) {
    const ap = normalizar(p.primerApellido);
    return this.r((this.d.s2 ?? []).filter((s) => normalizar(s.persona.primerApellido) === ap));
  }
  async contratosProveedor(q: { razonSocial?: string; rfc?: string }): Promise<ResultadoFuente<ContratoS6>> {
    if (this.d.caidas?.includes("S6"))
      return { datos: [], modo: "api", estado: "no_accesible", ms: 1, detalle: "API no disponible" };
    const palabra = q.razonSocial ? palabraDistintiva(q.razonSocial) : null;
    return this.r(
      (this.d.contratos ?? []).filter((c) =>
        [...c.proveedores, ...c.oferentes].some(
          (x) => (q.rfc && x.id === q.rfc.toUpperCase()) || (palabra && normalizar(x.nombre).includes(palabra)),
        ),
      ),
      "api",
    );
  }
  async declaraciones(p: NombrePersona): Promise<ResultadoFuente<DeclaracionS1>> {
    if (this.d.caidas?.includes("S1"))
      return { datos: [], modo: "api", estado: "no_accesible", ms: 1, detalle: "API no disponible" };
    const ap = normalizar(p.primerApellido);
    return this.r(
      (this.d.declaraciones ?? []).filter((x) => normalizar(x.persona.primerApellido) === ap),
      "api",
    );
  }
}
