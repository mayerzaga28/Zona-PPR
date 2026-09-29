# Cuentas personales y eliminator entre amigos

La nueva versión usa nombre de usuario y contraseña, sin recopilar correo electrónico. Supabase Auth mantiene las contraseñas y sesiones. El servidor asigna un identificador técnico en `accounts.zonappr.invalid`; no representa una dirección de correo real ni acredita titularidad de un email.

## Configuración

1. Conectar Supabase al proyecto Vercel `mayer11/zona-ppr`.
2. Ejecutar `community-schema.sql` y después `account-identity.sql` en SQL Editor.
3. En Supabase mantener Email habilitado, contraseña mínima 12, confirmación de correo habilitada y **Allow new users to sign up deshabilitado**. El servidor crea las identidades internas por Admin API, con límites persistentes. No se usa el alta pública por email ni SMTP.
4. Variables privadas del servidor: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Se admiten los equivalentes `NEXT_PUBLIC_…` de URL y anon key. Nunca publicar la clave de servicio.
5. Activar con `COMMUNITY_ENABLED=true` y desplegar. El navegador solo recibe URL y clave pública.
6. Probar registro, cierre y apertura de sesión, recuperación, dos participantes con picks independientes y prohibición de acceso a terceros.

## Recuperación

Al registrar una cuenta se genera un código aleatorio de 192 bits. Se muestra una vez y se puede descargar. Solo su hash SHA-256 se guarda en el esquema privado. Permite cambiar la contraseña y se sustituye por otro código al usarlo. No compartirlo. Sin contraseña ni código no hay recuperación automática. Los códigos no se guardan en el almacenamiento del navegador.

El servidor valida formato, tamaño de solicitudes, origen y límites por usuario/IP (guardados como hashes, no IP en claro). Las funciones de registro y recuperación son exclusivas de `service_role`. Los visitantes no pueden leer perfiles, hashes o límites directamente.

## Reglas

- Cuenta por persona; Supabase gestiona contraseñas y sesiones. El nombre de usuario se usa para entrar y el apodo para mostrarse a los amigos.
- Los grupos tienen hasta 50 miembros. Cada usuario puede crear hasta 20 y pertenecer hasta 30 grupos (incluidos los creados).
- La inscripción cierra al primer kickoff de la semana inicial. No hay reingresos ni reinicios para borrar derrotas.
- Se permite cambiar el equipo solo si ni el partido previamente elegido ni el nuevo han empezado. No se repite equipo en el mismo grupo.
- Derrota, empate o ausencia de pick al último kickoff semanal eliminan. Resultados pendientes no se convierten en derrotas.
- Cada usuario ve sus propios picks; los de los demás se revelan al kickoff elegido. Solo el creador ve el código de invitación.
- El servidor sincroniza los 272 partidos de ESPN. La base de datos valida el reloj y rechaza escrituras con calendario de más de seis minutos. El cliente no decide resultados ni quién es el propietario.
- Las elecciones de la antigua práctica local no se importan: podrían haberse hecho después de conocerse el resultado.
- El grupo y su historial se conservan entre dispositivos al iniciar sesión. El draft y la alineación anteriores continúan guardándose localmente.

## Desarrollo

`npm ci`; `npm run build:auth` genera el cliente oficial empaquetado. Node 22+.
`npm test` ejecuta las reglas reales SQL en Postgres/PGlite con usuarios sintéticos y verifica aislamiento, permisos, bloqueo, equipos repetidos, empate, sesiones y configuración incompleta. No equivale a una prueba de entrega de correo ni de despliegue.
Las tablas privadas no tienen políticas públicas de lectura/escritura. Las RPC de usuario verifican `auth.uid()` y el estado confirmado de la identidad interna. Solo `service_role` puede sincronizar el calendario.
No publicar `node_modules`, `.env*`, datos de test ni claves.
