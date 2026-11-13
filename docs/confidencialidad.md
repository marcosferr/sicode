# Confidencialidad y protección de la identidad

Este documento describe qué hace SICODE para que la identidad de quien denuncia no forme parte de la denuncia, contra qué amenazas protege y cuáles son sus límites. Cubre las tres etapas que piden las bases: recepción, trámite y seguimiento.

## Medidas implementadas

| # | Medida | Etapa | Dónde está en el código |
|---|---|---|---|
| 1 | No se lee ni se guarda la dirección IP ni el navegador | Recepción | `src/app/api/denuncias/route.ts` no lee encabezados de la petición |
| 2 | El navegador solo puede hablar con este sitio (política de seguridad de contenido) | Recepción | `next.config.ts` |
| 3 | Las evidencias se limpian de metadatos en el dispositivo, antes de subirse | Recepción | `src/lib/blindaje/metadatos.ts` |
| 4 | El servidor repite la limpieza y guarda el archivo con un nombre genérico | Recepción | `recibirEvidencia` en `src/lib/servicio.ts` |
| 5 | Aviso de frases que identifican a quien escribe, calculado en el dispositivo | Recepción | `src/lib/blindaje/relato.ts` |
| 6 | Se guarda el día de recepción, no la hora | Recepción | `soloDia` en `src/lib/seguridad.ts` |
| 7 | Folio aleatorio, no consecutivo | Seguimiento | `nuevoFolio` en `src/lib/seguridad.ts` |
| 8 | Clave de seguimiento que se muestra una vez y se guarda derivada con scrypt | Seguimiento | `derivarClave` y `verificarClave` |
| 9 | Buzón anónimo de ida y vuelta, sin correo ni cuenta | Seguimiento | `responderComoDenunciante` y `escribirADenunciante` |
| 10 | Datos de contacto cifrados (AES-256-GCM); abrirlos exige un motivo que queda en bitácora | Trámite | `cifrarContacto` y `revelarContacto` |
| 11 | La corroboración no usa ningún dato de quien denuncia, y cruza personas en copia local | Trámite | `src/lib/motor/corroborar.ts`, `src/lib/pdn/fuentes.ts` |
| 12 | Datos abiertos con supresión de cifras pequeñas y redondeo contra la resta | Publicación | `src/lib/abiertos/agregacion.ts` |

### Detalle de las menos evidentes

**Sin terceros (medida 2).** El prototipo del S5 usa Mapbox para buscar la dirección de los hechos, de modo que una empresa externa recibe lo que la persona escribe y su IP. SICODE reemplaza el buscador por un catálogo del INEGI incluido en la página (32 entidades, 2,476 municipios). La tipografía se descarga al compilar y se sirve desde el propio sitio. La verificación anti-bots es ALTCHA alojado aquí mismo. La cabecera `Content-Security-Policy` con `connect-src 'self'` hace que el navegador rechace cualquier conexión a otro dominio, incluso si un cambio futuro la introdujera por descuido.

Comprobación: al cargar `/denunciar` en un navegador sin extensiones, las 27 peticiones van al propio sitio.

**Limpieza de evidencias (medidas 3 y 4).** Se quitan EXIF (ubicación GPS, marca y modelo, fechas, número de serie), XMP, IPTC y comentarios en JPEG; textos incrustados, EXIF y fecha en PNG; autor, título, programa, fechas y XMP en PDF; autor, última persona que modificó, organización y autores de comentarios y de cambios con seguimiento en Word, Excel y PowerPoint. La orientación de la foto se conserva para que no quede girada.

La persona ve qué revelaba su archivo ("Ubicación exacta donde se tomó la foto"). Ese detalle se queda en su navegador: al servidor solo viaja la categoría de lo que se quitó, nunca el valor. Los formatos que no se pueden limpiar (audio, video, HEIC) se rechazan con una explicación, en lugar de aceptarse a ciegas.

**Aviso en el relato (medida 5).** Una denuncia puede ser anónima en el formulario y delatar a su autor en el texto. El módulo marca, mientras se escribe: nombre propio, correo, teléfono, CURP, número de empleado, frases de unicidad ("soy la única que…"), grupos pequeños de testigos, puesto propio, vínculos de trabajo o familiares con quien escribe, área propia, antigüedad, hora exacta de presencia y conversaciones a solas. Para cada una sugiere cómo decir lo mismo sin exponerse.

Son reglas que corren en el navegador. No se usa un modelo de lenguaje ni un servicio externo: enviar el relato a un tercero para "protegerlo" sería la fuga que se busca evitar.

