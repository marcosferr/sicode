"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Boton } from "./ui";

export function BotonSalir() {
  return (
    <Boton variante="secundario" onClick={() => signOut({ callbackUrl: "/operador" })}>
      <LogOut className="size-4" aria-hidden="true" /> Cerrar sesión
    </Boton>
  );
}
