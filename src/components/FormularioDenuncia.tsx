"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft, ArrowRight, Building2, CheckCircle2, Copy, Download, EyeOff, FileCheck2, Lightbulb, Loader2, Plus,
  ShieldAlert, ShieldCheck, Trash2, TriangleAlert, Upload, UserRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import municipios from "@/datos/municipios.json";
import { informeSinValores, limpiarArchivo } from "@/lib/blindaje/metadatos";
import { analizarRelato } from "@/lib/blindaje/relato";
import { CONDUCTAS, ENTIDADES } from "@/lib/catalogos";
import { esquemaFormulario, LIMITE_ARCHIVO, type EntradaDenuncia } from "@/lib/esquema";
import type { InformeLimpieza } from "@/lib/tipos";
import { AntiBot } from "./AntiBot";
import { RelatoResaltado } from "./RelatoResaltado";
import { AreaTexto, Aviso, Boton, Campo, cx, Selector, Tarjeta } from "./ui";

type Valores = Omit<EntradaDenuncia, "evidencias" | "altcha">;

interface EvidenciaLocal {
  id: string;
  nombreOriginal: string;
  nombre: string;
  /** Informe completo, con los valores quitados. Solo vive en este navegador. */
  informe: InformeLimpieza;
}

const PASOS = [
  "¿Quieres hacer tu denuncia de forma anónima?",
  "¿Qué pasó?",
  "¿Quién y dónde?",
  "¿Tienes evidencias?",
  "Revisa y envía",
];

const CAMPOS_POR_PASO: (keyof Valores | `contacto.${string}`)[][] = [
  ["anonimo", "contacto.correo", "contacto.nombre", "contacto.telefono"],
  ["narracionHechos", "conductas"],
  ["lugar", "involucrados", "fechaHecho", "referenciaContratacion"],
  [],
  [],
];

const MUNICIPIOS = municipios as Record<string, string[]>;

