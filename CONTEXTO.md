# Contexto para continuar Angry Fruits

Revisión del código: 2 de noviembre de 2026.

## Objetivo y forma de trabajar

Juego infantil web: **Super Frutas al Rescate**, by Codo77. Frutas lanzadas con catapulta contra construcciones y verduras. Seguir `AGENTS.md`: controles sencillos, aspecto cuidado, animaciones y explicaciones breves en español. Probar local antes de publicar. No publicar sin una solicitud para hacerlo.

## Arquitectura

- `index.html`: portada y mapa de siete mundos.
- `src/home.js`: lee el nivel máximo y marca mundos desbloqueados; el mapa es informativo.
- `game.html`: interfaz, canvas, selector de frutas y diálogo final.
- `src/game.js`: toda la lógica (2461 líneas): física, estado, niveles, poderes, dibujo, audio y guardado.
- `styles.css`: presentación, escenarios, animaciones y adaptación a pantallas pequeñas.
- JavaScript nativo, sin compilación ni dependencias npm. Matter.js 0.20.0 se carga desde CDN; tipografía Baloo 2 desde Google Fonts. La física necesita acceso al CDN.
- Dibujo con canvas y emojis; decorados y clima también usan capas CSS. Sonidos sintetizados con Web Audio.

## Mecánicas actuales

- Arrastrar una fruta hacia atrás y soltar para lanzar. Sus poderes se activan automáticamente; tocar el escenario durante el vuelo activa el bumerán disponible.
- Se empieza con seis vidas. «Reiniciar» gasta una vida y repone las frutas, conservando el estado de las construcciones. Sin frutas se solicita reiniciar. No equivale a comenzar una partida nueva.
- Banana: tres lanzamientos por tanda; otras frutas: uno. La siguiente fruta llega tras 3,2 segundos.
- Eliminar todas las verduras avanza de nivel. Completarlo con un solo tiro da un bonus.
- Construcciones generadas por nivel, materiales distintos, cofres y enemigos con escudo, fantasma, curación o salto ninja. Hay código para acero y TNT; comprobar su aparición efectiva antes de diseñar alrededor de ellos.
- Jefe cada cinco niveles: Tomate Titán, Rey Brócoli y Reina Berenjena en ciclo.
- Mundos: Bosque (1–5), Montañas (6–10), Desierto (11–15), Fortaleza (16–20), Glaciar (21–25), Volcán (26–30), Espacio (31 en adelante). No hay final de campaña definido.
- Clima en ciclo de seis tipos, con efectos sobre la física. Portales desde nivel 6 en múltiplos de 3; cañones en ciertos niveles desde el 5; llaves desde el 8 en múltiplos de 4; cactus en desierto, bolas de nieve en glaciar y meteoros en espacio.
- «Repetir tiro» dibuja una trayectoria guardada; no vuelve a simular el lanzamiento.

## Frutas y desbloqueos

| Fruta | Desbloqueo | Poder principal |
| --- | --- | --- |
| Banana | Inicial | Bumerán |
| Mandarina | Inicial | Gajos |
| Manzana | Nivel 4 | Semillas |
| Pera | Nivel 7 | Rescate anticaída desde nivel 10 |
| Sandía | 5000 puntos | Peso e impulso |
| Uvas | 10000 puntos | Bombas pequeñas |
| Dragón | 15000 puntos | Combina varios poderes |
| Melón | Primera llave | Fuego |
| Fresa | Tercera llave | Se infla |
| Naranja de Zumo | Segunda llave | Explosión de zumo |

## Guardado real

`localStorage` guarda `super-frutas-player-profile-v1` (frutas y número de llaves), la clave heredada `super-frutas-unlocked-fruits` y `super-frutas-highest-level` para el mapa. **No guarda puntos, vidas ni una partida reanudable**. Al entrar se comienza en nivel 1 con cero puntos, conservando desbloqueos. El README afirma que se conservan los puntos; hay que corregirlo o implementar esa función.

## Hallazgos para la próxima sesión

Detectados mediante lectura, pendientes de reproducir en navegador:

1. El evento `resize` ejecuta `startGame({ preserveScore: true })`, que pone el nivel en 1. Cambiar tamaño u orientación puede perder el avance de la partida.
2. `makeCastle()` genera el castillo antes de asignar `levelKey`; la creación de enemigos enjaulados consulta esa llave antes de que esté preparada.
3. `clearLevelBodies()` no incluye la etiqueta `chest`; un cofre sin abrir puede permanecer al cambiar de nivel.
4. El mapa no permite escoger ni reanudar mundos.
5. `bestTrajectory` y el estado del botón de repetición no se restablecen explícitamente al iniciar otro escenario; revisar el comportamiento esperado.
6. README incompleto (sección de controles vacía) y sin pruebas automatizadas configuradas.

Orden sugerido: reproducir y arreglar pérdida de nivel al redimensionar; revisar transición de niveles y cofres/llaves; decidir si se quiere reanudar partida o elegir mundos; después añadir contenido.

## Validación y publicación

