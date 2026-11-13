# Declaración de uso de inteligencia artificial

Las bases del Datatón Anticorrupción 2026 piden declarar el uso de herramientas de inteligencia artificial, su finalidad y su alcance.

## En el desarrollo

Se usó **Claude (Anthropic), a través de Claude Code**, como asistente de programación.

- **Finalidad:** revisar la documentación pública del reto y de la PDN, escribir y probar el código, redactar la documentación.
- **Alcance:** el asistente escribió la mayor parte del código y de los documentos de este repositorio bajo la dirección del autor, que definió el enfoque, tomó las decisiones de diseño y es responsable del resultado. El método de corroboración adapta un trabajo previo del autor sobre contrataciones públicas.
- **Verificación:** el comportamiento se comprueba con pruebas automáticas (`npm test`) y con ejecuciones contra las fuentes reales de la PDN, no con la palabra del asistente.

## En el funcionamiento del sistema

**SICODE no usa inteligencia artificial generativa ni modelos de lenguaje para operar.**

- La extracción de entidades, el aviso de riesgo del relato, la clasificación orientativa y el semáforo son reglas explícitas, legibles en el código y reproducibles.
- El texto de una denuncia no se envía a ningún servicio externo, ni de IA ni de otro tipo.

Es una decisión de diseño ligada a la confidencialidad: mandar un relato a un modelo alojado por un tercero sería una fuga, y una prioridad asignada por un modelo opaco no se podría explicar a la persona afectada.

## Datos

- No se usaron datos personales sensibles, reservados ni confidenciales.
- Las pruebas y la demostración usan personas, empresas y entes ficticios.
- Los datos reales provienen de las descargas y API públicas de la Plataforma Digital Nacional y del catálogo geoestadístico del INEGI.
