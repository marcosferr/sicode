"use client";

import { Check, Loader2, LogOut, MessageSquare, Send, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { analizarRelato } from "@/lib/blindaje/relato";
import type { VistaSeguimiento } from "@/lib/servicio";
import { ESTADOS, type EstadoDenuncia } from "@/lib/tipos";
import { AntiBot } from "./AntiBot";
import { AreaTexto, Aviso, Boton, Campo, cx, Tarjeta } from "./ui";

const FLUJO: EstadoDenuncia[] = ["SIN_TURNAR", "TURNADA", "REGISTRADA", "EN_PROCESO", "ATENDIDA"];

const fecha = (dia: string) =>
  new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(new Date(dia + "T00:00:00Z"));

export function Seguimiento() {
  const [folio, setFolio] = useState("");
  const [clave, setClave] = useState("");
  const [altcha, setAltcha] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [vista, setVista] = useState<VistaSeguimiento | null>(null);
  const [respuesta, setRespuesta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const riesgo = useMemo(() => analizarRelato(respuesta), [respuesta]);

  const consultar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!altcha) return setError("Completa la verificación «No soy un robot».");
    setCargando(true);
    try {
      const r = await fetch("/api/seguimiento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folio, clave, altcha }) });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      setVista(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar.");
      setAltcha("");
    } finally {
      setCargando(false);
    }
  };

  const responder = async () => {
    setEnviando(true);
    setError("");
    try {
      const r = await fetch("/api/seguimiento/mensaje", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folio, clave, texto: respuesta }) });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      setVista(json);
      setRespuesta("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje.");
    } finally {
      setEnviando(false);
    }
  };

  if (!vista) {
    return (
      <Tarjeta className="mt-8">
        <form onSubmit={consultar} className="space-y-4" noValidate>
          <Campo id="folio" etiqueta="Folio" placeholder="SCD-2026-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={folio} onChange={(e) => setFolio(e.target.value)} required />
          <Campo id="clave" etiqueta="Clave de seguimiento" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={clave} onChange={(e) => setClave(e.target.value)} required ayuda="Es la clave que se mostró una sola vez al enviar la denuncia." />
          <AntiBot alVerificar={setAltcha} />
          {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
          <Boton type="submit" disabled={cargando || !folio || !clave} className="w-full">
            {cargando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null} Consultar
          </Boton>
        </form>
      </Tarjeta>
    );
  }

  const indice = FLUJO.indexOf(vista.status);
  const pendiente = vista.mensajes.at(-1)?.autor === "AUTORIDAD";

  return (
    <div className="mt-8 space-y-5">
      <Tarjeta>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Folio</p>
            <p className="font-mono text-lg font-bold">{vista.folio}</p>
          </div>
          <Boton variante="secundario" onClick={() => { setVista(null); setFolio(""); setClave(""); setAltcha(""); }}>
            <LogOut className="size-4" aria-hidden="true" /> Salir
          </Boton>
        </div>
        <h2 className="mt-4 text-xl font-bold text-primary">Estatus: {vista.etiqueta}</h2>
        <p className="mt-1 text-muted-foreground">{vista.descripcion}</p>

        {vista.status === "IMPROCEDENTE" ? null : (
          <ol className="mt-5 grid gap-2 sm:grid-cols-5" aria-label="Avance del trámite">
            {FLUJO.map((estado, i) => (
              <li
                key={estado}
                aria-current={i === indice ? "step" : undefined}
                className={cx(
                  "flex items-center gap-2 rounded-lg border p-2.5 text-sm font-semibold sm:flex-col sm:text-center",
                  i < indice && "border-verde/50 bg-verde/10",
                  i === indice && "border-primary bg-primary/10",
                  i > indice && "border-border text-muted-foreground",
                )}
              >
                <span className={cx("grid size-6 shrink-0 place-items-center rounded-full text-xs", i <= indice ? "bg-primary text-primary-foreground" : "bg-secondary")}>
                  {i < indice ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                </span>
                {ESTADOS[estado].etiqueta}
                <span className="sr-only">{i < indice ? " (completado)" : i === indice ? " (etapa actual)" : " (pendiente)"}</span>
              </li>
            ))}
          </ol>
        )}

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="font-semibold text-muted-foreground">Recibida</dt><dd>{fecha(vista.fechaRecepcion)}</dd></div>
          <div><dt className="font-semibold text-muted-foreground">Última actualización</dt><dd>{fecha(vista.fechaActualizacion)}</dd></div>
          <div><dt className="font-semibold text-muted-foreground">Autoridad que la atiende</dt><dd>{vista.institucionActual ?? "Aún sin asignar"}</dd></div>
        </dl>
        {vista.resumenPublicoCierre && (
          <Aviso tono="exito" className="mt-5" titulo="Resultado informado por la autoridad">
            <p className="whitespace-pre-wrap">{vista.resumenPublicoCierre}</p>
          </Aviso>
        )}
      </Tarjeta>

      <Tarjeta>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <MessageSquare className="size-5 text-primary" aria-hidden="true" /> Buzón anónimo
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          La autoridad puede pedirte más información aquí y tú puedes responder sin revelar quién eres. Las fechas se muestran por día, sin hora.
        </p>
        {pendiente && (
          <Aviso tono="aviso" className="mt-3" icono={<TriangleAlert className="size-5" />}>
            <p className="font-semibold">La autoridad te escribió y espera tu respuesta.</p>
          </Aviso>
        )}
        <ol className="mt-4 space-y-3" aria-live="polite">
          {vista.mensajes.length === 0 && <li className="text-sm text-muted-foreground">Todavía no hay mensajes.</li>}
          {vista.mensajes.map((m) => (
            <li key={m.id} className={cx("max-w-[90%] rounded-lg border p-3 text-sm", m.autor === "AUTORIDAD" ? "border-border bg-secondary" : "ml-auto border-primary/40 bg-primary/10")}>
              <p className="font-semibold">{m.autor === "AUTORIDAD" ? "Autoridad" : "Tú"} <span className="font-normal text-muted-foreground">· {fecha(m.fecha)}</span></p>
              <p className="mt-1 whitespace-pre-wrap leading-6">{m.texto}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 space-y-3">
          <AreaTexto id="respuesta" etiqueta="Escribe un mensaje" rows={4} className="min-h-28" value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
          {riesgo.hallazgos.length > 0 && (
            <Aviso tono={riesgo.nivel === "alto" ? "peligro" : "aviso"} titulo={`Protección de tu identidad: ${riesgo.resumen}`}>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {riesgo.hallazgos.map((h, i) => <li key={i}><span className="italic">«{h.fragmento}»</span>: {h.consejo}</li>)}
              </ul>
            </Aviso>
          )}
          {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
          <Boton onClick={responder} disabled={enviando || respuesta.trim().length < 2}>
            {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />} Enviar mensaje
          </Boton>
        </div>
      </Tarjeta>
    </div>
  );
}
