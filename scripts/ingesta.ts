/**
 * Descarga los datos abiertos de sancionados (S3) y de servidores públicos en
 * contrataciones (S2) desde los enlaces oficiales de la PDN y arma índices locales.
 *
 *   npm run datos
 *
 * Cruzar en local importa para la confidencialidad: si el sistema consultara la API por
 * cada persona denunciada, quien opere esa API podría deducir que existe una denuncia.
 *
 * Los índices quedan en var/pdn/ (no se versionan) junto con un manifiesto que guarda la
 * URL, la fecha y el sha256 de cada archivo descargado.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { aSancionParticular, aSancionServidor, aServidorContrataciones } from "../src/lib/pdn/convertir";
import type { ResumenEnte, SancionParticular, SancionServidor, ServidorContrataciones } from "../src/lib/pdn/tipos";
import { normalizar } from "../src/lib/texto";

const FUENTES = {
  S3: { id: "1i-HjNju04xdKThHgGDAzHb97GdF_cqS8", archivo: "PDN_S3v2.zip", pagina: "https://www.plataformadigitalnacional.org/sancionados" },
  S2: { id: "1KWcst_YLI5YVlKnzmd3Xm5prAP4NVhAD", archivo: "PDN_S2.zip", pagina: "https://www.plataformadigitalnacional.org/servidores" },
} as const;

const DESTINO = path.join(process.cwd(), "var", "pdn");

async function descargar(id: string): Promise<{ bytes: Buffer; url: string }> {
  const url = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
  const r = await fetch(url, { headers: { "User-Agent": "resguardo-s5/ingesta" } });
  if (!r.ok) throw new Error(`Descarga fallida (${r.status}) de ${url}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.subarray(0, 2).toString() !== "PK") throw new Error(`La respuesta de ${url} no es un zip`);
  return { bytes, url };
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

function filas(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  const o = json as Record<string, unknown>;
  for (const k of ["results", "data", "items"]) if (Array.isArray(o?.[k])) return o[k] as Record<string, unknown>[];
  return [];
}

async function ingerirS3(bytes: Buffer) {
  const zip = await JSZip.loadAsync(bytes);
  const servidores: SancionServidor[] = [];
  const particulares: SancionParticular[] = [];
  const entes = new Map<string, ResumenEnte>();

  for (const [ruta, entrada] of Object.entries(zip.files)) {
    if (entrada.dir || !ruta.endsWith(".json")) continue;
    const [proveedor, coleccion] = ruta.split("/");
    const datos = filas(JSON.parse(await entrada.async("string")));
    for (const c of datos) {
      if (coleccion.includes("personas_morales")) {
        particulares.push(aSancionParticular(c, proveedor, "MORAL"));
        continue;
      }
      if (coleccion.includes("personas_fisicas")) {
        particulares.push(aSancionParticular(c, proveedor, "FISICA"));
        continue;
      }
      const grave = coleccion.includes("administrativas_graves");
      if (grave) {
        const s = aSancionServidor(c, proveedor);
        if (s) servidores.push(s);
      }
      // Resumen por ente: sirve como contexto aun cuando la sanción no publica el nombre.
      const e = (c.empleoCargoComision ?? {}) as Record<string, unknown>;
      const nombre = typeof e.nombreEntePublico === "string" ? e.nombreEntePublico.trim() : "";
      if (!nombre) continue;
      const clave = `${proveedor}|${normalizar(nombre)}`;
      const r =
        entes.get(clave) ??
        ({
          ente: nombre,
          entidadFederativa: typeof e.entidadFederativa === "string" ? e.entidadFederativa : undefined,
          proveedor,
          total: 0,
          graves: 0,
          noGraves: 0,
          porFalta: {},
        } satisfies ResumenEnte);
      r.total++;
      if (grave) r.graves++;
      else r.noGraves++;
      for (const f of (Array.isArray(c.faltaCometida) ? c.faltaCometida : []) as { clave?: string }[]) {
        const k = f.clave ?? "OTRO";
        r.porFalta[k] = (r.porFalta[k] ?? 0) + 1;
      }
      const anio = Number(String(c.fecha ?? "").slice(0, 4));
      if (anio > 1990) r.ultimoAnio = Math.max(r.ultimoAnio ?? 0, anio);
      entes.set(clave, r);
    }
  }
  await writeFile(path.join(DESTINO, "s3.json"), JSON.stringify({ servidores, particulares, entes: [...entes.values()] }));
  return { servidores: servidores.length, particulares: particulares.length, entes: entes.size };
}

async function ingerirS2(bytes: Buffer) {
  const zip = await JSZip.loadAsync(bytes);
  const vistos = new Map<string, ServidorContrataciones>();
  let leidos = 0;
  for (const [ruta, entrada] of Object.entries(zip.files)) {
    if (entrada.dir || !ruta.endsWith(".json")) continue;
    const proveedor = ruta.split("/").slice(-2)[0];
    for (const c of filas(JSON.parse(await entrada.async("string")))) {
      leidos++;
      const s = aServidorContrataciones(c, proveedor);
      if (!s) continue;
      const clave = [s.persona.nombres, s.persona.primerApellido, s.persona.segundoApellido, s.institucion, s.puesto]
        .map((x) => normalizar(x))
        .join("|");
      const previo = vistos.get(clave);
      if (!previo) {
        vistos.set(clave, s);
        continue;
      }
      // Misma persona y puesto en varios ejercicios: se conserva uno, con el ejercicio más reciente.
      previo.nivelesResponsabilidad = [...new Set([...previo.nivelesResponsabilidad, ...s.nivelesResponsabilidad])];
      previo.tiposProcedimiento = [...new Set([...previo.tiposProcedimiento, ...s.tiposProcedimiento])];
      if ((s.ejercicio ?? "") > (previo.ejercicio ?? "")) previo.ejercicio = s.ejercicio;
    }
  }
  const lineas = [...vistos.values()].map((s) => JSON.stringify(s)).join("\n");
  await writeFile(path.join(DESTINO, "s2.jsonl"), lineas);
  return { leidos, unicos: vistos.size };
}

async function main() {
  await mkdir(DESTINO, { recursive: true });
  const manifiesto: Record<string, unknown> = { generado: new Date().toISOString() };

  for (const [sistema, f] of Object.entries(FUENTES)) {
    process.stdout.write(`${sistema}: descargando ${f.archivo}… `);
    const { bytes, url } = await descargar(f.id);
    console.log(`${(bytes.length / 1e6).toFixed(1)} MB`);
    const conteos = sistema === "S3" ? await ingerirS3(bytes) : await ingerirS2(bytes);
    console.log(`${sistema}:`, conteos);
    manifiesto[sistema] = { url, pagina: f.pagina, archivo: f.archivo, sha256: sha256(bytes), bytes: bytes.length, conteos };
  }
  await writeFile(path.join(DESTINO, "manifiesto.json"), JSON.stringify(manifiesto, null, 2));
  console.log("Listo. Índices en var/pdn/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
