import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ErrorServicio } from "./servicio";

/** Respuestas sin caché: nada de esto debe quedar guardado en un proxy o en el navegador. */
export const SIN_CACHE = { "Cache-Control": "no-store" } as const;

export const ok = (datos: unknown, estado = 200) => NextResponse.json(datos, { status: estado, headers: SIN_CACHE });

export function fallo(e: unknown) {
  if (e instanceof ErrorServicio) return NextResponse.json({ error: e.message }, { status: e.estado, headers: SIN_CACHE });
  if (e instanceof ZodError) {
    const primero = e.issues[0];
    return NextResponse.json(
      { error: primero?.message ?? "Datos no válidos.", campo: primero?.path.join(".") },
      { status: 400, headers: SIN_CACHE },
    );
  }
  // El detalle queda en el registro del servidor, sin datos de la petición.
  console.error("error_interno", e instanceof Error ? e.message : "desconocido");
  return NextResponse.json({ error: "Ocurrió un error. Inténtalo de nuevo." }, { status: 500, headers: SIN_CACHE });
}