**Clave de seguimiento (medida 8).** Son 20 caracteres aleatorios (unos 99 bits). El servidor guarda solo su derivación con scrypt y una sal por denuncia. Ni un operador ni una copia de la base permiten consultar o responder en nombre de quien denunció. Tras cinco intentos fallidos, el folio se bloquea 15 minutos; como no se guarda IP, cada consulta exige además una prueba de trabajo, que encarece los intentos automáticos. Un folio inexistente y una clave incorrecta dan la misma respuesta y cuestan lo mismo.

**Corroboración (medida 11).** El motor recibe el relato, las personas y empresas señaladas y el ente. No recibe contacto, clave ni folio. Sancionados (S3) y servidores en contrataciones (S2) se cruzan contra una copia local: si se consultara la API por cada persona denunciada, quien opere esa API podría deducir que existe una denuncia. Contrataciones (S6) y declaraciones (S1) son demasiado grandes para copiarlas y se consultan por API desde el servidor, nunca desde el navegador de quien denuncia. La consulta de declaraciones se puede apagar con `SICODE_S1=off`.

## Modelo de amenazas

| Quién | Qué intenta | Qué lo impide o lo limita |
|---|---|---|
| La persona denunciada, con acceso a datos abiertos | Deducir quién denunció a partir de cifras pequeñas | Supresión de celdas menores a K y redondeo de todas las cifras cuando hay supresión |
| La persona denunciada, con acceso a la evidencia | Leer en el archivo quién lo creó o dónde se tomó | Limpieza de metadatos en dos pasos |
| Una persona operadora curiosa | Ver el contacto de quien denunció | Cifrado; apertura con motivo y rastro en bitácora; la vista de operador no incluye el contacto |
| Una persona operadora | Suplantar a quien denunció en el buzón | La clave no se guarda; solo su derivación |
| Alguien con una copia de la base de datos | Leer contactos o claves | El contacto está cifrado con una llave que no vive en la base; las claves están derivadas |
| Un tercero en la página (mapas, analítica, fuentes) | Saber quién entró a denunciar y qué buscó | No hay terceros y el navegador no puede contactarlos |
| Quien correlaciona tiempos | Cruzar la hora de envío con registros de acceso | Solo se guarda el día |
| Un programa automático | Enviar denuncias en masa o adivinar claves | Prueba de trabajo por envío y por consulta; bloqueo por folio |

## Lo que SICODE no puede garantizar

- **La red de quien denuncia.** El proveedor de internet o el administrador de una red institucional ven que se visitó el sitio. La interfaz recomienda no usar la red ni los equipos del lugar de los hechos. El sitio funciona con el navegador Tor.
- **El contenido visible de las evidencias.** Se limpian datos ocultos, no lo que se ve en la imagen o el documento.
- **Lo que solo una persona sabe.** Si pocas personas conocían el hecho, la sospecha recae en ellas con independencia del sistema.
- **La infraestructura delante de la aplicación.** Un proxy o un balanceador pueden registrar direcciones IP aunque la aplicación no lo haga. Ver la configuración recomendada.
- **Quien administra el servidor.** Con control total del equipo se puede modificar el programa. Mitigación: código abierto, despliegues reproducibles y auditoría externa.
- **El análisis de estilo.** Una persona que conoce cómo escribe otra puede reconocerla. El aviso del relato no cubre esto.

## Configuración recomendada del servidor

La aplicación no registra direcciones IP, pero el servidor web que se ponga delante sí lo hace por defecto. Con nginx:

```nginx
# Sin registro de accesos en las rutas que reciben denuncias y consultas de seguimiento.
location ~ ^/(api/(denuncias|evidencias|seguimiento|altcha)|denunciar|seguimiento) {
    access_log off;
    proxy_pass http://127.0.0.1:3000;
    # No se reenvía la IP de origen a la aplicación.
    proxy_set_header X-Forwarded-For "";
    proxy_set_header X-Real-IP "";
}
```

Además:

- `SICODE_LLAVE_CONTACTO` debe venir de un gestor de secretos, no de un archivo en el mismo servidor que la base.
- Copias de respaldo de la base cifradas y sin la llave de contacto.
- Publicar un servicio cebolla (Tor) para quien necesite ocultar también que visitó el sitio.
- Revisar que ningún servicio de monitoreo o de errores capture el cuerpo de las peticiones.

## Cómo verificarlo

```bash
npm test                               # 47 pruebas, incluidas las de limpieza y de datos abiertos
curl -sI http://localhost:3000/denunciar | grep -i content-security
grep -rn "x-forwarded-for\|headers()" src/app/api/denuncias src/app/api/evidencias   # sin resultados
```
