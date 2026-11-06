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

## Ampliación de mundos antes del final

Campaña actual: 17 mundos. Después de Cuevas de Cristal (61–65): Jardín de Hongos (66–70, lluvia fija y tres setas), Pantano Pegajoso (71–75, resistencia horizontal para frutas cerca del suelo y charco con burbujas), Fábrica de Zumos (76–80, portales, cañón y dos plataformas móviles en ambos modos). Verdura Time se mueve al nivel 81 y sigue teniendo un solo nivel y victoria final. El mapa y el contador de portada están actualizados. Pruebas de límites, climas y fin de campaña correctas; falta jugar esos niveles en navegador.

## 6 de noviembre de 2026: fondo y dragón

La portada tiene fondo verde oscuro y títulos/textos claros, conservando tarjetas claras. Dragón comparte también cerezas con cuerda (sin desaparecer), tornado, ocho hojas, 24 mini arándanos (sin dividir el cuerpo original), seis gotas de ácido, pegamento en impacto, hasta cuatro crecimientos al rebotar y fuerza de explosión del coco. Conserva sus poderes anteriores, añade cáscara de banana y golpe de sandía. La explosión de coco y zumo se combina en una sola explosión fuerte para evitar duplicados. Su ficha de portada describe todos los poderes. Prueba aislada de todos los proyectiles, efectos y supervivencia del dragón correcta; portada revisada en Chrome local.

## Llaves con elección de fruta (6 de noviembre)

Cada llave añade una elección guardada en `pendingFruitChoices` del perfil. Abre un diálogo con todas las frutas todavía bloqueadas, incluidas las de puntos/nivel. Una selección desbloquea solo esa fruta; ya no se desbloquean frutas automáticamente por número de llave. Se conservan los desbloqueos previos y siguen existiendo los desbloqueos naturales por nivel/puntos. Cuando ya no quedan frutas bloqueadas, cada elección pendiente da 250 puntos. Las elecciones sin usar reaparecen al entrar.

El diálogo pausa Runner, temporizadores de poderes/transiciones y el reloj `gameNow()` usado por animaciones y plazos. Al elegir se reanuda; no se permite cerrar con Escape para perder accidentalmente la elección. La lista de poderes se comparte entre juego y portada mediante `src/fruit-powers.js`. Las fichas de frutas antes asignadas a llaves ahora indican que se pueden elegir con una llave.

Pruebas: elección única, duplicados, varias elecciones, pausas y bonus correctos. Probado en Chrome con origen aislado 127.0.0.1:5184: elegir dragón con una llave y volver a entrar conserva dragón desbloqueado; el progreso del servidor habitual no se modificó.

## Regla de partida nueva (6 de noviembre)

Al comenzar una partida en nivel 1 se reinician frutas a banana/mandarina, puntos a cero, llaves y elecciones pendientes a cero y vidas según modo. El perfil previo no se recupera ni se mezcla con los desbloqueos actuales. Las frutas obtenidas con llaves/niveles/puntos duran esa partida. El récord de nivel del mapa y el modo elegido se conservan. El botón Reiniciar sigue gastando una vida y reponiendo frutas dentro de la misma partida. Al recrear el escenario por resize se conservan nivel, puntos, desbloqueos, llaves, elecciones y vidas, aunque se reconstruye el escenario del nivel. Pruebas aisladas correctas y verificado en Chrome con datos previos de prueba: solo banana/mandarina disponibles al entrar, sin diálogo de llaves antiguas.

## Climas visibles (6 de noviembre)

Efectos climáticos movidos a `afterRender`, encima de los cuerpos: sol con rayos suaves, viento con 15 hojas y estelas direccionales, lluvia con hasta 95 gotas, tormenta con más gotas y relámpago gradual cada 6,5 s, nieve con copos visibles. Nubes móviles para lluvia/tormenta/nieve. Se desactivaron partículas y destellos CSS anteriores para evitar duplicados; se conserva un tinte ligero por clima. Se eliminó el rayo fijo del fondo. Pruebas de los seis renderizados correctas; lluvia y nieve revisadas visualmente en servidor aislado 127.0.0.1:5185. Sin cambios en la física del clima.

## Ideas descartadas

El usuario canceló la incorporación de Higo Imán, Caqui Burbuja, Granada Sorpresa y Ciruela Fantasma. Se retiraron también del dragón, portada, catálogo y bandeja; siguen siendo 18 frutas. Carambola Estrella también fue descartada.

## Selector de modo retirado (6 de noviembre)

Se elimina de la portada la sección «¿Cómo quieres jugar?» y el enlace para cambiar modo. La navegación ofrece Jugar en su lugar y los enlaces de portada inician explícitamente modo normal (`modo=aventura`). `home.js` ya no busca los controles de modo retirados; mantiene mapa y fichas de poderes.

## Dragón retirado (6 de noviembre)

Por petición del usuario se retira la Fruta del Dragón de datos, poderes, portada (incluida la ilustración), catálogo, bandeja y opciones de llave. Quedan 17 frutas. Se eliminaron sus combinaciones especiales; las frutas restantes conservan sus poderes. Pruebas de correspondencia de las 17 frutas y división de mandarina, uvas, arándanos y cerezas correctas.
