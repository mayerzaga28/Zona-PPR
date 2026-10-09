# Zona PPR Club — revisión de desarrollo

No desplegado. La versión pública sigue intacta.

## Experiencia

Inicio personal, Mis ligas, Eliminator, Partidos y Jugadores. Menú secundario para noticias, comparación y prácticas. Se retiraron trivia y archivo histórico de la navegación (se conserva código/datos, y el historial sigue en perfiles). Se conserva la importación ESPN, claramente separada del fantasy nativo.

Diseño neutro con acentos azules, identidad propia, estados y marcadores legibles, escritorio y móvil. Se conservaron favoritos por cuenta; ahora también se pueden cambiar en los perfiles de jugadores.

## Fantasy nativo implementado

- Ligas privadas de 4/6/8/10/12 cuentas, invitación mediante enlace y nombre de equipo.
- Draft snake compartido de 15 rondas, tablero completo, reloj de 90 segundos, selección exclusiva y autopick de necesidades/ADP al vencer el turno.
- Nueve titulares y seis suplentes. Edición por semana y bloqueo de cada jugador según su kickoff en el servidor.
- Agentes libres, waivers de prioridad móvil al cambiar de semana con resultados completos y propuestas de intercambio uno por uno.
- Calendario round robin, resultados derivados de titulares guardados y datos PPR, clasificación regular hasta semana 14, cuatro semifinalistas en 15 y final en 16.
- Chat privado y movimientos por liga. El servidor comprueba identidad y membresía; no recibe puntos ni propietarios del navegador.
- Controles de cantidad de ligas, propuestas y solicitudes; límite de frecuencia de chat.

## Límites explícitos

- Es una primera versión con reglas fijas, no paridad con Sleeper. No incluye FAAB, veto de trades, cambios administrativos de puntos, dynasty, keeper, notificaciones push, reacciones, adjuntos o moderación avanzada.
- Hay que guardar la alineación cada semana. No hay copia automática.
- Actualización por consultas (5 s draft, 20 s liga); no WebSockets ni tareas de fondo. Turnos y waivers pendientes se resuelven cuando alguien consulta la liga. No prometer ejecución con todos desconectados.
- Datos NFL externos de las fuentes existentes. Partidos muestra horarios y finales, no un marcador parcial inventado. No hay jugada a jugada, video o cuotas.
- La disponibilidad del catálogo ADP limita el universo del draft; no se incorporan jugadores sin ranking confirmado.
- Puntuaciones incompletas no cierran una semana. Las correcciones de datos pueden modificar clasificaciones; faltan cierres oficiales y auditoría de correcciones para una competición comercial.
- Calendario y modelo actuales corresponden exclusivamente a 2026. Una versión comercial debe separar temporadas y partidos por ID estable.
- Acceso por email depende de la configuración pendiente. Se conserva el acceso actual de producción.

## Activación pendiente (no ejecutada)

1. Revisar el diseño y aprobar publicación.
2. Aplicar `fantasy-schema.sql` después de los esquemas existentes en Supabase.
3. Activar `FANTASY_ENABLED=true` en el entorno elegido y comprobar con cuentas reales autorizadas en staging.
4. Publicar solo tras verificar el flujo de dos usuarios separados y cargas concurrentes.

La API no está habilitada por defecto. Sin configuración devuelve un mensaje explícito; no finge crear ligas.

## Infraestructura y uso comercial

Reutiliza Supabase Auth/Postgres y Vercel. Este cambio no contrata servicios ni añade suscripciones. El tráfico de consultas, almacenamiento y chat puede incrementar costos. Antes de ofrecer seguimiento en vivo o vender el producto, confirmar términos y derechos comerciales de las fuentes deportivas, imágenes y marcas; evaluar un feed licenciado con SLA, trabajos programados, monitorización y backups.

## Prueba local

