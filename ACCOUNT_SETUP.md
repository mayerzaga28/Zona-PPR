# Activar cuentas y eliminator entre amigos

Estado al 28 de septiembre de 2026: código preparado y probado localmente; proyecto Supabase `zona-ppr-cuentas` creado y conectado a Vercel; esquema SQL aplicado con éxito; URL de retorno configurada. Pendientes: publicación del código (la carga de GitHub se detuvo), remitente SMTP y pruebas de autenticación real. No habilitar `COMMUNITY_ENABLED` hasta completar los pasos y verificar registro/confirmación/recuperación con correos reales.

1. Crear un proyecto Supabase gratuito desde Storage de `mayer11/zona-ppr` en Vercel. La aceptación del Marketplace requiere confirmación del propietario.
2. Conectar solo este proyecto a la base de datos. Mantener las credenciales de servicio únicamente en variables del servidor (nunca en `public/`, GitHub ni mensajes).
3. Ejecutar `community-schema.sql` en el SQL Editor de ese proyecto. Crea tablas en un esquema privado con RLS y funciones con permisos explícitos.
4. Configurar Auth: Site URL `https://zona-ppr.vercel.app`; permitir el retorno exacto `https://zona-ppr.vercel.app/?cuenta=1`; mantener confirmación de correo activada y contraseña mínima de 12 caracteres. La app usa el cliente oficial de Supabase con PKCE.
5. Configurar un remitente SMTP verificado antes de admitir amigos. El servicio SMTP predeterminado de Supabase solo permite destinatarios autorizados del proyecto; no es suficiente para registro público. No desactivar la confirmación para sortear esta restricción. Alternativa futura: un proveedor social correctamente configurado.
6. Variables de Vercel: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (o sus equivalentes `NEXT_PUBLIC_…`), `SUPABASE_SERVICE_ROLE_KEY`, y finalmente `COMMUNITY_ENABLED=true`. La clave pública se sirve desde `/api/community?action=config`; la de servicio nunca se envía al navegador. Si la integración usa nombres diferentes, añadir estos alias de servidor en Vercel.
7. Desplegar. Verificar con dos cuentas del propietario/testers autorizados: confirmación, login, recuperación, apodos diferentes, crear grupo, invitar, guardar pick, cerrar sesión, volver desde otro navegador, pick ajeno oculto antes del partido. Probar también con un tercer usuario que no sea miembro.

## Reglas

- Cuenta por persona; Supabase gestiona contraseñas y sesiones. Los correos solo se usan para autenticación, no se muestran a los amigos.
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
Las tablas privadas no tienen políticas públicas de lectura/escritura. Las RPC de usuario verifican `auth.uid()` y correo confirmado. Solo `service_role` puede sincronizar el calendario.
No publicar `node_modules`, `.env*`, datos de test ni claves.
