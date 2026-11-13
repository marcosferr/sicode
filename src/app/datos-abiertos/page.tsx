import { Download, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { construirDatosAbiertos, K_DEFECTO, type Tabla } from "@/lib/abiertos/agregacion";
import { almacen } from "@/lib/almacen";
import { Aviso, Insignia, Tarjeta, Titulo } from "@/components/ui";

export const metadata: Metadata = { title: "Datos abiertos" };
export const dynamic = "force-dynamic";

const ENLACE = "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold hover:bg-secondary";

/**
 * Lista de barras de una sola serie: la magnitud va en la longitud y el valor se escribe
 * al lado, en tinta de texto. Un solo tono, sin leyenda. La tabla equivalente se descarga
 * en CSV y JSON, y cada fila es legible sin depender del color.
 */
function Barras({ tabla }: { tabla: Tabla }) {
  const dimension = tabla.columnas[0].clave;
  const medida = tabla.columnas[1].clave;
  const filas = tabla.filas.filter((f) => f[dimension] !== "Total");
  const total = tabla.filas.find((f) => f[dimension] === "Total");
  const maximo = Math.max(1, ...filas.map((f) => Number(f[medida]) || 0));
  return (
    <div>
      <ul className="space-y-2.5">
        {filas.map((f) => {
          const valor = f[medida] as number | null;
          return (
            <li key={String(f[dimension])} className="grid grid-cols-[minmax(7rem,45%)_1fr_auto] items-center gap-3 text-sm">
              <span className="leading-5">{f[dimension]}</span>
              <span className="h-2.5 rounded-full bg-secondary" aria-hidden="true">
                {valor === null ? (
                  <span className="block h-full w-10 rounded-full border border-dashed border-muted-foreground/60" />
                ) : (
                  <span className="block h-full min-w-1 rounded-full bg-primary" style={{ width: `${(valor / maximo) * 100}%` }} />
                )}
              </span>
              <span className="min-w-20 text-right font-semibold tabular-nums">
                {valor === null ? <span className="font-normal text-muted-foreground">{f.nota ?? "protegido"}</span> : valor.toLocaleString("es-MX")}
              </span>
            </li>
          );
        })}
        {filas.length === 0 && <li className="text-sm text-muted-foreground">Sin datos todavía.</li>}
      </ul>
      {total && (
        <p className="mt-3 border-t border-border pt-2 text-sm">
          <span className="font-semibold">Total: </span>
          {total[medida] === null ? "protegido" : Number(total[medida]).toLocaleString("es-MX")}
          {total.nota ? <span className="text-muted-foreground"> ({total.nota})</span> : null}
        </p>
      )}
    </div>
  );
}

function TablaTiempos({ tabla }: { tabla: Tabla }) {
  if (!tabla.filas.length) return <p className="text-sm text-muted-foreground">Aún no hay autoridades con suficientes denuncias cerradas para publicar su tiempo de atención.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{tabla.titulo}</caption>
        <thead>
          <tr className="border-b border-border">
            {tabla.columnas.map((c) => <th key={c.clave} scope="col" className="py-2 pr-4 font-semibold">{c.titulo}</th>)}
          </tr>
        </thead>
        <tbody>
          {tabla.filas.map((f, i) => (
            <tr key={i} className="border-b border-border/50">
              {tabla.columnas.map((c, j) => (
                <td key={c.clave} className={"py-2 pr-4 " + (j ? "tabular-nums" : "")}>{f[c.clave] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DatosAbiertos() {
  const k = Math.max(2, Number(process.env.SICODE_K_ANONIMATO) || K_DEFECTO);
  const c = construirDatosAbiertos(await almacen().listar(), k);
  const tabla = (id: string) => c.tablas.find((t) => t.id === id)!;
  const anonimas = tabla("por_modalidad").filas.find((f) => f.modalidad === "Anónima")?.denuncias as number | null | undefined;
  const total = c.totalDenuncias.valor;
  const cifras = [
    ["Denuncias recibidas", total === null ? `menos de ${k}` : `${c.totalesRedondeados ? "≈ " : ""}${total.toLocaleString("es-MX")}`],
    ["Denuncias anónimas", total && anonimas != null ? `${Math.round((anonimas / total) * 100)} %` : "protegido"],
    ["Tablas publicadas", String(c.tablas.length)],
    ["Umbral de protección", `${k} denuncias`],
  ];

  return (
    <div>
      <Titulo descripcion="Cifras agregadas del sistema de denuncias, listas para consultar, descargar y reutilizar.">Datos abiertos</Titulo>
      <p className="mt-3 text-center">
        <Insignia><ShieldCheck className="size-3.5" aria-hidden="true" /> Datos agregados, sin información personal · actualizados el {c.generado}</Insignia>
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cifras.map(([etiqueta, valor]) => (
          <Tarjeta key={etiqueta} className="p-4 sm:p-5">
            <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
            <dd className="mt-1 text-2xl font-bold">{valor}</dd>
          </Tarjeta>
        ))}
      </dl>

      {c.totalesRedondeados && (
        <p className="mt-3 text-center text-sm text-muted-foreground">Las cifras de esta página están redondeadas a múltiplos de {k}.</p>
      )}

      <Aviso className="mt-5" icono={<ShieldCheck className="size-5" />} titulo="Por qué algunas cifras aparecen protegidas">
        <p>
          Una cifra muy pequeña puede delatar a quien denunció: si en un lugar hubo una sola denuncia de cierto tipo, la persona señalada puede deducir de quién vino.
          Por eso toda cifra menor a {k} se publica sin valor y, cuando eso ocurre, todas las demás cifras se redondean a múltiplos de {k} para que no se pueda calcular por resta.
          Tampoco se publican relatos, nombres, folios, municipios ni días exactos.
        </p>
      </Aviso>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {c.tablas.map((t) => (
          <Tarjeta key={t.id} className={t.id === "tiempos_por_autoridad" || t.id === "por_conducta" ? "lg:col-span-2" : ""}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold">{t.titulo}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{t.descripcion}</p>
              </div>
              <div className="flex gap-2">
                <a className={ENLACE} href={`/api/abiertos/${t.id}.csv`} download>
                  <Download className="size-3.5" aria-hidden="true" /> CSV<span className="sr-only"> de {t.titulo}</span>
                </a>
                <a className={ENLACE} href={`/api/abiertos/${t.id}.json`}>
                  JSON<span className="sr-only"> de {t.titulo}</span>
                </a>
              </div>
            </div>
            <div className="mt-4">{t.id === "tiempos_por_autoridad" ? <TablaTiempos tabla={t} /> : <Barras tabla={t} />}</div>
            {t.proteccion.celdasSuprimidas > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {t.proteccion.celdasSuprimidas} cifra(s) protegida(s) por ser menores a {k}. Las demás están redondeadas a múltiplos de {k}.
              </p>
            )}
          </Tarjeta>
        ))}
      </div>

      <Tarjeta className="mt-5">
        <h2 className="text-lg font-bold">Para reutilizar los datos</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6">
          <li>
            <a className="font-semibold text-primary underline underline-offset-4" href="/api/abiertos/todo.json">Conjunto completo en JSON</a>: todas las tablas en un solo archivo.
          </li>
          <li>
            <a className="font-semibold text-primary underline underline-offset-4" href="/api/abiertos/datapackage.json">Descriptor Data Package</a>: nombres, tipos y descripción de cada columna, en el estándar Frictionless.
          </li>
          <li>Los archivos CSV usan UTF-8 y una celda vacía significa «protegido», no cero.</li>
          <li>Licencia de los datos: Creative Commons Atribución 4.0.</li>
        </ul>
      </Tarjeta>
    </div>
  );
}