export function FormularioDenuncia() {
  const [paso, setPaso] = useState(0);
  const [evidencias, setEvidencias] = useState<EvidenciaLocal[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState("");
  const [altcha, setAltcha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [resultado, setResultado] = useState<{ folio: string; clave: string } | null>(null);
  const [guardada, setGuardada] = useState(false);
  const encabezado = useRef<HTMLHeadingElement>(null);

  const {
    register, control, watch, trigger, getValues, setValue,
    formState: { errors },
  } = useForm<Valores>({
    resolver: zodResolver(esquemaFormulario as never),
    mode: "onTouched",
    defaultValues: { anonimo: true, narracionHechos: "", conductas: [], lugar: {}, involucrados: [], fechaHecho: "", referenciaContratacion: "" },
  });
  const involucrados = useFieldArray({ control, name: "involucrados" });

  const anonimo = watch("anonimo");
  const relato = watch("narracionHechos") ?? "";
  const conductas = watch("conductas") ?? [];
  const entidad = watch("lugar.entidad");
  const analisis = useMemo(() => analizarRelato(relato), [relato]);

  const irA = (n: number) => {
    setPaso(n);
    // El foco va al título del paso para que un lector de pantalla anuncie el cambio.
    requestAnimationFrame(() => encabezado.current?.focus());
    window.scrollTo({ top: 0 });
  };

  const siguiente = async () => {
    if (await trigger(CAMPOS_POR_PASO[paso] as never)) irA(paso + 1);
  };

  const agregarArchivos = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setErrorArchivo("");
    setSubiendo(true);
    try {
      for (const archivo of [...lista]) {
        if (evidencias.length >= 8) throw new Error("Puedes adjuntar hasta 8 archivos.");
        if (archivo.size > LIMITE_ARCHIVO) throw new Error(`«${archivo.name}» pasa de 15 MB.`);
        // 1) Se limpia aquí, en el dispositivo. El archivo original no se envía.
        const { bytes, informe } = await limpiarArchivo(new Uint8Array(await archivo.arrayBuffer()), archivo.name);
        if (!informe.limpiado) throw new Error(`«${archivo.name}»: ${informe.advertencias[0]}`);
        // 2) Solo viaja la copia limpia, con un nombre genérico.
        const cuerpo = new FormData();
        const extension = archivo.name.includes(".") ? archivo.name.split(".").pop() : "bin";
        cuerpo.append("archivo", new File([bytes as BlobPart], `evidencia.${extension}`, { type: informe.tipo }));
        const r = await fetch("/api/evidencias", { method: "POST", body: cuerpo });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "No se pudo subir el archivo.");
        setEvidencias((previas) => [...previas, { id: json.id, nombreOriginal: archivo.name, nombre: json.nombre, informe }]);
      }
    } catch (e) {
      setErrorArchivo(e instanceof Error ? e.message : "No se pudo procesar el archivo.");
    } finally {
      setSubiendo(false);
    }
  };

  const enviar = async () => {
    setErrorEnvio("");
    if (!(await trigger())) {
      setErrorEnvio("Hay datos por corregir en pasos anteriores.");
      return;
    }
    if (!altcha) {
      setErrorEnvio("Completa la verificación «No soy un robot».");
      return;
    }
    setEnviando(true);
    try {
      const v = getValues();
      const cuerpo: EntradaDenuncia = {
        ...v,
        contacto: v.anonimo ? undefined : v.contacto,
        evidencias: evidencias.map((e) => ({ id: e.id, informe: informeSinValores(e.informe) })),
        altcha,
      };
      const r = await fetch("/api/denuncias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "No se pudo enviar la denuncia.");
      setResultado(json);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : "No se pudo enviar la denuncia.");
      setAltcha("");
    } finally {
      setEnviando(false);
    }
  };

  if (resultado) {
    const texto = `SICODE · Comprobante de denuncia\n\nFolio: ${resultado.folio}\nClave de seguimiento: ${resultado.clave}\n\nCon estos dos datos puedes consultar el estatus y responder a la autoridad en la sección «Consultar estatus».\nLa clave no se puede recuperar: guárdala en un lugar seguro y no la compartas.\n`;
    return (
      <div className="mx-auto max-w-2xl">
        <Tarjeta className="text-center">
          <CheckCircle2 className="mx-auto size-12 text-verde" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-bold text-primary" tabIndex={-1}>Tu denuncia fue recibida</h1>
          <p className="mt-2 text-muted-foreground">Guarda estos dos datos. Son la única forma de darle seguimiento.</p>
          <dl className="mt-6 grid gap-4 text-left sm:grid-cols-2">
            {[
              ["Folio", resultado.folio],
              ["Clave de seguimiento", resultado.clave],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="rounded-lg border border-border bg-background/60 p-4">
                <dt className="text-sm font-semibold text-muted-foreground">{etiqueta}</dt>
                <dd className="mt-1 break-all font-mono text-lg font-bold tracking-wide">{valor}</dd>
              </div>
            ))}
          </dl>
          <Aviso tono="aviso" className="mt-5 text-left" icono={<TriangleAlert className="size-5" />} titulo="La clave solo se muestra esta vez">
            <p>
              No la guardamos: en el servidor solo queda una versión cifrada que no se puede revertir. Si la pierdes, nadie podrá
              recuperarla, ni siquiera la autoridad. Evita guardarla en un equipo o una cuenta del trabajo.
            </p>
          </Aviso>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Boton variante="secundario" onClick={() => navigator.clipboard.writeText(texto).then(() => setGuardada(true))}>
              <Copy className="size-4" aria-hidden="true" /> Copiar
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([texto], { type: "text/plain" }));
                const a = Object.assign(document.createElement("a"), { href: url, download: "comprobante-denuncia.txt" });
                a.click();
                URL.revokeObjectURL(url);
                setGuardada(true);
              }}
            >
              <Download className="size-4" aria-hidden="true" /> Descargar comprobante
            </Boton>
          </div>
          <p role="status" className="mt-3 min-h-6 text-sm font-semibold text-verde">{guardada ? "Listo. Verifica que quedó guardado antes de salir." : ""}</p>
          <div className="mt-4">
            <Link href="/seguimiento" className="font-semibold text-primary underline underline-offset-4">Ir a consultar estatus</Link>
          </div>
        </Tarjeta>
      </div>
    );
  }

  const err = errors as Record<string, { message?: string } | undefined> & { contacto?: Record<string, { message?: string }> };

  return (
    <form
      className="mx-auto max-w-3xl"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (paso < PASOS.length - 1) void siguiente();
      }}
    >
      <p className="text-sm font-semibold text-muted-foreground" aria-hidden="true">Paso {paso + 1} de {PASOS.length}</p>
      <h1 ref={encabezado} tabIndex={-1} className="mt-1 text-2xl font-bold text-primary sm:text-3xl">
        <span className="sr-only">Paso {paso + 1} de {PASOS.length}: </span>
        {PASOS[paso]}
      </h1>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }} />
      </div>

      <div className="mt-6 space-y-5">
        {/* ---------- Paso 1 ---------- */}
        {paso === 0 && (
          <>
            <Tarjeta>
              <fieldset>
                <legend className="text-lg font-bold">Elige cómo quieres presentar tu denuncia</legend>
                <p className="mt-1 text-sm text-muted-foreground">
                  Las dos opciones se atienden igual. Si dejas tus datos, se guardan cifrados y solo se abren con un motivo que queda registrado.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    { valor: true, titulo: "Quiero denunciar de forma anónima", texto: "No te pedimos ningún dato. Darás seguimiento con un folio y una clave.", Icono: EyeOff },
                    { valor: false, titulo: "Quiero dejar mis datos", texto: "Te pediremos un correo. El nombre y el teléfono son opcionales.", Icono: UserRound },
                  ].map(({ valor, titulo, texto, Icono }) => (
                    <label
                      key={String(valor)}
                      className={cx(
                        "flex cursor-pointer gap-3 rounded-lg border p-4 transition has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring",
                        anonimo === valor ? "border-primary bg-primary/10" : "border-border hover:bg-secondary",
                      )}
                    >
                      <input type="radio" name="modo" className="sr-only" checked={anonimo === valor} onChange={() => {
                          setValue("anonimo", valor, { shouldValidate: true });
                          // Al volver a anónimo se borra lo que se haya escrito de contacto.
                          if (valor) setValue("contacto", undefined);
                        }}
                      />
                      <Icono className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                      <span>
                        <span className="block font-semibold">{titulo}</span>
                        <span className="block text-sm text-muted-foreground">{texto}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </Tarjeta>
            {!anonimo && (
              <Tarjeta className="space-y-4">
                <Campo id="correo" type="email" autoComplete="off" etiqueta="Correo electrónico" ayuda="Usa un correo personal, no el del trabajo." error={err.contacto?.correo?.message} {...register("contacto.correo")} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo id="nombre" autoComplete="off" etiqueta="Nombre" opcional {...register("contacto.nombre")} />
                  <Campo id="telefono" type="tel" autoComplete="off" etiqueta="Teléfono" opcional {...register("contacto.telefono")} />
                </div>
              </Tarjeta>
            )}
            <Aviso icono={<Lightbulb className="size-5" />} titulo="Consejos para llenar tu denuncia">
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Cuenta lo que pasó de forma clara y sencilla. No necesitas palabras legales.</li>
                <li>Si recuerdas fechas, lugares y nombres, inclúyelos.</li>
                <li>Si tienes fotos, mensajes o documentos, podrás agregarlos más adelante.</li>
                <li>Para mayor protección, no uses una red ni un equipo del lugar donde ocurrieron los hechos.</li>
              </ul>
            </Aviso>
          </>
        )}

        {/* ---------- Paso 2 ---------- */}
        {paso === 1 && (
          <>
            <Tarjeta>
              <fieldset>
                <legend className="text-lg font-bold">¿Qué describe mejor lo que pasó?</legend>
                <p className="mt-1 text-sm text-muted-foreground">Marca las que apliquen. Si no estás seguro, puedes seguir sin marcar nada.</p>
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {CONDUCTAS.map((c) => {
                    const marcada = conductas.includes(c.clave);
                    return (
                      <label
                        key={c.clave}
                        className={cx(
                          "flex cursor-pointer gap-3 rounded-lg border p-3.5 text-sm transition has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring",
                          marcada ? "border-primary bg-primary/10" : "border-border hover:bg-secondary",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--primary))]"
                          checked={marcada}
                          onChange={() => setValue("conductas", marcada ? conductas.filter((x) => x !== c.clave) : [...conductas, c.clave])}
                        />
                        <span>
                          <span className="block font-semibold">{c.titulo}</span>
                          <span className="block text-muted-foreground">{c.ejemplo}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </Tarjeta>

            <Tarjeta className="space-y-4">
              <AreaTexto
                id="relato"
                etiqueta="Cuéntanos lo que pasó"
                ayuda={`Escribe los hechos con tus palabras. ${relato.length.toLocaleString("es-MX")} de 8,000 caracteres.`}
                error={err.narracionHechos?.message}
                rows={9}
                {...register("narracionHechos")}
              />
              <section aria-labelledby="titulo-riesgo" aria-live="polite">
                <div
                  className={cx(
                    "rounded-lg border p-4",
                    analisis.nivel === "alto" ? "border-rojo/60 bg-rojo/10" : analisis.nivel === "medio" ? "border-amarillo/60 bg-amarillo/10" : "border-verde/50 bg-verde/10",
                  )}
                >
                  <h2 id="titulo-riesgo" className="flex items-center gap-2 font-bold">
                    {analisis.nivel === "bajo" ? <ShieldCheck className="size-5" aria-hidden="true" /> : <ShieldAlert className="size-5" aria-hidden="true" />}
                    Protección de tu identidad:{" "}
                    {analisis.nivel === "alto" ? "riesgo alto" : analisis.nivel === "medio" ? "conviene revisar" : relato.trim().length < 40 ? "empieza a escribir" : "sin avisos"}
                  </h2>
                  <p className="mt-1 text-sm">
                    {relato.trim().length < 40
                      ? "Mientras escribes, revisamos aquí mismo si alguna frase puede revelar quién eres."
                      : analisis.resumen}
                  </p>
                  {analisis.hallazgos.length > 0 && (
                    <ul className="mt-3 space-y-2.5">
                      {analisis.hallazgos.map((h, i) => (
                        <li key={`${h.inicio}-${i}`} className="rounded-xl bg-card/80 p-3 text-sm">
                          <p className="font-semibold">
                            {h.titulo} <span className="font-normal text-muted-foreground">· riesgo {h.nivel}</span>
                          </p>
                          <p className="mt-0.5 italic">«{h.fragmento}»</p>
                          <p className="mt-1 text-muted-foreground">{h.consejo}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {analisis.hallazgos.length > 0 && <RelatoResaltado texto={relato} hallazgos={analisis.hallazgos} />}
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Esta revisión ocurre en tu dispositivo, con reglas fijas: tu texto no se envía a ningún servicio para analizarlo. Es una ayuda,
                  no una garantía. Puedes enviar tu denuncia aunque haya avisos.
                </p>
              </section>
            </Tarjeta>
          </>
        )}

        {/* ---------- Paso 3 ---------- */}
        {paso === 2 && (
          <>
            <Tarjeta className="space-y-4">
              <h2 className="text-lg font-bold">¿Dónde y cuándo ocurrió?</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Selector id="entidad" etiqueta="Estado" opcional {...register("lugar.entidad", { setValueAs: (v) => v || undefined })}>
                  <option value="">Selecciona un estado</option>
                  {Object.entries(ENTIDADES).map(([clave, nombre]) => (
                    <option key={clave} value={clave}>{nombre}</option>
                  ))}
                </Selector>
                <div>
                  <Campo
                    id="municipio"
                    etiqueta="Municipio o alcaldía"
                    opcional
                    list="lista-municipios"
                    autoComplete="off"
                    ayuda={entidad ? "Empieza a escribir y elige de la lista." : "Elige primero el estado para ver la lista."}
                    {...register("lugar.municipio")}
                  />
                  <datalist id="lista-municipios">
                    {(entidad ? MUNICIPIOS[entidad] ?? [] : []).map((m) => <option key={m} value={m} />)}
                  </datalist>
                </div>
              </div>
              <Campo
                id="institucion"
                etiqueta="Institución pública involucrada"
                opcional
                autoComplete="off"
                ayuda="Por ejemplo: «Municipio de León» o «Secretaría de Obras Públicas». Ayuda a turnar tu denuncia y a cruzarla con registros públicos."
                {...register("lugar.institucion")}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo id="fecha" type="month" etiqueta="Mes en que ocurrió" opcional ayuda="Solo mes y año: el día exacto no es necesario." error={err.fechaHecho?.message} {...register("fechaHecho")} />
                <Campo id="contratacion" etiqueta="Contrato o licitación relacionada" opcional autoComplete="off" ayuda="Número o nombre, si lo conoces." {...register("referenciaContratacion")} />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                El lugar se elige de un catálogo incluido en esta página. No usamos mapas ni buscadores externos, así que ninguna empresa recibe la dirección que consultas.
              </p>
            </Tarjeta>

            <Tarjeta>
              <h2 className="text-lg font-bold">¿Quién estuvo involucrado?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Agrega a las personas o empresas que señalas. Si no sabes un dato, déjalo vacío. Con nombre y apellido podemos buscar antecedentes en registros públicos.
              </p>
              <ul className="mt-4 space-y-4">
                {involucrados.fields.map((campo, i) => {
                  const tipo = watch(`involucrados.${i}.tipo`);
                  const e = (errors.involucrados?.[i] ?? {}) as Record<string, { message?: string }>;
                  return (
                    <li key={campo.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="flex items-center gap-2 font-semibold">
                          {tipo === "EMPRESA" ? <Building2 className="size-4" aria-hidden="true" /> : <UserRound className="size-4" aria-hidden="true" />}
                          {tipo === "EMPRESA" ? "Empresa" : tipo === "SERVIDOR_PUBLICO" ? "Persona servidora pública" : "Particular"} {i + 1}
                        </p>
                        <Boton variante="fantasma" className="min-h-9 px-3" onClick={() => involucrados.remove(i)} aria-label={`Quitar involucrado ${i + 1}`}>
                          <Trash2 className="size-4" aria-hidden="true" /> Quitar
                        </Boton>
                      </div>
                      {tipo === "EMPRESA" ? (
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <Campo id={`razon-${i}`} etiqueta="Nombre de la empresa" autoComplete="off" {...register(`involucrados.${i}.razonSocial`)} />
                          <Campo id={`rfc-${i}`} etiqueta="RFC de la empresa" opcional autoComplete="off" ayuda="Con el RFC la búsqueda es exacta." error={e.rfc?.message} {...register(`involucrados.${i}.rfc`)} />
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <Campo id={`nombre-${i}`} etiqueta="Nombre y apellidos" autoComplete="off" {...register(`involucrados.${i}.nombre`)} />
                          <Campo id={`cargo-${i}`} etiqueta="Cargo o área" opcional autoComplete="off" {...register(`involucrados.${i}.cargo`)} />
                          {tipo === "SERVIDOR_PUBLICO" && (
                            <div className="sm:col-span-2">
                              <Campo id={`inst-${i}`} etiqueta="Institución donde trabaja" opcional autoComplete="off" ayuda="Si es la misma de arriba, puedes dejarlo vacío." {...register(`involucrados.${i}.institucion`)} />
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                {(
                  [
                    ["SERVIDOR_PUBLICO", "Agregar persona servidora pública"],
                    ["EMPRESA", "Agregar empresa"],
                    ["PARTICULAR", "Agregar particular"],
                  ] as const
                ).map(([tipo, etiqueta]) => (
                  <Boton key={tipo} variante="secundario" disabled={involucrados.fields.length >= 8} onClick={() => involucrados.append({ tipo })}>
                    <Plus className="size-4" aria-hidden="true" /> {etiqueta}
                  </Boton>
                ))}
              </div>
            </Tarjeta>
          </>
        )}

        {/* ---------- Paso 4 ---------- */}
        {paso === 3 && (
          <Tarjeta>
            <h2 className="text-lg font-bold">Agrega fotos o documentos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Opcional. Antes de subir cada archivo lo limpiamos en tu dispositivo: quitamos ubicación, modelo del teléfono, autor y fechas ocultas.
              El archivo original no sale de tu equipo.
            </p>
            <label
              className={cx(
                "mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition hover:bg-secondary",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring",
                subiendo && "pointer-events-none opacity-60",
              )}
            >
              {subiendo ? <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" /> : <Upload className="size-7 text-primary" aria-hidden="true" />}
              <span className="font-semibold">{subiendo ? "Limpiando y subiendo…" : "Elegir archivos"}</span>
              <span className="text-sm text-muted-foreground">JPG, PNG, PDF, Word, Excel o PowerPoint. Hasta 15 MB cada uno y 8 archivos.</span>
              <input
                type="file"
                multiple
                className="sr-only"
                accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx,.pptx"
                disabled={subiendo}
                onChange={(e) => {
                  void agregarArchivos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {errorArchivo && <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{errorArchivo}</p>}

            <ul className="mt-4 space-y-3" aria-live="polite">
              {evidencias.map((e) => (
                <li key={e.id} className="rounded-lg border border-border p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-2 font-semibold">
                      <FileCheck2 className="size-4 shrink-0 text-verde" aria-hidden="true" />
                      <span className="break-all">{e.nombreOriginal}</span>
                    </p>
                    <Boton variante="fantasma" className="min-h-9 shrink-0 px-3" onClick={() => setEvidencias((p) => p.filter((x) => x.id !== e.id))} aria-label={`Quitar ${e.nombreOriginal}`}>
                      <Trash2 className="size-4" aria-hidden="true" /> Quitar
                    </Boton>
                  </div>
                  <p className="mt-1 text-muted-foreground">Se guardó como «{e.nombre}», sin tu nombre de archivo.</p>
                  {e.informe.hallazgos.length > 0 ? (
                    <>
                      <p className="mt-2 font-semibold">Esto revelaba tu archivo y ya lo quitamos:</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">
                        {e.informe.hallazgos.map((h) => <li key={h}>{h}</li>)}
                      </ul>
                    </>
                  ) : (
                    <p className="mt-2">No encontramos datos ocultos en este archivo.</p>
                  )}
                  {e.informe.advertencias.map((a) => (
                    <p key={a} className="mt-2 flex gap-2 text-warning">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> <span>{a}</span>
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}

        {/* ---------- Paso 5 ---------- */}
        {paso === 4 && (
          <>
            <Tarjeta>
              <h2 className="text-lg font-bold">Resumen de tu denuncia</h2>
              <dl className="mt-3 divide-y divide-border text-sm">
                {(
                  [
                    ["Modalidad", anonimo ? "Anónima: no enviaremos ningún dato tuyo" : `Con datos de contacto (${getValues("contacto.correo") ?? ""}), guardados cifrados`],
                    ["Conductas marcadas", conductas.map((c) => CONDUCTAS.find((x) => x.clave === c)?.titulo).join("; ") || "Ninguna"],
                    ["Lugar", [getValues("lugar.institucion"), getValues("lugar.municipio"), entidad ? ENTIDADES[entidad] : ""].filter(Boolean).join(", ") || "No indicado"],
                    ["Involucrados", (getValues("involucrados") ?? []).map((i) => i.razonSocial || i.nombre).filter(Boolean).join("; ") || "Ninguno"],
                    ["Evidencias", evidencias.length ? `${evidencias.length} archivo(s), ya sin datos ocultos` : "Ninguna"],
                    ["Protección del relato", analisis.nivel === "bajo" ? "Sin avisos" : analisis.resumen],
                  ] as const
                ).map(([etiqueta, valor]) => (
                  <div key={etiqueta} className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
                    <dt className="font-semibold text-muted-foreground">{etiqueta}</dt>
                    <dd>{valor}</dd>
                  </div>
                ))}
              </dl>
              <details className="mt-3 rounded-lg border border-border p-3 text-sm">
                <summary className="cursor-pointer font-semibold">Ver el relato completo</summary>
                <p className="mt-2 whitespace-pre-wrap leading-7">{relato}</p>
              </details>
              {analisis.nivel === "alto" && (
                <Aviso tono="peligro" className="mt-4" icono={<ShieldAlert className="size-5" />} titulo="Tu relato todavía tiene frases que pueden identificarte">
                  <p>
                    Puedes enviarlo así, pero te sugerimos <button type="button" className="font-semibold underline" onClick={() => irA(1)}>volver al paso 2</button> y revisarlas.
                  </p>
                </Aviso>
              )}
            </Tarjeta>
            <Tarjeta>
              <h2 className="text-lg font-bold">Verificación</h2>
              <p className="mb-3 mt-1 text-sm text-muted-foreground">
                Tu dispositivo resuelve un cálculo breve para comprobar que no es un programa automático. No usa imágenes ni servicios de otras empresas.
              </p>
              <AntiBot alVerificar={setAltcha} />
            </Tarjeta>
            {errorEnvio && (
              <Aviso tono="peligro" icono={<TriangleAlert className="size-5" />}>
                <p role="alert" className="font-semibold">{errorEnvio}</p>
              </Aviso>
            )}
          </>
        )}
      </div>

      {/* Barra de pasos flotante, como en el prototipo */}
      <div className="fixed inset-x-0 bottom-4 z-30 px-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-border bg-card p-2 shadow-lg">
          {paso === 0 ? (
            <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold hover:bg-secondary">Cancelar</Link>
          ) : (
            <Boton variante="fantasma" onClick={() => irA(paso - 1)}>
              <ArrowLeft className="size-4" aria-hidden="true" /> Anterior
            </Boton>
          )}
          <p className="hidden truncate text-sm text-muted-foreground sm:block" aria-hidden="true">
            {paso + 1} / {PASOS.length} · {PASOS[paso]}
          </p>
          {paso < PASOS.length - 1 ? (
            <Boton type="submit">
              Siguiente <ArrowRight className="size-4" aria-hidden="true" />
            </Boton>
          ) : (
            <Boton onClick={enviar} disabled={enviando}>
              {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {enviando ? "Enviando…" : "Enviar denuncia"}
            </Boton>
          )}
        </div>
      </div>
    </form>
  );
}
