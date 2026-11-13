import type { Metadata } from "next";
import { Aviso, Tarjeta, Titulo } from "@/components/ui";

export const metadata: Metadata = { title: "Cómo te protegemos" };

const MEDIDAS: [string, string][] = [
  ["No registramos tu dirección IP ni tu navegador", "Las rutas que reciben denuncias no leen esos datos, así que no quedan en la base ni en la bitácora del sistema."],
  ["No hay terceros en la página", "La tipografía, los íconos, el catálogo de municipios y la verificación anti-bots se sirven desde este mismo sitio. No usamos mapas, analítica ni servicios externos que puedan ver que entraste a denunciar."],
  ["Tus archivos se limpian antes de salir de tu dispositivo", "Quitamos ubicación GPS, modelo del teléfono, autor, fechas ocultas y nombres en comentarios de fotos, PDF y documentos de Office. El servidor repite la limpieza y guarda el archivo con un nombre genérico."],
  ["Te avisamos si tu relato te delata", "Mientras escribes, revisamos en tu dispositivo si alguna frase revela tu puesto, tu área, un grupo pequeño de testigos o tus datos de contacto, y te sugerimos cómo decirlo sin exponerte."],
  ["Seguimiento sin correo ni cuenta", "Recibes un folio aleatorio y una clave que se muestra una sola vez. El servidor solo guarda una derivación irreversible de esa clave: nadie, ni la autoridad, puede usarla para hacerse pasar por ti."],
  ["Buzón de ida y vuelta", "La autoridad puede pedirte aclaraciones y tú puedes responder con tu folio y tu clave, sin dar ningún dato."],
  ["Guardamos el día, no la hora", "La hora exacta de envío podría cruzarse con registros de entrada a un edificio o de conexión a una red. Solo se guarda la fecha."],
  ["Si dejas tus datos, van cifrados", "Se cifran con una llave que no está en la base de datos. Abrirlos exige que la autoridad escriba un motivo, que queda en la bitácora de la denuncia junto con su usuario."],
  ["La corroboración no te necesita", "El cruce con datos públicos usa solo lo que señalas: personas, empresas e instituciones. Ningún dato tuyo entra en esas consultas."],
  ["Los datos abiertos no te delatan", "Solo publicamos cifras agregadas. Las menores a cinco se ocultan y los totales se redondean para que no puedan calcularse por resta."],
];

const LIMITES: [string, string][] = [
  ["Tu conexión a internet", "Tu proveedor de internet o el administrador de la red desde la que te conectas pueden ver que visitaste este sitio, aunque no lo que escribiste. Evita la red y los equipos del lugar donde ocurrieron los hechos. Para mayor protección puedes usar el navegador Tor."],
  ["Lo que se ve en tus evidencias", "Limpiamos los datos ocultos, no el contenido: una captura con tu nombre de usuario, tu cara en un reflejo o un documento que solo tú recibiste siguen identificándote."],
  ["Lo que solo tú sabes", "Si pocas personas conocían el hecho, quien fue denunciado puede sospechar de ellas sin importar qué tan bien esté protegido el sistema. El aviso del relato ayuda, pero no puede saber quién más estaba enterado."],
  ["El servidor donde se instale", "El programa no guarda tu IP, pero un servidor web o un equipo de red mal configurado delante de él sí podría hacerlo. La documentación incluye la configuración recomendada para que no ocurra."],
  ["Quien administra el servidor", "Una persona con control total del servidor podría alterarlo. Por eso el código es abierto y auditable, y la documentación describe qué revisar."],
];

export default function Privacidad() {
  return (
    <div className="mx-auto max-w-3xl">
      <Titulo descripcion="Qué hacemos para que tu identidad no forme parte de la denuncia, y qué no podemos garantizar.">
        Cómo te protegemos
      </Titulo>

      <Tarjeta className="mt-8">
        <h2 className="text-xl font-bold text-primary">Lo que sí hace el sistema</h2>
        <ol className="mt-4 space-y-4">
          {MEDIDAS.map(([titulo, texto], i) => (
            <li key={titulo} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">{i + 1}</span>
              <div>
                <h3 className="font-semibold">{titulo}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </Tarjeta>

      <Tarjeta className="mt-5">
        <h2 className="text-xl font-bold text-primary">Lo que ningún sistema puede garantizar</h2>
        <p className="mt-1 text-sm text-muted-foreground">Preferimos decirlo con claridad para que decidas con información completa.</p>
        <ul className="mt-4 space-y-4">
          {LIMITES.map(([titulo, texto]) => (
            <li key={titulo}>
              <h3 className="font-semibold">{titulo}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{texto}</p>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <Aviso className="mt-5" titulo="Sobre este sitio">
        <p>
          SICODE es un prototipo de código abierto presentado al Datatón Anticorrupción 2026. No es un canal oficial de denuncia.
          El modelo de amenazas completo y la configuración recomendada están en la{" "}
          <a className="font-semibold text-primary underline underline-offset-4" href="https://github.com/marcosferr/sicode/blob/main/docs/confidencialidad.md" rel="noreferrer">
            documentación del proyecto
          </a>.
        </p>
      </Aviso>
    </div>
  );
}
