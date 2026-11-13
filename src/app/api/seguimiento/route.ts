import { z } from "zod";
import { verificarReto } from "@/lib/antibot";
import { fallo, ok } from "@/lib/http";
import { consultarSeguimiento, ErrorServicio } from "@/lib/servicio";

const esquema = z.object({ folio: z.string().max(40), clave: z.string().max(60), altcha: z.string().max(4000) });

export async function POST(peticion: Request) {
  try {
    const { folio, clave, altcha } = esquema.parse(await peticion.json());
    if (!(await verificarReto(altcha))) throw new ErrorServicio("Completa la verificación «No soy un robot».", 400);
    return ok(await consultarSeguimiento(folio, clave));
  } catch (e) {
    return fallo(e);
  }
}
