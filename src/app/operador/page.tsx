import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IngresoOperador } from "@/components/IngresoOperador";
import { Titulo } from "@/components/ui";
import { hayOperador } from "@/lib/auth";

export const metadata: Metadata = { title: "Acceso de autoridades" };
export const dynamic = "force-dynamic";

export default async function Operador() {
  if (await hayOperador()) redirect("/operador/bandeja");
  return (
    <div className="mx-auto max-w-md py-6">
      <Titulo descripcion="Para personas servidoras públicas que reciben y atienden denuncias.">Acceso de autoridades</Titulo>
      <IngresoOperador />
    </div>
  );
}
