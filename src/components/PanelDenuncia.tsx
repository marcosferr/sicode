"use client";

import {
  BadgeCheck, CircleHelp, Database, Download, ExternalLink, FileText, KeyRound, Loader2, Lock, MessageSquare, Scale,
  ScanSearch, Send, ShieldCheck, TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { CONDUCTA_POR_CLAVE, ENTIDADES } from "@/lib/catalogos";
import type { Contacto } from "@/lib/seguridad";
import type { VistaOperador } from "@/lib/servicio";
import { ESTADOS, type Corroboracion, type EstadoDenuncia, type Indicio } from "@/lib/tipos";
import { AreaTexto, Aviso, Boton, Campo, cx, Insignia, Selector, Semaforo, Tarjeta } from "./ui";

const CONFIABILIDAD: Record<string, string> = {
  A: "A · confirmado con identificador",
  B: "B · coinciden nombre y ente",
  C: "C · coincide solo el nombre",
  D: "D · sin respaldo",
};

const TIPO_INDICIO: Record<Indicio["tipo"], string> = { hecho: "Hecho", posible_alerta: "Posible alerta", contexto: "Contexto" };

const ESTADO_HIPOTESIS = {
  con_respaldo: { texto: "Con respaldo", clase: "border-verde/60 bg-verde/10" },
  sin_respaldo: { texto: "Sin respaldo en las fuentes", clase: "border-border" },
  abierta: { texto: "Abierta: fuente no disponible", clase: "border-amarillo/60 bg-amarillo/10" },
} as const;

const TIPO_CLASIFICACION = {
  FALTA_GRAVE: "Falta administrativa grave",
  FALTA_NO_GRAVE: "Falta administrativa no grave",
  FALTA_PARTICULARES: "Falta de particulares",
  HECHO_CORRUPCION: "Hecho de corrupción (delito)",
} as const;

export function PanelDenuncia({ inicial, demo }: { inicial: VistaOperador; demo: boolean }) {
  const [d, setD] = useState(inicial);
  const [ocupado, setOcupado] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [motivo, setMotivo] = useState("");
  const [contacto, setContacto] = useState<Contacto | null>(null);
  const [tramite, setTramite] = useState({
    status: inicial.status,
    institucionActual: inicial.institucionActual ?? "",
    prioridad: inicial.prioridad ?? "",
    resumenPublicoCierre: inicial.resumenPublicoCierre ?? "",
  });

  const accion = async (nombre: string, cuerpo: Record<string, unknown>) => {
    setOcupado(nombre);
    setError("");
    try {
      const r = await fetch(`/api/operador/denuncias/${d.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: nombre, ...cuerpo }) });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "No se pudo completar la acción.");
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      return null;
    } finally {
      setOcupado("");
    }
  };

  const corroborar = async () => {
    const r = await accion("corroborar", {});
    if (r) {
      setD(r);
      setTramite((t) => ({ ...t, prioridad: r.prioridad ?? t.prioridad }));
    }
  };
  const guardarTramite = async () => {
    const r = await accion("tramite", { ...tramite, prioridad: tramite.prioridad || undefined });
    if (r) {
      setD(r);
      setTramite({ status: r.status, institucionActual: r.institucionActual ?? "", prioridad: r.prioridad ?? "", resumenPublicoCierre: r.resumenPublicoCierre ?? "" });
    }
  };
  const enviarMensaje = async () => {
    const r = await accion("mensaje", { texto: mensaje });
    if (r) {
      setD(r);
      setMensaje("");
    }
  };
  const revelar = async () => {
    const r = await accion("revelar_contacto", { motivo });
    if (r) {
      setContacto(r.contacto);
      setD(r.denuncia);
      setMotivo("");
    }
  };

  const c = d.corroboracion;
  const cierra = tramite.status === "ATENDIDA" || tramite.status === "IMPROCEDENTE";

  return (
    <div className="mt-4 space-y-5">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="font-mono text-2xl font-bold text-primary">{d.folio}</h1>
        <Semaforo color={c?.semaforo.color} />
        <Insignia>{ESTADOS[d.status].etiqueta}</Insignia>
        {d.prioridad && <Insignia>Prioridad {d.prioridad.toLowerCase()}</Insignia>}
      </header>

      {error && (
        <Aviso tono="peligro" icono={<TriangleAlert className="size-5" />}>
          <p role="alert" className="font-semibold">{error}</p>
        </Aviso>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        {/* ---------- Columna izquierda: la denuncia y su corroboración ---------- */}
        <div className="space-y-5">
          <Tarjeta>
            <h2 className="flex items-center gap-2 text-lg font-bold"><FileText className="size-5 text-primary" aria-hidden="true" /> Denuncia</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold text-muted-foreground">Recibida</dt><dd>{d.fechaRecepcion} <span className="text-muted-foreground">(solo se guarda el día)</span></dd></div>
              <div><dt className="font-semibold text-muted-foreground">Mes de los hechos</dt><dd>{d.fechaHecho || "No indicado"}</dd></div>
              <div><dt className="font-semibold text-muted-foreground">Lugar</dt><dd>{[d.lugar.municipio, d.lugar.entidad ? ENTIDADES[d.lugar.entidad] : ""].filter(Boolean).join(", ") || "No indicado"}</dd></div>
              <div><dt className="font-semibold text-muted-foreground">Institución</dt><dd>{d.lugar.institucion || "No indicada"}</dd></div>
              {d.referenciaContratacion && <div className="sm:col-span-2"><dt className="font-semibold text-muted-foreground">Contratación relacionada</dt><dd>{d.referenciaContratacion}</dd></div>}
            </dl>
            <h3 className="mt-4 text-sm font-semibold text-muted-foreground">Relato</h3>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-background/60 p-4 text-sm leading-7">{d.narracionHechos}</p>
            {d.conductas.length > 0 && (
              <p className="mt-3 flex flex-wrap gap-1.5">
                {d.conductas.map((k) => <Insignia key={k}>{CONDUCTA_POR_CLAVE.get(k)?.titulo ?? k}</Insignia>)}
              </p>
            )}
            {d.involucrados.length > 0 && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-muted-foreground">Personas y empresas señaladas</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {d.involucrados.map((i, n) => (
                    <li key={n}>
                      <span className="font-semibold">{i.razonSocial ?? i.nombre}</span>
                      {i.rfc ? ` · RFC ${i.rfc}` : ""}{i.cargo ? ` · ${i.cargo}` : ""}{i.institucion ? ` · ${i.institucion}` : ""}
                      <span className="text-muted-foreground"> ({i.tipo === "EMPRESA" ? "empresa" : i.tipo === "SERVIDOR_PUBLICO" ? "persona servidora pública" : "particular"})</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {d.evidencias.length > 0 && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-muted-foreground">Evidencias</h3>
                <ul className="mt-1 space-y-2 text-sm">
                  {d.evidencias.map((e) => (
                    <li key={e.id} className="rounded-lg border border-border p-3">
                      <a className="inline-flex items-center gap-1.5 font-semibold text-primary underline underline-offset-4" href={`/api/operador/denuncias/${d.id}/evidencias/${e.id}`}>
                        <Download className="size-4" aria-hidden="true" /> {e.nombre}
                      </a>
                      <span className="text-muted-foreground"> · {(e.tamano / 1024).toFixed(0)} KB</span>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Limpiada antes de recibirse{e.limpieza.hallazgos.length ? `: se quitó ${e.limpieza.hallazgos.join("; ").toLowerCase()}` : ""}.
                        Huella sha256: <span className="break-all font-mono">{e.sha256.slice(0, 24)}…</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Tarjeta>

          <Tarjeta>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold"><ScanSearch className="size-5 text-primary" aria-hidden="true" /> Corroboración con datos públicos</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cruza personas, empresas y entes señalados con los sistemas 1, 2, 3 y 6 de la PDN. No usa ningún dato de quien denuncia.
                  {demo ? " Ahora mismo usa registros ficticios de demostración." : ""}
                </p>
              </div>
              <Boton onClick={corroborar} disabled={ocupado === "corroborar"}>
                {ocupado === "corroborar" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Database className="size-4" aria-hidden="true" />}
                {ocupado === "corroborar" ? "Consultando…" : c ? "Volver a corroborar" : "Corroborar"}
              </Boton>
            </div>
            {ocupado === "corroborar" && <p role="status" className="mt-3 text-sm text-muted-foreground">Consultando las fuentes. La primera vez puede tardar hasta medio minuto.</p>}
            {c ? <ResultadoCorroboracion c={c} /> : null}
          </Tarjeta>
        </div>

        {/* ---------- Columna derecha: trámite, buzón, identidad, bitácora ---------- */}
        <div className="space-y-5">
          <Tarjeta className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold"><BadgeCheck className="size-5 text-primary" aria-hidden="true" /> Trámite</h2>
            <Selector id="status" etiqueta="Estado" value={tramite.status} onChange={(e) => setTramite({ ...tramite, status: e.target.value as EstadoDenuncia })}>
              {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.etiqueta}</option>)}
            </Selector>
            <Campo id="autoridad" etiqueta="Autoridad a la que se turna" opcional value={tramite.institucionActual} onChange={(e) => setTramite({ ...tramite, institucionActual: e.target.value })} ayuda="Al asignar una autoridad, una denuncia sin turnar pasa a «Turnada»." />
            <Selector id="prioridad" etiqueta="Prioridad" value={tramite.prioridad} onChange={(e) => setTramite({ ...tramite, prioridad: e.target.value as never })} ayuda={c ? "Sugerida por el semáforo. Usted decide." : undefined}>
              <option value="">Sin definir</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Media</option>
              <option value="BAJA">Baja</option>
            </Selector>
            <AreaTexto
              id="resumen"
              etiqueta="Resumen público del resultado"
              opcional={!cierra}
              rows={3}
              className="min-h-24"
              value={tramite.resumenPublicoCierre}
              onChange={(e) => setTramite({ ...tramite, resumenPublicoCierre: e.target.value })}
              ayuda="Lo verá quien denunció al consultar su folio. Es obligatorio para cerrar. No incluya datos personales."
            />
            <Boton onClick={guardarTramite} disabled={ocupado === "tramite"}>
              {ocupado === "tramite" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null} Guardar trámite
            </Boton>
          </Tarjeta>

          <Tarjeta>
            <h2 className="flex items-center gap-2 text-lg font-bold"><MessageSquare className="size-5 text-primary" aria-hidden="true" /> Buzón anónimo</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pida aclaraciones o más evidencia. Quien denunció responde con su folio y su clave, sin identificarse.</p>
            <ol className="mt-3 space-y-2.5" aria-live="polite">
              {d.mensajes.length === 0 && <li className="text-sm text-muted-foreground">Sin mensajes.</li>}
              {d.mensajes.map((m) => (
                <li key={m.id} className={cx("max-w-[92%] rounded-lg border p-3 text-sm", m.autor === "AUTORIDAD" ? "ml-auto border-primary/40 bg-primary/10" : "border-border bg-secondary")}>
                  <p className="font-semibold">{m.autor === "AUTORIDAD" ? "Autoridad" : "Quien denunció"} <span className="font-normal text-muted-foreground">· {m.fecha}</span></p>
                  <p className="mt-1 whitespace-pre-wrap leading-6">{m.texto}</p>
                </li>
              ))}
            </ol>
            <div className="mt-4 space-y-3">
              <AreaTexto id="mensaje" etiqueta="Mensaje para quien denunció" rows={3} className="min-h-24" value={mensaje} onChange={(e) => setMensaje(e.target.value)} ayuda="Evite preguntas que obliguen a la persona a identificarse (puesto, área, horario)." />
              <Boton onClick={enviarMensaje} disabled={ocupado === "mensaje" || mensaje.trim().length < 2}>
                {ocupado === "mensaje" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />} Enviar
              </Boton>
            </div>
          </Tarjeta>

          <Tarjeta>
            <h2 className="flex items-center gap-2 text-lg font-bold"><Lock className="size-5 text-primary" aria-hidden="true" /> Identidad de quien denunció</h2>
            {d.anonimo ? (
              <p className="mt-2 flex gap-2 text-sm"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-verde" aria-hidden="true" /> Denuncia anónima. El sistema no tiene ningún dato de contacto, dirección IP ni hora de envío.</p>
            ) : contacto ? (
              <dl className="mt-3 space-y-1 text-sm">
                <div><dt className="inline font-semibold">Correo: </dt><dd className="inline">{contacto.correo}</dd></div>
                {contacto.nombre && <div><dt className="inline font-semibold">Nombre: </dt><dd className="inline">{contacto.nombre}</dd></div>}
                {contacto.telefono && <div><dt className="inline font-semibold">Teléfono: </dt><dd className="inline">{contacto.telefono}</dd></div>}
                <p className="pt-2 text-xs text-muted-foreground">La apertura quedó registrada en la bitácora con su usuario y el motivo.</p>
              </dl>
            ) : (
              <div className="mt-2 space-y-3 text-sm">
                <p>La persona dejó datos de contacto. Están cifrados y no se muestran por defecto: use primero el buzón anónimo.</p>
                <AreaTexto id="motivo" etiqueta="Motivo para abrir los datos" rows={2} className="min-h-20" value={motivo} onChange={(e) => setMotivo(e.target.value)} ayuda="Mínimo 20 caracteres. Queda en la bitácora junto con su usuario." />
                <Boton variante="secundario" onClick={revelar} disabled={ocupado === "revelar_contacto" || motivo.trim().length < 20}>
                  <KeyRound className="size-4" aria-hidden="true" /> Abrir datos de contacto
                </Boton>
              </div>
            )}
          </Tarjeta>

          <Tarjeta>
            <h2 className="text-lg font-bold">Bitácora</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {[...d.bitacora].reverse().map((b, i) => (
                <li key={i} className="border-l-2 border-border pl-3">
                  <p className="font-semibold">{b.accion}</p>
                  {b.detalle && <p className="text-muted-foreground">{b.detalle}</p>}
                  <p className="text-xs text-muted-foreground">{b.fecha} · {b.actor}</p>
                </li>
              ))}
            </ol>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}

function ResultadoCorroboracion({ c }: { c: Corroboracion }) {
  const s = c.semaforo;
  const significado = {
    rojo: "Hay respaldo documental fuerte en datos públicos. Se sugiere atención prioritaria.",
    amarillo: "Hay datos públicos que respaldan parte de lo denunciado. Conviene revisar los indicios antes de turnar.",
    verde: "Las fuentes públicas consultadas no aportaron respaldo. Esto no significa que la denuncia sea falsa.",
  }[s.color];
  const indicio = (id: string) => c.indicios.find((i) => i.id === id);

  return (
    <div className="mt-5 space-y-6">
      <section className={cx("rounded-lg border p-4", s.color === "rojo" ? "border-rojo/60 bg-rojo/10" : s.color === "amarillo" ? "border-amarillo/60 bg-amarillo/10" : "border-verde/50 bg-verde/10")}>
        <div className="flex flex-wrap items-center gap-2">
          <Semaforo color={s.color} />
          <span className="text-sm text-muted-foreground">Puntaje {s.puntaje} · consultado el {c.fecha}</span>
        </div>
        <p className="mt-2 text-sm font-semibold">{significado}</p>
        {s.reglasDuras.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {s.reglasDuras.map((r) => <li key={r.indicio + r.regla}>{r.descripcion} ({r.indicio}).</li>)}
          </ul>
        )}
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          El semáforo ordena la atención y no califica a nadie: un indicio es un dato con su fuente, no una conclusión. La decisión es de la autoridad.
        </p>
      </section>

      <section aria-labelledby="t-indicios">
        <h3 id="t-indicios" className="font-bold">Indicios ({c.indicios.length})</h3>
        {c.indicios.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Ninguna fuente aportó datos sobre lo denunciado.</p>}
        <ul className="mt-2 space-y-3">
          {c.indicios.map((i) => (
            <li key={i.id} className="rounded-lg border border-border p-4 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono font-bold">{i.id}</span>
                <Insignia>{TIPO_INDICIO[i.tipo]}</Insignia>
                <Insignia>Confiabilidad {CONFIABILIDAD[i.confiabilidad]}</Insignia>
                {i.reglaDura && i.tipo === "hecho" && <Insignia className="border-rojo text-rojo">Regla dura</Insignia>}
              </div>
              <p className="mt-2 font-semibold leading-6">{i.descripcion}</p>
              {i.detalle && <p className="mt-1 leading-6 text-muted-foreground">{i.detalle}</p>}
              {i.explicacionAlternativa && (
                <p className="mt-2 flex gap-2 rounded-xl bg-secondary p-2.5 leading-6">
                  <CircleHelp className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span><span className="font-semibold">Otra lectura posible: </span>{i.explicacionAlternativa}</span>
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Fuente: {i.fuente.sistema} de la PDN{i.fuente.proveedor ? `, ${i.fuente.proveedor}` : ""}{i.fuente.referencia ? `, ref. ${i.fuente.referencia}` : ""} ·{" "}
                {i.fuente.modo === "local" ? "consulta en copia local" : "consulta por API"} ·{" "}
                <a className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2" href={i.fuente.url} target="_blank" rel="noreferrer noopener">
                  Comprobar en la fuente <ExternalLink className="size-3" aria-hidden="true" /><span className="sr-only">(abre en otra pestaña)</span>
                </a>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="t-hipotesis">
        <h3 id="t-hipotesis" className="font-bold">Hipótesis verificables</h3>
        <ul className="mt-2 space-y-2">
          {c.hipotesis.map((h) => (
            <li key={h.id} className={cx("rounded-lg border p-3 text-sm", ESTADO_HIPOTESIS[h.estado].clase)}>
              <p className="font-semibold">{h.id}. {h.enunciado}</p>
              <p className="text-muted-foreground">{ESTADO_HIPOTESIS[h.estado].texto}{h.indicios.length ? `: ${h.indicios.join(", ")}` : ""}. Cómo se verifica: {h.comoVerificar}</p>
            </li>
          ))}
        </ul>
      </section>

      {c.clasificacion.length > 0 && (
        <section aria-labelledby="t-clasificacion">
          <h3 id="t-clasificacion" className="flex items-center gap-2 font-bold"><Scale className="size-4" aria-hidden="true" /> Clasificación orientativa</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {c.clasificacion.map((k) => (
              <li key={k.clave} className="rounded-lg border border-border p-3">
                <p className="font-semibold">{k.nombre} <span className="font-normal text-muted-foreground">· {TIPO_CLASIFICACION[k.tipo]}</span></p>
                <p className="text-muted-foreground">{k.fundamento}. {k.motivos.join(" ")}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Sugerencia automática a partir del relato. La calificación jurídica corresponde a la autoridad competente.</p>
        </section>
      )}

      <details className="rounded-lg border border-border p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Qué cambiaría este resultado ({s.queCambiaria.length + s.tareasVerificacion.length})</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {s.queCambiaria.map((q) => <li key={q}>{q}</li>)}
          {s.tareasVerificacion.map((t) => <li key={t.indicio}>{t.indicio}: {t.motivo}{indicio(t.indicio) ? ` (${indicio(t.indicio)!.sujeto})` : ""}</li>)}
        </ul>
      </details>

      <details className="rounded-lg border border-border p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Consultas realizadas ({c.consultas.length}) y criterio</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Consultas realizadas a los sistemas de la PDN</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-1.5 pr-3">Sistema</th><th scope="col" className="pr-3">Consulta</th><th scope="col" className="pr-3">Vía</th><th scope="col" className="pr-3">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {c.consultas.map((q, i) => (
                <tr key={i} className="border-b border-border/50 align-top">
                  <td className="py-1.5 pr-3 font-semibold">{q.sistema}</td>
                  <td className="pr-3">{q.descripcion}{q.detalle ? <span className="block text-muted-foreground">{q.detalle}</span> : null}</td>
                  <td className="pr-3">{q.modo === "local" ? "Copia local" : "API"}</td>
                  <td className="pr-3">{q.estado === "no_accesible" ? "Fuente no disponible" : q.estado === "ok" ? `${q.resultados} coincidencia(s)` : "Sin coincidencias"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Criterio del semáforo versión {s.criterio.version}, sha256 <span className="break-all font-mono">{s.criterio.sha256.slice(0, 16)}…</span> Sancionados (S3) y servidores en contrataciones (S2)
          se cruzan en una copia local, sin consultas externas. Contrataciones (S6) y declaraciones (S1) se consultan por API desde el servidor.
        </p>
      </details>
    </div>
  );
}
