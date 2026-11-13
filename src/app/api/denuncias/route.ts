import { verificarReto } from "@/lib/antibot";
import { esquemaDenuncia } from "@/lib/esquema";
import { fallo, ok } from "@/lib/http";
import { ErrorServicio, presentarDenuncia } from "@/lib/servicio";

// Esta ruta no lee encabezados de la petición: ni IP, ni navegador, ni idioma.
export async function POST(peticion: Request) {
  try {
    const entrada = esquemaDenuncia.parse(await peticion.json());
    if (!(await verificarReto(entrada.altcha))) throw new ErrorServicio("Completa la verificación «No soy un robot».", 400);
    return ok(await presentarDenuncia(entrada), 201);
  } catch (e) {
    return fallo(e);
  }
}
