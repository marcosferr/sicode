import { aCsv, construirDatosAbiertos, descriptor, K_DEFECTO } from "@/lib/abiertos/agregacion";
import { almacen } from "@/lib/almacen";

export const dynamic = "force-dynamic";

const k = () => Math.max(2, Number(process.env.SICODE_K_ANONIMATO) || K_DEFECTO);

/** Datos abiertos: /api/abiertos/<tabla>.csv, /api/abiertos/<tabla>.json, todo.json y datapackage.json */
export async function GET(peticion: Request, { params }: { params: Promise<{ archivo: string }> }) {
  const { archivo } = await params;
  const conjunto = construirDatosAbiertos(await almacen().listar(), k());
  const comunes = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" };
  const json = (cuerpo: unknown) => Response.json(cuerpo, { headers: comunes });

  if (archivo === "todo.json") return json(conjunto);
  if (archivo === "datapackage.json") return json(descriptor(conjunto, new URL(peticion.url).origin));

  const m = archivo.match(/^([a-z_]+)\.(csv|json)$/);
  const tabla = m ? conjunto.tablas.find((t) => t.id === m[1]) : undefined;
  if (!m || !tabla) return Response.json({ error: "No existe ese recurso." }, { status: 404 });
  if (m[2] === "json") return json(tabla);
  return new Response("﻿" + aCsv(tabla), {
    headers: { ...comunes, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="sicode_${tabla.id}.csv"` },
  });
}
