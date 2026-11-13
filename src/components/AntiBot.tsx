"use client";

import { createElement, useEffect, useRef } from "react";

/**
 * Widget ALTCHA (el mismo verificador que usa el prototipo del S5), servido desde este
 * sitio. `alVerificar` recibe la prueba resuelta, o cadena vacía si expira o se reinicia.
 */
export function AntiBot({ alVerificar }: { alVerificar: (payload: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  const aviso = useRef(alVerificar);
  aviso.current = alVerificar;

  useEffect(() => {
    void import("altcha");
    const nodo = ref.current;
    if (!nodo) return;
    const alCambiar = (e: Event) => {
      const d = (e as CustomEvent<{ state?: string; payload?: string }>).detail ?? {};
      aviso.current(d.state === "verified" && d.payload ? d.payload : "");
    };
    nodo.addEventListener("statechange", alCambiar);
    return () => nodo.removeEventListener("statechange", alCambiar);
  }, []);

  return createElement("altcha-widget", { ref, challenge: "/api/altcha", language: "es-419", hidefooter: "true" });
}
