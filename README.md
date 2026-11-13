# SICODE · Sistema Integral de Corroboración de Denuncias

Complemento de código abierto para el **Sistema de denuncias públicas de faltas administrativas y hechos de corrupción (S5)** de la Plataforma Digital Nacional. Propuesta para el **Datatón Anticorrupción 2026**.

> Entre más se puede comprobar una denuncia con datos públicos, menos necesita la autoridad saber quién la presentó.

SICODE hace dos cosas que el prototipo del S5 todavía no hace:

1. **Protege la identidad de quien denuncia más allá del formulario.** Limpia los metadatos de las evidencias en el propio dispositivo, avisa cuando una frase del relato delata a su autor, no contacta a ningún tercero y publica datos abiertos que no permiten deducir quién denunció.
2. **Corrobora la denuncia con los sistemas 1, 2, 3 y 6 de la PDN.** Extrae las personas, empresas y entes señalados, los cruza con sancionados, servidores en contrataciones, contrataciones y declaraciones, y entrega a la autoridad indicios con su fuente y un semáforo de prioridad explicado.

No es un sitio oficial de la SESNA ni de la PDN, y no usa sus logotipos.

## Qué incluye

| Pieza | Para quién | Qué hace |
|---|---|---|
| Formulario de denuncia en cinco pasos | Ciudadanía | Denuncia anónima o con datos cifrados, aviso de riesgo en el relato, limpieza de evidencias, catálogo de lugares sin servicios externos |
| Seguimiento con folio y clave | Ciudadanía | Estatus del trámite y buzón de ida y vuelta con la autoridad, sin correo ni cuenta |
| Bandeja y detalle | Autoridad | Denuncias ordenadas por nivel de respaldo, corroboración con la PDN, turnado, prioridad, cierre con resumen público, bitácora |
| Datos abiertos | Todos | Siete tablas agregadas en CSV y JSON, con descriptor Data Package y protección de cifras pequeñas |

## Cómo responde a los criterios del Datatón

| Criterio | Dónde está |
|---|---|
| 1. Confidencialidad y protección de la identidad | [docs/confidencialidad.md](docs/confidencialidad.md): 12 medidas implementadas, modelo de amenazas y límites |
| 2. Valor público | Bandeja priorizada por respaldo documental; hipótesis verificables por denuncia; fundamento orientativo de la LGRA y del CPF |
| 3. Funcionalidad técnica | 47 pruebas automáticas; flujo completo probado contra la PDN real y contra Directus |
| 4. Explotación de datos de la PDN | [docs/metodologia.md](docs/metodologia.md): cruce con S1, S2, S3 y S6; el S5 genera además un conjunto de datos abiertos nuevo |
| 5. Experiencia de usuario y accesibilidad | Lighthouse: accesibilidad 100 en las páginas auditadas; texto ampliable, alto contraste, lectura en voz, navegación por teclado |
| 6. Creatividad e innovación | Aviso de riesgo de identificación en el relato; limpieza de evidencias en el navegador; protección de datos abiertos contra la resta |
| 7 y 8. Presentación y documentación | Este archivo y la carpeta [docs/](docs/) |

## Puesta en marcha

Requisitos: Node.js 20 o superior. Docker solo si se quiere usar Directus.

```bash
git clone https://github.com/marcosferr/sicode.git && cd sicode
npm install
npm run preparar     # crea .env.local con secretos aleatorios y un operador de demostración
npm run demo         # carga 39 denuncias ficticias
npm run dev          # http://localhost:3000
```

El correo y la contraseña del operador de demostración quedan en `.env.local`. El folio y la clave de una denuncia de prueba quedan en `var/demo-seguimiento.txt`.

Así como viene, la corroboración usa **registros ficticios** (`SICODE_PDN=demo`) para poder mostrar el sistema sin escribir acusaciones contra personas o empresas reales.

### Usar los datos reales de la PDN

```bash
npm run datos        # descarga S2 y S3 (22 MB) y arma los índices locales en var/pdn/
```

Después cambie `SICODE_PDN=real` en `.env.local` y reinicie. El S6 y el S1 se consultan por API con caché en disco. Para probar el motor desde la terminal:

```bash
npx tsx scripts/probar-en-vivo.ts --persona "Nombre Apellido Apellido" --ente "Nombre del ente"
```

### Usar Directus (el backend del prototipo del S5)

```bash
cp .env.directus.example .env.directus   # cambie todos los valores
docker compose up -d
# en .env.local: SICODE_ALMACEN=directus, DIRECTUS_URL y DIRECTUS_TOKEN (el ADMIN_TOKEN)
npm run directus     # crea las colecciones sicode_denuncias y sicode_archivos
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | Servidor de desarrollo, compilación y servidor de producción |
| `npm test` | Pruebas automáticas (sin red) |
| `npm run typecheck` / `npm run lint` | Verificación de tipos y estilo |
| `npm run preparar` | Genera `.env.local` |
| `npm run demo` | Carga denuncias ficticias |
| `npm run datos` | Descarga e indexa los datos abiertos de S2 y S3 |
| `npm run directus` | Crea las colecciones en Directus |

## Tecnología

Las mismas piezas que el prototipo del S5: Next.js (App Router) con TypeScript, Tailwind CSS, React Hook Form con Zod, NextAuth, Directus y ALTCHA. Se suman pdf-lib, JSZip y exifr para la limpieza de archivos.

## Documentación

- [docs/metodologia.md](docs/metodologia.md): cómo se corrobora una denuncia, fuentes, reglas de prudencia y semáforo.
- [docs/confidencialidad.md](docs/confidencialidad.md): medidas de protección, modelo de amenazas, límites y configuración del servidor.
- [docs/datos-abiertos.md](docs/datos-abiertos.md): tablas publicadas, protección de cifras pequeñas y diccionario de datos.
- [docs/arquitectura.md](docs/arquitectura.md): estructura del código, modelo de datos e integración con el S5.
- [DECLARACION_IA.md](DECLARACION_IA.md): uso de herramientas de inteligencia artificial, su finalidad y alcance.

## Límites conocidos

- El S6 publicado en la PDN es de ámbito federal y sus ciclos van de 2015 a 2021. Lo estatal y casi todo lo posterior no aparece.
- El S3 no publica nombres en las faltas no graves, así que solo se cruzan personas en faltas graves.
- Coincidir en nombre y ente no es una identificación: el S2 y el S3 no publican un identificador de la persona. Por eso esos indicios nunca pasan de confiabilidad B.
- El aviso de riesgo del relato usa reglas, no comprensión del texto. Reduce descuidos frecuentes; no garantiza el anonimato.
- La clasificación jurídica es orientativa y debe validarla la autoridad competente.
- Los valores del semáforo son una propuesta de partida. La autoridad que adopte el sistema debe revisarlos.

## Licencia

Código: [Creative Commons Atribución-NoComercial 4.0](LICENSE), como piden las bases del Datatón. Los datos de la PDN y el catálogo de municipios del INEGI conservan la licencia de su fuente.
