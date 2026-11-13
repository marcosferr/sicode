import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BotonSalir } from "@/components/BotonSalir";
import { Aviso, Insignia, Semaforo, Tarjeta } from "@/components/ui";
import { hayOperador } from "@/lib/auth";
import { CONDUCTA_POR_CLAVE, ENTIDADES } from "@/lib/catalogos";
import { modoDemo } from "@/lib/pdn/demo";
import { listarParaOperador } from "@/lib/servicio";
import { ESTADOS } from "@/lib/tipos";

export const metadata: Metadata = { title: "Bandeja de denuncias" };
export const dynamic = "force-dynamic";

export default async function Bandeja() {
  const operador = await hayOperador();
  if (!operador) redirect("/operador");
  const denuncias = await listarParaOperador();
  const cuenta = (f: (d: (typeof denuncias)[number]) => boolean) => denuncias.filter(f).length;
  const resumen = [
    ["Sin turnar", cuenta((d) => d.status === "SIN_TURNAR")],
    ["Sin corroborar", cuenta((d) => !d.corroboracion)],
    ["Respaldo fuerte", cuenta((d) => d.corroboracion?.semaforo.color === "rojo")],
    ["Esperan respuesta de la autoridad", cuenta((d) => d.mensajes.at(-1)?.autor === "DENUNCIANTE")],
  ] as const;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary">Bandeja de denuncias</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sesión: {operador}. Ordenadas por nivel de respaldo en datos públicos.</p>
        </div>
        <BotonSalir />
      </div>

      {modoDemo() && (
        <Aviso tono="aviso" className="mt-4" titulo="Fuentes de demostración">
          <p>La corroboración está usando registros ficticios (SICODE_PDN=demo), no la PDN real.</p>
        </Aviso>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {resumen.map(([etiqueta, valor]) => (
          <Tarjeta key={etiqueta} className="p-4 sm:p-4">
            <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
            <dd className="text-2xl font-bold">{valor}</dd>
          </Tarjeta>
        ))}
      </dl>

      {denuncias.length === 0 ? (
        <Tarjeta className="mt-5 text-center">
          <Inbox className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-semibold">Todavía no hay denuncias.</p>
          <p className="text-sm text-muted-foreground">Para cargar casos ficticios de demostración ejecute <code>npm run demo</code>.</p>
        </Tarjeta>
      ) : (
        <ul className="mt-5 space-y-3">
          {denuncias.map((d) => (
            <li key={d.id}>
              <Link href={`/operador/denuncia/${d.id}`} className="block rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm transition hover:border-primary hover:shadow-md sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold">{d.folio}</span>
                  <Semaforo color={d.corroboracion?.semaforo.color} />
                  <Insignia>{ESTADOS[d.status].etiqueta}</Insignia>
                  {d.prioridad && <Insignia>Prioridad {d.prioridad.toLowerCase()}</Insignia>}
                  <Insignia>{d.anonimo ? "Anónima" : "Con contacto"}</Insignia>
                  {d.mensajes.at(-1)?.autor === "DENUNCIANTE" && <Insignia className="border-primary text-primary">Respondió quien denunció</Insignia>}
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6">{d.narracionHechos}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Recibida el {d.fechaRecepcion}
                  {d.lugar.entidad ? ` · ${ENTIDADES[d.lugar.entidad]}` : ""}
                  {d.lugar.institucion ? ` · ${d.lugar.institucion}` : ""}
                  {d.conductas.length ? ` · ${d.conductas.map((c) => CONDUCTA_POR_CLAVE.get(c)?.fundamentos[0]?.nombre).filter(Boolean).join(", ")}` : ""}
                  {d.corroboracion ? ` · ${d.corroboracion.indicios.length} indicio(s)` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