`.local/preview.mjs` es una fixture excluida de Git. Usa PostgreSQL en memoria con cuentas y liga explícitamente de prueba; se reinicia al apagar el proceso. Prueba la misma lógica SQL del motor. No es una base de datos de usuarios reales ni se despliega.

Pruebas automatizadas: membresía privada, invitaciones, capacidad, privilegios, turnos manuales/automáticos, exclusividad de jugadores, bloqueo de lineup, aceptación de trades por destinatario, rollback de adquisición duplicada, chat, waivers, datos vencidos, round robin y playoffs.

## Revisión visual final

Inicio con navegación lateral en computadora y barra inferior en móvil, paleta carbón y lima, acceso directo a ligas, búsqueda de jugadores y perfiles existentes. Comprobada la apertura de perfiles desde búsqueda y un ancho móvil de 390 px sin desbordamiento horizontal de la página. Se distinguen partidos de local, visitante y sede neutral. Foco de teclado visible y animaciones respetuosas de la preferencia de movimiento reducido. Esta versión continúa únicamente en desarrollo.

## Jugadores sin equipo NFL

Catálogo ampliado con jugadores marcados activos por Sleeper y participación en 2025 o 2026. Se excluyen estados explícitos de retiro, pero la fuente puede retrasarse: esta selección es una lista para seguimiento, no una certificación de disponibilidad o futura contratación. Filtro dedicado, perfiles y favoritos; draft incluye únicamente los que tienen ADP válido. Sin equipo no equivale a libre en una liga fantasy. Proyección, rival y descanso quedan sin asignar; se preservan resultados históricos. Catálogo refrescado cada 24 horas, jornada cada cinco minutos. No se añadió un servicio de pago.

## Borrar ligas y salir de Eliminator

Solo el creador puede borrar una liga: se marca como eliminada, se oculta para todos y se bloquean invitaciones y acciones. Los datos no se purgan físicamente. Salir de Eliminator conserva historial, revoca acceso y picks e impide reingreso; el creador transfiere automáticamente la administración al participante activo más antiguo. Sin participantes activos, se cierra el ingreso. Requiere aplicar las versiones actualizadas de community-schema.sql y fantasy-schema.sql antes de publicar. Pruebas de permisos y persistencia en competition-exit.test.js.

## Arena: dirección visual para móvil

Tema azul noche, violeta Fantasy, coral Eliminator y cian en puntuaciones. Accesos rápidos, selector manual de tres jugadores destacados con datos existentes, formularios de creación y unión desplegables, navegación inferior con safe areas y perfil como panel inferior en móvil. Verificado a 390 px sin desbordamiento, cambio de destacado y apertura de formulario. Es una aplicación web: no se generó un proyecto iOS ni se envió a App Store. La distribución iOS, sesiones reales, privacidad y pruebas en dispositivos físicos siguen siendo trabajo independiente.

## Centro de partidos en vivo

/api/live consulta scoreboard y summary de ESPN con caché de 20 segundos y validación de identificadores. Interfaz actualiza cada 30 segundos solo visible, conserva la última respuesta con aviso ante fallos, incluye reloj reportado, cuarto, marcador, posesión si disponible, últimas cinco jugadas de la serie actual, anotaciones y estadísticas. No transmisión de video ni actualización de los puntos fantasy de ligas con esta fuente. Las descripciones conservan idioma original. ESPN no ofrece SLA contractual para este endpoint público; revisar licencia comercial antes de vender o distribuir en App Store. No se contrató servicio adicional.

Actualización de Partidos: calendario validado de 272 encuentros de temporada regular 2026, incluidas fechas de enero 2027; consulta calendario cada 5 minutos con overlay de jornada actual cada 20 segundos de caché. Cliente consulta cada 30 segundos mientras visible, conserva copia local de calendario y avisa errores. Barra de 18 semanas, agrupación por fecha CDMX, detalle con hasta 80 jugadas de series previas y actual, anotaciones y estadísticas en pestañas. No se crean partidos ni marcadores artificiales.

