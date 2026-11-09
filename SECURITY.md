# Seguridad de Super Frutas al Rescate

Revisión iniciada el 6 de noviembre de 2026.

## Alcance y resultado

Revisión del código de la aplicación estática, dependencias cargadas por el navegador, publicación y consultas de configuración de GitHub en modo lectura. No es una auditoría del ordenador, de contraseñas ni de todos los dispositivos de la cuenta. No garantiza la ausencia de vulnerabilidades.

No hay servidor de aplicación, cuentas de jugadores, formularios de contraseña ni pagos en este proyecto. El progreso en localStorage se puede modificar desde el propio navegador: no debe tratarse como información fiable para premios o compras. No se encontró una entrada externa que terminase ejecutándose como HTML o JavaScript; se sustituyó también el innerHTML del selector por nodos y textContent.

## Refuerzos realizados

- Matter.js 0.20.0 se sirve desde vendor/matter-js. Se verificó el SHA-512 del paquete frente a la integridad publicada por npm; provenance.json registra el origen y SHA-256 de los archivos conservados. El navegador verifica además el archivo con SRI SHA-384. Esto protege frente a cambios del archivo, no certifica que la librería no tenga fallos.
- La CSP limita JavaScript al propio sitio y elimina unsafe-inline. Bloquea conexiones iniciadas por la página, formularios, marcos, workers y objetos. Las fuentes de Google siguen siendo externas y están permitidas expresamente; no se envía progreso del jugador a un servidor del juego.
- El script de publicación añade rutas explícitas, rechaza archivos preparados fuera de su lista y ejecuta scripts/check_security.py antes de subir. La comprobación busca varios formatos comunes de secretos; no es un detector completo.
- GitHub Pages recibe una lista explícita de archivos, no todo el repositorio ni todo src. No se copian documentación, herramientas, .git ni archivos locales privados al sitio desplegado.
- Las cuatro acciones directas del workflow están fijadas a commits obtenidos de los repositorios oficiales. Checkout no conserva credenciales. Los permisos de despliegue se limitan al job que los necesita. Dependabot propone actualizaciones semanales de las acciones.
- npm run dev y npm start enlazan el servidor solo a 127.0.0.1, en lugar de exponerlo a toda la red. Es un servidor de desarrollo: no usarlo como alojamiento público.

## Configuración remota observada

- Repositorio público: el código y los archivos versionados son visibles para cualquiera.
- HTTPS de GitHub Pages: activado.
- Búsqueda de secretos y protección al subir secretos: activadas.
- Rama main protegida: no. No se cambiaron reglas de la cuenta ni de la rama.
- El dato de verificación en dos pasos no estaba disponible en la respuesta consultada; no se puede afirmar si está activada.

## Límites y siguientes medidas

Usar una passkey o verificación en dos pasos en GitHub y revisar sus sesiones y accesos. Considerar reglas de protección de main que encajen con la publicación desde el CLI. No compartir tokens ni añadir contraseñas a los archivos del juego. Los patrones de .gitignore solo ayudan con archivos no versionados y no borran secretos de un historial anterior.

GitHub Pages no permite configurar libremente todos los encabezados HTTP de respuesta de este proyecto. frame-ancestors y X-Frame-Options no se pueden suplir con una etiqueta meta: si se requiere protección de incrustación por encabezado, hará falta un alojamiento que permita establecerlo. No se añadieron etiquetas que aparenten una protección que el navegador ignora.

## Comprobaciones reproducibles

    python3 scripts/check_security.py
    python3 scripts/check_security.py --staged
    node --check src/game.js
    node --check src/home.js
    node --check src/fruit-powers.js
    sh -n publicar.sh

Los refuerzos permanecen locales hasta publicar una nueva versión.

Referencias: [seguridad de GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use), [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP), [limitación de frame-ancestors en meta](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).
