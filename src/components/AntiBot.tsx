"use client";

import { useEffect, useRef } from "react";

/**
 * Widget ALTCHA (el mismo verificador que usa el prototipo del S5), servido desde este
 * sitio. `alVerificar` recibe la prueba resuelta, o cadena vacía si expira o se reinicia.
 */
export function AntiBot({ alVerificar }: { alVerificar: (payload: string) => void }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const aviso = useRef(alVerificar);

  useEffect(() => {
    aviso.current = alVerificar;
  }, [alVerificar]);

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;
    // Textos en español y widget, ambos servidos desde este mismo sitio.
    void import("altcha/i18n/es-419").then(() => import("altcha"));
    const widget = document.createElement("altcha-widget");
    widget.setAttribute("challenge", "/api/altcha");
    widget.setAttribute("language", "es-419");
    const alCambiar = (e: Event) => {
      const d = (e as CustomEvent<{ state?: string; payload?: string }>).detail ?? {};
      aviso.current(d.state === "verified" && d.payload ? d.payload : "");
    };
    widget.addEventListener("statechange", alCambiar);
    nodo.appendChild(widget);
    return () => {
      widget.removeEventListener("statechange", alCambiar);
      widget.remove();
    };
  }, []);

  return <div ref={contenedor} />;
}
