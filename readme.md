# Super Frutas al Rescate. by Codo77

Primera version web del juego: frutas en una catapulta contra verduras al otro lado de la pantalla.

## Probar local

```bash
python3 -m http.server 5173
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

## Ranking online

El ranking usa el proyecto `fruits` de Supabase. La estructura reproducible esta en `supabase/schema.sql`.

- El navegador solo recibe la clave `publishable`.
- RLS permite leer el ranking, pero bloquea la escritura directa de la tabla.
- Las puntuaciones se guardan mediante una funcion limitada a 12 envios por minuto.
- Un mismo nombre solo puede guardar una vez por minuto y la tabla tiene un limite no destructivo de 10.000 filas.
- Los visitantes no pueden editar ni borrar registros.
- Los nombres se muestran como texto y se limitan a 16 caracteres seguros.
- `.env` contiene el token administrativo local y esta excluido de Git y de GitHub Pages.

Las claves `secret`, `service_role` y el token administrativo nunca deben copiarse al frontend.

## Controles
