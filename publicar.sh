#!/bin/sh

set -eu

cd "$(dirname "$0")"

for file in index.html game.html styles.css src/game.js; do
  if [ ! -f "$file" ]; then
    echo "Falta un archivo necesario: $file" >&2
    exit 1
  fi
done

if [ "$(git branch --show-current)" != "main" ]; then
  echo "La publicacion debe hacerse desde la rama main." >&2
  exit 1
fi

message=${1:-"Version estable"}

git add --all
if ! git diff --cached --quiet; then
  git commit -m "Publicar: $message"
else
  git commit --allow-empty -m "Publicar: $message"
fi

git push origin main

echo "Publicacion iniciada. GitHub Pages terminara en unos minutos."
echo "URL: https://joaquinborthirycane.github.io/angry-fruits/"
