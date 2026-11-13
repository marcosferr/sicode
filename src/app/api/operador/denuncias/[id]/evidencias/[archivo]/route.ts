import { operadorActual } from "@/lib/auth";
import { fallo } from "@/lib/http";
import { leerEvidencia } from "@/lib/servicio";

export async function GET(_p: Request, { params }: { params: Promise<{ id: string; archivo: string }> }) {
  try {
    await operadorActual();
    const { id, archivo } = await params;
    const a = await leerEvidencia(id, archivo);
    return new Response(Buffer.from(a.bytes), {
      headers: {
        "Content-Type": a.tipo,
        "Content-Disposition": `attachment; filename="${a.nombre}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return fallo(e);
  }
}
