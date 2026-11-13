import type { Metadata } from "next";
import { Seguimiento } from "@/components/Seguimiento";
import { Titulo } from "@/components/ui";

export const metadata: Metadata = { title: "Consultar estatus" };

export default function PaginaSeguimiento() {
  return (
    <div className="mx-auto max-w-2xl py-4">
      <Titulo descripcion="Escribe el folio y la clave que recibiste al enviar tu denuncia. No necesitas correo ni cuenta.">
        Consulta el estatus de tu denuncia
      </Titulo>
      <Seguimiento />
    </div>
  );
}
