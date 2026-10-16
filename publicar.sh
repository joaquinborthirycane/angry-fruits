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

message=${1:-"Publicar version estable"}

git add --all
if ! git diff --cached --quiet; then
  git commit -m "$message"
fi

git push origin main

tag="publicar-$(date -u +%Y%m%d-%H%M%S)"
git tag -a "$tag" -m "$message"
git push origin "$tag"

echo "Publicacion iniciada: $tag"
echo "URL: https://joaquinborthirycane.github.io/angry-fruits/"
