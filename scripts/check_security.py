#!/usr/bin/env python3
"""Check the static site before staging or deploying it. Never print secret values."""
import argparse
import base64
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SITE_FILES = (
    'index.html', 'game.html', 'styles.css', 'home.css',
    'src/game.js', 'src/home.js', 'src/fruit-powers.js',
    'vendor/matter-js/matter.min.js', 'vendor/matter-js/LICENSE',
)
PUBLISH_FILES = SITE_FILES + (
    'vendor/matter-js/provenance.json', 'scripts/check_security.py',
    'package.json', '.gitignore', '.github/workflows/publicar.yml',
    '.github/dependabot.yml', 'publicar.sh', 'readme.md', 'AGENTS.md',
    'CONTEXTO.md', 'SECURITY.md',
)
SECRET_PATTERNS = (
    re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    re.compile(r'\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b'),
    re.compile(r'\bgithub_pat_[A-Za-z0-9_]{40,}\b'),
    re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
)


def check_file(path):
    if path.is_symlink() or not path.resolve().is_relative_to(ROOT):
        raise ValueError(f'Ruta insegura o enlace simbólico: {path.name}')
    if not path.is_file():
        raise ValueError(f'Falta el archivo: {path.relative_to(ROOT)}')


class PageChecks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.csp = None
        self.inside_script = False
        self.vendor_integrity = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for name, value in attrs.items():
            if name.lower().startswith('on') or name.lower() == 'style':
                raise ValueError('HTML con código o estilo inline')
            if name in ('href', 'src') and re.match(r'\s*(?:javascript|data):', value or '', re.I):
                raise ValueError('URL ejecutable incrustada en HTML')
        if tag == 'meta' and attrs.get('http-equiv', '').lower() == 'content-security-policy':
            self.csp = attrs.get('content', '')
        if tag == 'script':
            self.inside_script = True
            src = attrs.get('src', '')
            if not src or re.match(r'(?i)(?:[a-z]+:|//)', src):
                raise ValueError('Script inline o externo no permitido')
            if src == 'vendor/matter-js/matter.min.js':
                self.vendor_integrity = attrs.get('integrity')

    def handle_endtag(self, tag):
        if tag == 'script':
            self.inside_script = False

    def handle_data(self, data):
        if self.inside_script and data.strip():
            raise ValueError('Código inline no permitido')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--staged', action='store_true')
    args = parser.parse_args()
    for name in PUBLISH_FILES:
        check_file(ROOT / name)
    provenance = json.loads((ROOT / 'vendor/matter-js/provenance.json').read_text())
    for name in ('matter.min.js', 'LICENSE'):
        digest = hashlib.sha256((ROOT / 'vendor/matter-js' / name).read_bytes()).hexdigest()
        if digest != provenance['files'][name]:
            raise ValueError(f'La copia de Matter.js no coincide con la verificada: {name}')
    expected_sri = 'sha384-' + base64.b64encode(hashlib.sha384((ROOT / 'vendor/matter-js/matter.min.js').read_bytes()).digest()).decode()
    for name in ('index.html', 'game.html'):
        page = PageChecks()
        page.feed((ROOT / name).read_text())
        directives = dict(part.strip().split(' ', 1) for part in (page.csp or '').split(';') if part.strip())
        for key, expected in {'script-src': "'self'", 'connect-src': "'none'", 'object-src': "'none'", 'base-uri': "'none'", 'form-action': "'none'"}.items():
            if directives.get(key) != expected:
                raise ValueError(f'CSP inesperada en {name}: {key}')
        if "'unsafe-inline'" in (page.csp or '') or "'unsafe-eval'" in (page.csp or ''):
            raise ValueError(f'CSP demasiado permisiva en {name}')
        if name == 'game.html' and page.vendor_integrity != expected_sri:
            raise ValueError('Integridad SRI incorrecta para Matter.js')
    for name in PUBLISH_FILES:
        data = (ROOT / name).read_text(errors='replace')
        for pattern in SECRET_PATTERNS:
            if pattern.search(data):
                raise ValueError(f'Posible secreto en {name}; valor oculto')
    if args.staged:
        staged = subprocess.check_output(['git', 'diff', '--cached', '--name-only', '-z'], cwd=ROOT).decode().split('\0')
        unexpected = [name for name in staged if name and name not in PUBLISH_FILES]
        if unexpected:
            raise ValueError('Hay archivos preparados fuera de la lista permitida: ' + ', '.join(repr(name) for name in unexpected))
    print('Seguridad: integridad, CSP, archivos permitidos y patrones de secretos correctos.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError) as error:
        print(f'Comprobación de seguridad detenida: {error}', file=sys.stderr)
        sys.exit(1)
