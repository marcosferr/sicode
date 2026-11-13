import { nuevoReto } from "@/lib/antibot";
import { fallo, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await nuevoReto());
  } catch (e) {
    return fallo(e);
  }
}
