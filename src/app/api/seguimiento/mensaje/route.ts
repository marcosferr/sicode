import { z } from "zod";
import { fallo, ok } from "@/lib/http";
import { responderComoDenunciante } from "@/lib/servicio";

const esquema = z.object({ folio: z.string().max(40), clave: z.string().max(60), texto: z.string().max(4000) });

export async function POST(peticion: Request) {
  try {
    const { folio, clave, texto } = esquema.parse(await peticion.json());
    return ok(await responderComoDenunciante(folio, clave, texto));
  } catch (e) {
    return fallo(e);
  }
}
