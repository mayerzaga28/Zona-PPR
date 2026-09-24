# Zona PPR · NFL 2026 — versión 2

Página para Safari y otros navegadores modernos. Catálogo de jugadores, puntos conseguidos y proyectados por semana, mejores por posición, noticias, comparación uno contra uno y simulador de nueve titulares: QB, RB, RB, WR, WR, TE, FLEX, K y D/ST.

## Publicar con GitHub y Vercel

**Sube el contenido descomprimido. No subas únicamente el ZIP ni cambies los nombres de los archivos.**

1. Descomprime `Zona_PPR_v2_GitHub_Vercel.zip`.
2. Abre https://github.com/mayerzaga28/Zona-PPR y selecciona **Add file → Upload files**.
3. Arrastra todas las carpetas y archivos de dentro del paquete. Deben verse `api`, `lib`, `public`, `package.json` y `vercel.json` en la raíz del repositorio. No debe quedar todo dentro de otra carpeta.
4. Pulsa **Commit changes**. Puedes conservar el antiguo `index.html ppr`, pero no se usa: ahora la página está en `public/index.html`.
5. En el proyecto de Vercel vinculado al repositorio, usa:
   - Framework Preset: **Other**.
   - Root Directory: raíz del repositorio (vacía o `./`), **no** `public`.
   - Output Directory: **public** (incluido en `vercel.json`).
   - Build Command: vacío (incluido en `vercel.json`).
6. Espera el despliegue automático o pulsa **Redeploy** después de guardar los ajustes.
7. Abre el enlace de ese despliegue en Safari. Prueba Jugadores, Mi equipo, Uno contra uno y Noticias.

El nombre debe ser exactamente `public/index.html`, no `index.html ppr`, `index.html.txt` ni `Index.html`.

## Actualización automática

No necesitas modificar GitHub para actualizar estadísticas. Las funciones de `/api` consultan las fuentes desde Vercel. El navegador consulta al abrir, al volver a la pestaña y cada cinco minutos mientras está visible. Noticias: treinta minutos. Safari cerrado no ejecuta las consultas; al volver se actualiza. Se muestra la fecha de cada fuente y si usa datos anteriores.

El catálogo se conserva hasta 24 horas, las proyecciones y calendario hasta cinco minutos y los resultados anteriores hasta una hora. Los fallos de las fuentes se muestran. Se incluye una copia de semana 3 del 22 de septiembre de 2026 como respaldo inicial, identificada por fecha, no como datos en vivo.

GitHub Pages por sí solo no ejecuta las funciones `/api`: conecta este repositorio a Vercel. Abrir `index.html` por doble clic tampoco ejecuta el servidor.

## Predicciones y reglas

La comparación usa la proyección de estadísticas de la fuente para la semana y convierte los valores a las reglas que aparecen en la página. Incluye rival, sede, lesión actual, volumen previsto, forma reciente (hasta tres partidos finalizados previos) y puntos concedidos por el rival a la posición en partidos anteriores. Presenta una ventaja estimada o un empate técnico; no garantiza ganadores ni afirma incorporar todas las variables.

No añade un ajuste de rival arbitrario que podría contar dos veces un factor ya recogido por el proveedor. No incorpora clima ni cuotas si no están disponibles. Las reglas de kicker y defensiva son las documentadas en la página; pueden diferir de tu liga. Las estadísticas pueden retrasarse o corregirse.

Solo se comparan dos jugadores distintos de la misma posición. No se recomienda un ganador para un partido iniciado, una baja confirmada de la semana actual o cuando falte proyección. Las lesiones cuestionables muestran una advertencia.

El simulador evita duplicados. Los descansos y bajas confirmadas de la semana actual suman cero; las proyecciones ausentes se señalan como desconocidas y el total es parcial. La selección se guarda localmente, sin sincronización entre dispositivos.

## Desarrollo y pruebas

Node.js 22 o superior. No hay dependencias de terceros que instalar.

- `npm run dev`: http://localhost:5174
- `npm test`: pruebas de PPR, K, D/ST, posiciones, duplicados y reglas de comparación.

Estructura:

- `public/`: HTML, estilos, JavaScript y respaldo de datos.
- `api/`: funciones de Vercel para datos y noticias.
- `lib/`: fuentes, puntuación y calendario.
- `tests/`: pruebas de puntuación y elegibilidad.

Fuentes: https://docs.sleeper.com/ y https://www.espn.com/nfl/ . Las rutas de estadísticas y proyecciones usadas por Sleeper pueden cambiar y no tienen un SLA garantizado. Configuración: https://vercel.com/docs/functions/runtimes/node-js .

No se incluyen secretos ni se requieren claves de API. Este paquete no cambia por sí mismo el repositorio ni la publicación existente.

## Juegos y archivo histórico (septiembre 2026)

- Adivina al jugador: 3 pistas de universidad/draft, 4 respuestas únicas; jugadores actuales y retirados, con filtros de época. Sustituye al duelo a ciegas. No se presenta como un censo completo de la NFL.
- Draft PPR: 4–16 equipos, pick configurable, 9/12/15/18 rondas y orden serpiente. Bots basados en ADP de temporada y necesidades; avance y plantilla se guardan localmente. `/api/draft` consulta Sleeper con una hora de caché. Una simulación en curso conserva su conjunto inicial para no cambiar selecciones.
- Archivo: 24,901 fichas de nflverse y leyendas del Hall of Fame. `archive.json` y `seasons.json` se cargan solo al necesitarlos. Estadísticas de temporada regular 1999–2025, con PPR de la fuente; sin playoffs. Las temporadas anteriores a 1999 no están disponibles. Ejecutar `python3 build-history.py` para regenerar los archivos públicos (requiere red; usa caché temporal). Los datos históricos son una copia fechada, no una sincronización continua.
- Eliminator: partida de práctica individual desde la semana actual, sin repetir equipo, empate o derrota eliminan. Una selección queda bloqueada al inicio de su partido. No elegir antes del último inicio de la semana elimina. Usa los 272 partidos y resultados de ESPN servidos por `/api/nfl`. Guardado en navegador y reloj local; no es una competición con validación de servidor ni se sincroniza entre dispositivos.
- `npm test` incluye orden serpiente, duplicados, selección de bots, restricciones de eliminator y preguntas históricas.
