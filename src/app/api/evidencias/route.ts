import { fallo, ok } from "@/lib/http";
import { LIMITE_ARCHIVO } from "@/lib/esquema";
import { ErrorServicio, recibirEvidencia } from "@/lib/servicio";

export async function POST(peticion: Request) {
  try {
    const formulario = await peticion.formData();
    const archivo = formulario.get("archivo");
    if (!(archivo instanceof File)) throw new ErrorServicio("No se recibió ningún archivo.");
    if (archivo.size > LIMITE_ARCHIVO) throw new ErrorServicio("El archivo pasa de 15 MB.", 413);
    return ok(await recibirEvidencia(new Uint8Array(await archivo.arrayBuffer()), archivo.name), 201);
  } catch (e) {
    return fallo(e);
  }
}
