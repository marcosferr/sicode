/**
 * Crea en Directus las colecciones que usa SICODE. Se puede ejecutar varias veces.
 *   npm run directus
 * Lee DIRECTUS_URL y DIRECTUS_TOKEN de .env.local.
 *
 * Las colecciones no tienen permisos públicos: solo se accede con el token del servidor.
 */
process.loadEnvFile?.(".env.local");

const URL_BASE = process.env.DIRECTUS_URL ?? "http://localhost:8055";
const TOKEN = process.env.DIRECTUS_TOKEN;
if (!TOKEN) {
  console.error("Falta DIRECTUS_TOKEN en .env.local (use el ADMIN_TOKEN de .env.directus).");
  process.exit(1);
}

async function api(metodo: string, ruta: string, cuerpo?: unknown) {
  const r = await fetch(URL_BASE + ruta, {
    method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { ok: r.ok, estado: r.status, json: (await r.json().catch(() => ({}))) as { errors?: { message: string }[] } };
}

const texto = (campo: string, extra: Record<string, unknown> = {}) => ({ field: campo, type: "string", schema: {}, meta: {}, ...extra });

const COLECCIONES = [
  {
    collection: "sicode_denuncias",
    meta: { icon: "shield", note: "Denuncias de SICODE. El documento completo va en «datos»; el contacto va cifrado." },
    schema: {},
    fields: [
      { field: "id", type: "string", schema: { is_primary_key: true, max_length: 32 }, meta: { readonly: true } },
      texto("folio", { schema: { is_unique: true, max_length: 32 } }),
      texto("status", { schema: { max_length: 20 } }),
      { field: "fecha_recepcion", type: "date", schema: {}, meta: { note: "Solo el día: la hora no se guarda." } },
      { field: "anonimo", type: "boolean", schema: {}, meta: {} },
      texto("prioridad", { schema: { max_length: 10, is_nullable: true } }),
      texto("semaforo", { schema: { max_length: 10, is_nullable: true } }),
      { field: "datos", type: "json", schema: {}, meta: { interface: "input-code", options: { language: "json" } } },
    ],
  },
  {
    collection: "sicode_archivos",
    meta: { icon: "attach_file", note: "Evidencias ya limpias de metadatos, con nombre genérico." },
    schema: {},
    fields: [
      { field: "id", type: "string", schema: { is_primary_key: true, max_length: 32 }, meta: { readonly: true } },
      texto("nombre"),
      texto("tipo"),
      { field: "contenido", type: "text", schema: {}, meta: { hidden: true } },
    ],
  },
];

async function main() {
  const salud = await api("GET", "/server/ping").catch(() => null);
  if (!salud?.ok) throw new Error(`Directus no responde en ${URL_BASE}. ¿Ejecutó «docker compose up -d»?`);
  for (const c of COLECCIONES) {
    const existe = await api("GET", `/collections/${c.collection}`);
    if (existe.ok) {
      console.log(`${c.collection}: ya existe`);
      continue;
    }
    const r = await api("POST", "/collections", c);
    if (!r.ok) throw new Error(`${c.collection}: ${r.estado} ${r.json.errors?.[0]?.message ?? ""}`);
    console.log(`${c.collection}: creada`);
  }
  console.log("Listo. Ponga SICODE_ALMACEN=directus en .env.local y reinicie el servidor.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
