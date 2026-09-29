# Zona PPR — vista previa, no publicada

Cambios sobre de7bfd0: sistema visual verde/blanco, navegación principal compacta, menú Más conserva juegos/archivo/ESPN/draft, filtros duplicados eliminados, control de animación eliminado (se respeta la preferencia del sistema), Eliminator contiene práctica y grupos; formulario email, acceso heredado por usuario conservado; se pueden pegar enlaces de invitación.

Validación: 20 pruebas de dominio/SQL existentes pasan. Sintaxis de módulos comprobada. Navegación y pick de práctica comprobados en navegador local. Vista móvil 390px revisada. El correo real y registro en producción NO están probados ni activados.

Antes de publicar, con aprobación:
- Configurar entrega de correo y habilitar el registro por email en Supabase, manteniendo confirmación de correo.
- Probar registro, confirmación y recuperación en un entorno separado; asegurar URLs de retorno correctas.
- Probar creación/unión/copia de invitación con cuentas de prueba aisladas.
- Conservar la ruta de acceso anterior: usuarios técnicos de la versión anterior no tienen email personal; no migrar identidades automáticamente.

No se modificó producción ni se envió este rediseño a GitHub.

## Segunda mejora — minijuegos y personalización

- Quiz: sesiones de cinco preguntas con estrellas actuales y leyendas, tres pistas más accesibles, aciertos/fallos inmediatos, racha, puntos (máximo 650) y récord. Visitantes guardan récord en este navegador; cuentas usan RPC privado y resultados idempotentes por partida. No es una clasificación verificada entre usuarios.
- Draft: un pick automático cada 1,4 segundos, pausa manual y automática al ocultar sección/pestaña, filtros/búsqueda persistentes durante los picks, indicador de turno, próximos picks, roster y tablero desplegable. Bots ponderan ADP y necesidades sin repetir jugadores.
- Noticias: hasta 20 favoritos por cuenta, búsqueda, agregar/quitar, prioridad por nombre completo en título/descripción y filtro de coincidencias. Indica cuando la fuente no contiene menciones recientes.
- Color selectivo: verde (selección/acierto), azul (puntos/proyecciones), dorado (racha/favorito), violeta (récord). Respeta movimiento reducido del sistema.

### Verificación

26 pruebas automáticas aprobadas, incluidas privacidad SQL entre usuarios, idempotencia de resultados, puntuación, targets únicos, reloj cancelable del draft, composición de rosters y coincidencias de nombres.
Navegador local: partida completa 4/5 y 470 puntos guardados; récord recuperado tras recargar; favoritos añadidos y eliminados; noticia de Bo Nix priorizada y filtrada; draft paso a paso, turno propio, selección, filtros, roster y recuperación; viewport 390px sin desbordamiento horizontal.

### Publicación pendiente de aprobación

Aplicar personal-schema.sql después de community-schema.sql en el entorno aprobado. No se aplicó a producción. El servidor de demostración .local/preview.mjs utiliza una base de datos en memoria y usuarios ficticios; se excluye del repositorio. En producción aún falta completar la activación y verificación del email señaladas en la primera revisión.

## Publicación autorizada

Usuario autorizó publicar la versión revisada. Se aplicó personal-schema.sql al proyecto existente y se verificó que los tres RPC rechazan acceso anónimo. Se mantiene el acceso de usuario/contraseña existente. El formulario email solo se habilita con EMAIL_AUTH_ENABLED=true después de configurar y validar el correo. Los usuarios de prueba locales no se publican. Las páginas de equipos/matchups y el Draft Board ampliado solicitados después siguen pendientes.
