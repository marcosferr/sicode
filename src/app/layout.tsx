import type { Metadata, Viewport } from "next";
import { Noto_Sans } from "next/font/google";
import Link from "next/link";
import { Encabezado } from "@/components/Encabezado";
import { Proveedores } from "@/components/Proveedores";
import "./globals.css";

// next/font descarga la tipografía al compilar y la sirve desde este mismo sitio:
// el navegador de quien denuncia no contacta a Google ni a ningún tercero.
const noto = Noto_Sans({ subsets: ["latin"], variable: "--font-noto", display: "swap" });

export const metadata: Metadata = {
  title: { default: "SICODE · Sistema Integral de Corroboración de Denuncias", template: "%s · SICODE" },
  description:
    "Complemento abierto para el Sistema de Denuncias (S5) de la Plataforma Digital Nacional: protege la identidad de quien denuncia y corrobora los hechos con datos públicos.",
  // Sin rastreo de terceros y sin enviar la página de origen a otros sitios.
  referrer: "no-referrer",
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#611232" },
    { media: "(prefers-color-scheme: dark)", color: "#490e26" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX" suppressHydrationWarning className={noto.variable}>
      <body className="flex min-h-dvh flex-col">
        <Proveedores>
          <a
            href="#contenido"
            className="sr-only z-50 rounded-md bg-card px-4 py-2 font-semibold text-foreground shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Saltar al contenido
          </a>
          <Encabezado />
          <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-8 sm:px-6">
            {children}
          </main>
          <footer className="border-t border-border bg-card">
            <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-24 pt-8 text-sm sm:grid-cols-[1.4fr_1fr] sm:px-6">
              <div>
                <p className="font-bold text-primary">SICODE · Sistema Integral de Corroboración de Denuncias</p>
                <p className="mt-2 leading-6 text-muted-foreground">
                  Prototipo de código abierto desarrollado para el Datatón Anticorrupción 2026. No es un sitio oficial de la SESNA ni de la
                  Plataforma Digital Nacional, y no usa sus logotipos.
                </p>
              </div>
              <nav aria-label="Enlaces del pie de página">
                <ul className="grid gap-2 sm:justify-end">
                  <li><Link className="font-semibold text-primary underline underline-offset-4" href="/privacidad">Cómo te protegemos</Link></li>
                  <li><Link className="font-semibold text-primary underline underline-offset-4" href="/datos-abiertos">Datos abiertos</Link></li>
                  <li><Link className="font-semibold text-primary underline underline-offset-4" href="/operador">Acceso de autoridades</Link></li>
                  <li><a className="font-semibold text-primary underline underline-offset-4" href="https://github.com/marcosferr/sicode" rel="noreferrer">Código fuente (CC BY-NC 4.0)</a></li>
                </ul>
              </nav>
            </div>
          </footer>
        </Proveedores>
      </body>
    </html>
  );
}
