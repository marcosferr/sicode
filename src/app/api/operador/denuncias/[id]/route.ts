import { z } from "zod";
import { operadorActual } from "@/lib/auth";
import { fallo, ok } from "@/lib/http";
import { actualizarTramite, corroborarDenuncia, detalleParaOperador, escribirADenunciante, revelarContacto } from "@/lib/servicio";

// La corroboración consulta varias fuentes; la primera vez puede tardar medio minuto.
export const maxDuration = 120;

const esquema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("corroborar") }),
  z.object({
    accion: z.literal("tramite"),
    status: z.enum(["SIN_TURNAR", "TURNADA", "REGISTRADA", "EN_PROCESO", "ATENDIDA", "IMPROCEDENTE"]).optional(),
    institucionActual: z.string().max(200).optional(),
    prioridad: z.enum(["ALTA", "MEDIA", "BAJA"]).optional(),
    resumenPublicoCierre: z.string().max(2000).optional(),
  }),
  z.object({ accion: z.literal("mensaje"), texto: z.string().max(4000) }),
  z.object({ accion: z.literal("revelar_contacto"), motivo: z.string().max(1000) }),
]);

export async function GET(_p: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await operadorActual();
    return ok(await detalleParaOperador((await params).id));
  } catch (e) {
    return fallo(e);
  }
}

export async function POST(peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const operador = await operadorActual();
    const { id } = await params;
    const cuerpo = esquema.parse(await peticion.json());
    switch (cuerpo.accion) {
      case "corroborar":
        return ok(await corroborarDenuncia(id, operador));
      case "tramite": {
        const { accion: _a, ...cambio } = cuerpo;
        void _a;
        return ok(await actualizarTramite(id, operador, cambio));
      }
      case "mensaje":
        return ok(await escribirADenunciante(id, operador, cuerpo.texto));
      case "revelar_contacto":
        return ok({ contacto: await revelarContacto(id, operador, cuerpo.motivo), denuncia: await detalleParaOperador(id) });
    }
  } catch (e) {
    return fallo(e);
  }
}
