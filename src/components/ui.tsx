import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variante = "primario" | "secundario" | "fantasma" | "peligro";

const ESTILO_BOTON: Record<Variante, string> = {
  primario: "bg-accent text-accent-foreground hover:bg-primary dark:hover:brightness-125 shadow-sm",
  secundario: "bg-card text-card-foreground border border-border hover:bg-secondary",
  fantasma: "text-foreground hover:bg-secondary",
  peligro: "bg-destructive text-destructive-foreground hover:brightness-110",
};

const BASE_BOTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 py-2 text-sm font-semibold transition " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function Boton({ variante = "primario", className, ...p }: ComponentProps<"button"> & { variante?: Variante }) {
  return <button type="button" {...p} className={cx(BASE_BOTON, ESTILO_BOTON[variante], className)} />;
}

export function EnlaceBoton({ variante = "primario", className, ...p }: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link {...p} className={cx(BASE_BOTON, ESTILO_BOTON[variante], className)} />;
}

export function Tarjeta({ className, ...p }: ComponentProps<"div">) {
  return (
    <div
      {...p}
      className={cx("rounded-xl border border-border bg-card p-5 text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.05)] sm:p-6", className)}
    />
  );
}

export function Titulo({ children, descripcion }: { children: ReactNode; descripcion?: ReactNode }) {
  return (
    <header className="mx-auto max-w-3xl text-center">
      <span className="mx-auto mb-4 block h-1 w-14 rounded-full bg-dorado" aria-hidden="true" />
      <h1 className="text-balance text-3xl font-bold tracking-tight text-primary sm:text-4xl">{children}</h1>
      {descripcion ? <p className="mt-3 text-pretty text-base leading-7 text-muted-foreground">{descripcion}</p> : null}
    </header>
  );
}

const ESTILO_CAMPO =
  "mt-1.5 w-full rounded-md border border-input bg-card px-3.5 py-2.5 text-base text-foreground " +
  "placeholder:text-muted-foreground/80 disabled:opacity-60";

interface PropsCampo {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  opcional?: boolean;
}

function Envoltura({ id, etiqueta, ayuda, error, opcional, children }: PropsCampo & { id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">
        {etiqueta} {opcional ? <span className="font-normal text-muted-foreground">(opcional)</span> : null}
      </label>
      {children}
      {ayuda ? (
        <p id={`${id}-ayuda`} className="mt-1 text-sm text-muted-foreground">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const describe = (id: string, p: PropsCampo) =>
  [p.ayuda && `${id}-ayuda`, p.error && `${id}-error`].filter(Boolean).join(" ") || undefined;

export function Campo({ etiqueta, ayuda, error, opcional, id, className, ...p }: PropsCampo & ComponentProps<"input"> & { id: string }) {
  return (
    <Envoltura {...{ id, etiqueta, ayuda, error, opcional }}>
      <input id={id} {...p} aria-invalid={error ? true : undefined} aria-describedby={describe(id, { etiqueta, ayuda, error })} className={cx(ESTILO_CAMPO, className)} />
    </Envoltura>
  );
}

export function AreaTexto({ etiqueta, ayuda, error, opcional, id, className, ...p }: PropsCampo & ComponentProps<"textarea"> & { id: string }) {
  return (
    <Envoltura {...{ id, etiqueta, ayuda, error, opcional }}>
      <textarea id={id} {...p} aria-invalid={error ? true : undefined} aria-describedby={describe(id, { etiqueta, ayuda, error })} className={cx(ESTILO_CAMPO, "min-h-40 leading-7", className)} />
    </Envoltura>
  );
}

export function Selector({ etiqueta, ayuda, error, opcional, id, className, children, ...p }: PropsCampo & ComponentProps<"select"> & { id: string }) {
  return (
    <Envoltura {...{ id, etiqueta, ayuda, error, opcional }}>
      <select id={id} {...p} aria-invalid={error ? true : undefined} aria-describedby={describe(id, { etiqueta, ayuda, error })} className={cx(ESTILO_CAMPO, className)}>
        {children}
      </select>
    </Envoltura>
  );
}

type Tono = "info" | "exito" | "aviso" | "peligro";

const ESTILO_AVISO: Record<Tono, string> = {
  info: "border-primary/30 bg-primary/5",
  exito: "border-verde/50 bg-verde/10",
  aviso: "border-amarillo/60 bg-amarillo/10",
  peligro: "border-rojo/60 bg-rojo/10",
};

export function Aviso({ tono = "info", titulo, children, icono, className }: { tono?: Tono; titulo?: string; children?: ReactNode; icono?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex gap-3 rounded-lg border p-4 text-sm leading-6", ESTILO_AVISO[tono], className)}>
      {icono ? <span className="mt-0.5 shrink-0" aria-hidden="true">{icono}</span> : null}
      <div className="min-w-0">
        {titulo ? <p className="font-semibold">{titulo}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function Insignia({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground", className)}>
      {children}
    </span>
  );
}

const COLOR_SEMAFORO = { rojo: "bg-rojo", amarillo: "bg-amarillo", verde: "bg-verde" } as const;
const TEXTO_SEMAFORO = { rojo: "Respaldo fuerte", amarillo: "Respaldo parcial", verde: "Sin respaldo en las fuentes" } as const;

/** El color nunca va solo: siempre lleva texto (WCAG 1.4.1). */
export function Semaforo({ color, compacto }: { color?: "rojo" | "amarillo" | "verde"; compacto?: boolean }) {
  if (!color) return <Insignia className="border-dashed">Sin corroborar</Insignia>;
  return (
    <Insignia>
      <span className={cx("size-2.5 rounded-full", COLOR_SEMAFORO[color])} aria-hidden="true" />
      {compacto ? color[0].toUpperCase() + color.slice(1) : TEXTO_SEMAFORO[color]}
    </Insignia>
  );
}
