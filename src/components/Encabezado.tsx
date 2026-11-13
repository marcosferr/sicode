"use client";

import { Accessibility, Contrast, Moon, ShieldCheck, Sun, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cx } from "./ui";

const PILDORA =
  "inline-flex min-h-10 items-center gap-2 rounded-md border border-white/30 px-3 py-1.5 text-sm font-semibold " +
  "text-banda-texto transition hover:bg-white/15 focus-visible:outline-dorado-claro";

const ESCALAS = [
  { valor: "1", etiqueta: "Normal" },
  { valor: "1.15", etiqueta: "Grande" },
  { valor: "1.3", etiqueta: "Muy grande" },
];

/** Preferencias de accesibilidad guardadas en este navegador (no viajan al servidor). */
function leer(clave: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(clave);
  } catch {
    return null; // almacenamiento bloqueado: se usan los valores por defecto
  }
}

export function Marca() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-md text-banda-texto focus-visible:outline-dorado-claro">
      <svg viewBox="0 0 40 40" className="size-10 shrink-0" aria-hidden="true">
        <path d="M20 3 6 8v10.5c0 8.4 5.7 15.2 14 18.5 8.3-3.3 14-10.1 14-18.5V8L20 3Z" fill="hsl(var(--dorado-claro))" />
        <path d="m13.5 20 4.5 4.5 8.5-9" fill="none" stroke="hsl(336 69% 20%)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="leading-tight">
        <span className="block text-xl font-extrabold tracking-wide">SICODE</span>
        <span className="hidden text-xs font-medium opacity-90 sm:block">Sistema Integral de Corroboración de Denuncias</span>
        <span className="sr-only">, ir al inicio</span>
      </span>
    </Link>
  );
}

export function Encabezado() {
  const { resolvedTheme, setTheme } = useTheme();
  // Verdadero solo en el navegador: evita diferencias entre el HTML del servidor y el del cliente.
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [abierto, setAbierto] = useState(false);
  const [escala, setEscala] = useState(() => leer("sicode-escala") ?? "1");
  const [contraste, setContraste] = useState(() => leer("sicode-contraste") === "alto");
  const [leyendo, setLeyendo] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.style.setProperty("--escala", escala);
    if (contraste) document.documentElement.dataset.contraste = "alto";
    else delete document.documentElement.dataset.contraste;
    try {
      localStorage.setItem("sicode-escala", escala);
      localStorage.setItem("sicode-contraste", contraste ? "alto" : "normal");
    } catch {
      /* sin almacenamiento */
    }
  }, [escala, contraste]);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !panel.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", cerrar);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("keydown", cerrar);
    };
  }, [abierto]);

  /** Lectura en voz con el sintetizador del propio dispositivo: el texto no sale del navegador. */
  const leerEnVoz = () => {
    if (!("speechSynthesis" in window)) return;
    if (leyendo) {
      window.speechSynthesis.cancel();
      setLeyendo(false);
      return;
    }
    const seleccion = window.getSelection()?.toString().trim();
    const texto = seleccion || document.querySelector("main")?.innerText || "";
    if (!texto) return;
    const voz = new SpeechSynthesisUtterance(texto.slice(0, 6000));
    voz.lang = "es-MX";
    voz.onend = () => setLeyendo(false);
    voz.onerror = () => setLeyendo(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(voz);
    setLeyendo(true);
  };

  const oscuro = montado && resolvedTheme === "dark";

  return (
    <header className="border-b-4 border-dorado bg-banda text-banda-texto">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <Marca />
      <nav aria-label="Opciones del sitio" className="flex items-center gap-2">
        <Link href="/privacidad" className={PILDORA}>
          <ShieldCheck className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Cómo te protegemos</span>
          <span className="sm:hidden">Privacidad</span>
        </Link>
        <div className="relative" ref={panel}>
          <button type="button" className={PILDORA} aria-expanded={abierto} aria-controls="panel-accesibilidad" onClick={() => setAbierto((v) => !v)}>
            <Accessibility className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Accesibilidad</span>
            <span className="sr-only sm:hidden">Accesibilidad</span>
          </button>
          {abierto ? (
            <div
              id="panel-accesibilidad"
              role="group"
              aria-label="Opciones de accesibilidad"
              className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xl"
            >
              <fieldset>
                <legend className="text-sm font-semibold">Tamaño del texto</legend>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {ESCALAS.map((e) => (
                    <button
                      key={e.valor}
                      type="button"
                      aria-pressed={escala === e.valor}
                      onClick={() => setEscala(e.valor)}
                      className={cx(
                        "min-h-10 rounded-md border px-2 text-sm font-semibold",
                        escala === e.valor ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary",
                      )}
                    >
                      {e.etiqueta}
                    </button>
                  ))}
                </div>
              </fieldset>
              <button
                type="button"
                aria-pressed={contraste}
                onClick={() => setContraste((v) => !v)}
                className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-md border border-border px-3 text-left text-sm font-semibold hover:bg-secondary"
              >
                <Contrast className="size-4" aria-hidden="true" />
                Alto contraste: {contraste ? "activado" : "desactivado"}
              </button>
              <button
                type="button"
                aria-pressed={leyendo}
                onClick={leerEnVoz}
                className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-md border border-border px-3 text-left text-sm font-semibold hover:bg-secondary"
              >
                {leyendo ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
                {leyendo ? "Detener la lectura" : "Leer en voz alta"}
              </button>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Lee el texto que selecciones o, si no hay selección, la página. La voz la genera tu dispositivo: nada se envía a otro servicio.
              </p>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={cx(PILDORA, "px-2.5")}
          onClick={() => setTheme(oscuro ? "light" : "dark")}
          aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
        >
          {oscuro ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
        </button>
      </nav>
      </div>
    </header>
  );
}
