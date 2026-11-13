import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PanelDenuncia } from "@/components/PanelDenuncia";
import { hayOperador } from "@/lib/auth";
import { modoDemo } from "@/lib/pdn/demo";
import { detalleParaOperador, ErrorServicio } from "@/lib/servicio";

export const metadata: Metadata = { title: "Detalle de denuncia" };
export const dynamic = "force-dynamic";

export default async function Detalle({ params }: { params: Promise<{ id: string }> }) {
  if (!(await hayOperador())) redirect("/operador");
  const { id } = await params;
  let denuncia;
  try {
    denuncia = await detalleParaOperador(id);
  } catch (e) {
    if (e instanceof ErrorServicio && e.estado === 404) notFound();
    throw e;
  }
  return (
    <div>
      <Link href="/operador/bandeja" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Volver a la bandeja
      </Link>
      <PanelDenuncia inicial={denuncia} demo={modoDemo()} />
    </div>
  );
}
