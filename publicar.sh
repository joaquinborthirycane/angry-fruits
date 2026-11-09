#!/bin/sh

set -eu

cd "$(dirname "$0")"

python3 scripts/check_security.py --staged

if [ "$(git branch --show-current)" != "main" ]; then
  echo "La publicacion debe hacerse desde la rama main." >&2
  exit 1
fi

message=${1:-"Version estable"}

# Explicit paths prevent a local credential or test file from being published.
git add -- index.html game.html styles.css home.css src/game.js src/home.js \
  src/fruit-powers.js vendor/matter-js/matter.min.js vendor/matter-js/LICENSE \
  vendor/matter-js/provenance.json scripts/check_security.py package.json \
  .gitignore .github/workflows/publicar.yml .github/dependabot.yml publicar.sh \
  readme.md AGENTS.md CONTEXTO.md SECURITY.md
python3 scripts/check_security.py --staged
if ! git diff --cached --quiet; then
  git commit -m "Publicar: $message"
else
  git commit --allow-empty -m "Publicar: $message"
fi

git push origin main

echo "Publicacion iniciada. GitHub Pages terminara en unos minutos."
echo "URL: https://joaquinborthirycane.github.io/angry-fruits/"
