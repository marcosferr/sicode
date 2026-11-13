import { ArrowRight, BarChart3, EyeOff, FileSearch, Fingerprint, KeyRound, MessagesSquare, PenLine, Scale, Search } from "lucide-react";
import Link from "next/link";
import { EnlaceBoton } from "@/components/ui";

const GARANTIAS = [
  { icono: EyeOff, titulo: "No guardamos quién eres", texto: "Sin dirección IP, sin rastreadores y sin servicios de otras empresas. Tampoco se guarda la hora exacta del envío." },
  { icono: Fingerprint, titulo: "Limpiamos lo que te delata", texto: "Tus archivos se limpian en tu dispositivo antes de salir, y te avisamos si una frase de tu relato puede identificarte." },
  { icono: Scale, titulo: "Los datos respaldan tu denuncia", texto: "Cruzamos lo denunciado con registros públicos. Entre más se comprueba así, menos importa quién lo dijo." },
];

const PASOS = [
  { icono: PenLine, titulo: "Cuenta lo que pasó", texto: "Con tus palabras, en cinco pasos breves. Puedes adjuntar fotos y documentos." },
  { icono: KeyRound, titulo: "Guarda tu folio y tu clave", texto: "Se muestran una sola vez. Con ellos das seguimiento sin correo ni cuenta." },
  { icono: MessagesSquare, titulo: "Sigue tu caso", texto: "Consulta el estatus y responde a la autoridad por un buzón anónimo." },
];

const OTRAS = [
  { href: "/seguimiento", icono: Search, titulo: "Consultar estatus", texto: "Ya presenté una denuncia y tengo mi folio y mi clave." },
  { href: "/datos-abiertos", icono: BarChart3, titulo: "Datos abiertos", texto: "Cifras del sistema para consultar y descargar." },
  { href: "/privacidad", icono: FileSearch, titulo: "Cómo te protegemos", texto: "Qué hace el sistema y cuáles son sus límites." },
];

export default function Inicio() {
  return (
    <div className="space-y-14">
      <section className="grid items-center gap-8 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-gob-verde">Denuncia ciudadana</p>
          <h1 className="mt-2 text-balance text-4xl font-extrabold leading-tight tracking-tight text-primary sm:text-5xl">
            Denuncia la corrupción sin exponerte
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-lg leading-8 text-muted-foreground">
            Reporta faltas administrativas y hechos de corrupción de personas servidoras públicas o de particulares.
            Tu identidad no forma parte de la denuncia.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <EnlaceBoton href="/denunciar" className="min-h-12 px-6 text-base">
              Presentar denuncia <ArrowRight className="size-4" aria-hidden="true" />
            </EnlaceBoton>
            <EnlaceBoton href="/seguimiento" variante="secundario" className="min-h-12 px-6 text-base">
              Consultar estatus
            </EnlaceBoton>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Toma unos 10 minutos. No necesitas crear una cuenta.</p>
        </div>

        <ul className="space-y-3" aria-label="Así cuidamos tu identidad">
          {GARANTIAS.map(({ icono: Icono, titulo, texto }) => (
            <li key={titulo} className="flex gap-4 rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-gob-verde/10 text-gob-verde">
                <Icono className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-bold">{titulo}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-pasos">
        <h2 id="titulo-pasos" className="text-2xl font-bold text-primary">Cómo funciona</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {PASOS.map(({ icono: Icono, titulo, texto }, i) => (
            <li key={titulo} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">{i + 1}</span>
                <Icono className="size-5 text-dorado" aria-hidden="true" />
              </div>
              <h3 className="mt-3 font-bold">{titulo}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <nav aria-labelledby="titulo-otras">
        <h2 id="titulo-otras" className="text-2xl font-bold text-primary">También puedes</h2>
        <ul className="mt-5 grid gap-4 md:grid-cols-3">
          {OTRAS.map(({ href, icono: Icono, titulo, texto }) => (
            <li key={href}>
              <Link href={href} className="group flex h-full gap-4 rounded-xl border border-border bg-card p-5 transition hover:border-primary hover:shadow-md">
                <Icono className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="flex items-center gap-1.5 font-bold text-primary">
                    {titulo} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">{texto}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