- `node --check src/game.js` y `node --check src/home.js`: correctos en esta revisión. No se ha probado una partida en navegador ni validado visualmente.
- Local: `npm run dev` o `python3 -m http.server 5173`; abrir `http://localhost:5173`.
- `publicar.sh "Descripción"` exige rama `main`, añade **todos** los cambios, crea un commit `Publicar:` y hace push.
- `.github/workflows/publicar.yml` despliega GitHub Pages con commits `Publicar:` o ejecución manual. Copia HTML, CSS y `src/`.
- URL documentada: https://joaquinborthirycane.github.io/angry-fruits/ (no se verificó el despliegue remoto).
- Al empezar la revisión, el único archivo sin seguimiento era `AGENTS.md`; no había modificaciones de código.

Esta revisión solo añade este documento; no cambia el juego ni publica nada.

## Frutas añadidas el 3 de noviembre de 2026

- Limón Ácido: cuarta llave; seis proyectiles verdes, dañan madera y verduras y disuelven cristal, hielo y acero.
- Coco Explosivo: quinta llave; explosión al chocar o después de 1,5 segundos. Radio 260 (antes de escala) y potencia 1,9 veces la explosión de naranja.
- Ambas frutas aparecen en portada y selector. Pruebas con simulaciones de temporizadores correctas; pendiente probar una partida en navegador.

## Últimas frutas y mecánicas (3 de noviembre)

- Arándanos Mini (llave 6): 24 proyectiles diminutos; Piña Lanzahojas (llave 7): ocho hojas giratorias.
- Cerezas Gemelas (llave 8): dos frutas con cuerda física; la cuerda levanta y daña verduras que toca.
- Kiwi Tornado (llave 9): remolino durante 1,9 segundos que activa y levanta estructuras cercanas.
- Mango Pegajoso (llave 10): une hasta tres verduras a bloques próximos con restricciones físicas.
- Melocotón Saltarín (llave 11): hasta cuatro rebotes con crecimiento del 18 % por rebote e impulso hacia arriba.
- Se limpian las uniones al cambiar de nivel, reponer frutas o recrear el motor. Pruebas aisladas de activación, uniones, crecimiento y orden de las 18 frutas correctas; falta probar jugabilidad en navegador.
- La planta resta hasta 200 puntos por fruta comida, sin valores negativos.
- Campaña actual: 14 mundos. Caramelo 41–45, Arcoíris 46–50, Selva 51–55, Musical 56–60, Cristal 61–65, Verdura Time solo nivel 66 con victoria final.

## Dificultad añadida

Selector Aventura/Desafío en portada, conserva preferencia en `super-frutas-mode` y transmite `?modo=` al juego. Aventura: seis vidas, cascos desde nivel 3 y una plataforma móvil desde nivel 4. Desafío: cuatro vidas, salud enemiga ×1,2, más cascos desde nivel 2 y plataformas desde nivel 3 (dos desde nivel 10), movimiento más rápido. Cascos absorben un golpe sin daño. Jefes alternan burbuja protectora y oportunidad de ataque: 1,5 s protegidos de cada 5,2 s en Aventura; 2,2 s de cada 4 s en Desafío. Sin retos opcionales ni nuevas ráfagas de viento. Se mantiene el clima previo. Pruebas aisladas de casco, fases del jefe y movimiento de plataforma correctas; pendiente prueba visual y de jugabilidad. Limpieza de niveles ahora incluye plataformas y cofres.

## Trucos del jardín

- Mosca ladrona en niveles con llave: se acerca tras lanzar, la transporta dentro del escenario y suelta la llave al recibir un frutazo cercano (también semillas/fuego). No elimina llaves permanentemente.
- Dos setas brotan únicamente con lluvia o tormenta; crecen durante 1,2 s y luego impulsan las frutas hacia arriba al chocar.
- Cada banana deja una cáscara 650 ms después del lanzamiento, hasta tres simultáneas. Una verdura cercana resbala, consume la cáscara y recupera fricción tras 2,4 s.
- Gusano desde nivel 3: después de activar el derrumbe come soportes verticales de madera, máximo tres por nivel, con bocados cada 1,1 s.
- Todos se dibujan en canvas y se recrean por nivel. Se prepara la llave antes de construir enemigos para que las jaulas correspondan al nivel actual.
- Pruebas aisladas de lluvia, crecimiento, robo/recuperación, resbalón y gusano correctas; pendiente partida real en navegador.

## Portada renovada

`index.html` usa `home.css` para un diseño claro verde/crema/coral con escena de catapulta en CSS, frutas animadas, colección de 18 frutas y mapa. Selector Normal/Desafío trasladado debajo de la colección; acceso desde navegación y enlace bajo Jugar. Ambos enlaces para jugar se sincronizan con el modo, conservando el identificador interno `aventura` para Normal. Publicación incluye `home.css` en script y workflow. Revisado visualmente en Chrome de escritorio y a 390 × 844; cambio de modo verificado en ambos enlaces y selección restaurada a Normal tras la prueba.
