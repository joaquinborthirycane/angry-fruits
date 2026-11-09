# Super Frutas al Rescate. by Codo77

Primera version web del juego: frutas en una catapulta contra verduras al otro lado de la pantalla.

## Probar local

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Despues abre en Chrome:

```text
http://localhost:5173
```

## Publicar una version estable

La publicacion usa GitHub Pages y solo se activa al ejecutar:

```bash
./publicar.sh "Descripcion de la version"
```

El juego publico esta en:

```text
https://joaquinborthirycane.github.io/angry-fruits/
```

El juego funciona sin servicios de base de datos. Los puntos de la partida y el progreso se conservan en el navegador.

## Controles

## Seguridad

Antes de publicar se ejecuta `python3 scripts/check_security.py`. Matter.js se sirve desde una copia local verificada en `vendor/matter-js/`, con su licencia e información de origen. La publicación solo acepta archivos de una lista explícita. Consulta `SECURITY.md` para los límites y las comprobaciones de la revisión.