### Mi jornada (desarrollo)
- Inicio consulta las ligas de la cuenta y permite elegir una: enfrentamiento semanal con puntos conseguidos y proyecciones separados. Los datos ausentes se muestran como pendientes y los totales incompletos se etiquetan como parciales.
- Pendiente contextual: invitar al grupo, entrar al draft, completar posiciones o revisar titulares en descanso. Acceso directo a la liga y actualización manual.
- Favoritos en el radar enlazan al partido de su equipo y semana, con normalización de abreviaturas entre fuentes.
- Sin servicios adicionales ni migraciones. Depende del backend fantasy y la fuente NFL existentes; no agrega un proveedor de puntuaciones fantasy en vivo. Verificado en la cuenta local de prueba, móvil 390 px y pruebas de lógica.

### Mock Draft recuperado y mejorado
Disponible en Explorar → Mock Draft. Inspirado en el flujo documentado de Sleeper, con implementación propia: serpiente PPR, 4–16 equipos, elección de puesto, 9/12/15/18 rondas, reloj de 30/60/90 s, cola FIFO para autopick, tablero completo al frente, consulta de perfiles, pausa y deshacer. CPU con ADP y necesidades posicionales, pausa de 2.6 s entre selecciones. Guarda una práctica en este navegador y la restaura pausada. El reloj personal se detiene al ocultar la página o abrir un perfil.
No usa el motor privado de Sleeper. No incluye salas mock multijugador, invitaciones, historial de múltiples drafts ni sincronización de la práctica entre dispositivos. Sin servicios nuevos ni publicación.

### Formación del mock draft
El roster ahora muestra QB, RB1/2, WR1/2, TE, FLEX, K y D/ST, seguido de cinco espacios de banca. Las prácticas nuevas tienen 14 rondas. Las existentes de hasta 14 rondas de picks realizados se adaptan conservando sus elecciones. Asignación por orden de selección: primero puestos dedicados, después FLEX y banca. Cada candidato indica su destino; tocar una vacante filtra disponibles. Se bloquean picks manuales y automáticos que excedan cinco reservas. No modifica alineaciones de ligas reales. Pruebas de asignación, FLEX, unicidad, 14 puestos y vista móvil sin desbordamiento completadas.

### Revisión de legibilidad y textos
Corregidos contrastes heredados: selector de semana oscuro sobre oscuro y buscador claro sobre blanco; unificados controles, estados, etiquetas de ranking y textos de tabla del mock draft. Textos secundarios ampliados; formación móvil en una columna para nombres legibles. Redacción: lista de jugadores, posición de draft, puntos pendientes frente a parciales/finales, proyecciones de temporada, comportamiento real de pausa y guardado, singular/plural en catálogo y ligas. Verificado visualmente buscador en escritorio y formación móvil a 390 px sin desbordamiento horizontal del documento. No se han auditado todas las combinaciones de estados ni validado independientemente estadísticas deportivas.
Continuación de revisión: perfil Josh Allen, entrada de ligas y Eliminator revisados en navegador. Eliminada promesa «Un solo ganador»; aclarados revelado de selecciones, bloqueo al inicio de partido, derrota/empate y omisión semanal. El encabezado de cuenta ya no pide entrar cuando existe sesión. Cambios de presentación, sin modificar reglas ni datos deportivos.

### Plantillas en Partidos
Pestaña Plantillas por partido con selector de ambos equipos, fotos, número, posición, unidades ofensiva/defensiva/especiales/reserva/práctica; búsqueda y filtros de bajas, duda y sin confirmación. ESPN team roster real con caché 60 s y consulta desde vista visible cada 30 s. Errores por equipo independientes. Reporte de lesión más reciente prevalece; Active no equivale a jugar. Datos actuales, no históricos ni lista oficial de convocados por evento. No se promete participación confirmada. Se verificaron TB/DAL, filtro de bajas, ancho móvil390 y seis pruebas de normalización/live. No añade servicio de pago. Backend local5182 reiniciado; producción intacta.
