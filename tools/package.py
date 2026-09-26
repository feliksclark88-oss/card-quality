#!/usr/bin/env python3
"""Validate and package only distributable widget files, using the stdlib."""
import hashlib
import json
from pathlib import Path
import struct
import zipfile

ROOT = Path(__file__).resolve().parent.parent
WIDGET = ROOT / 'widget'
SIZES = {'logo_main.png': (400, 272), 'logo_small.png': (108, 108),
         'logo.png': (130, 100), 'logo_medium.png': (240, 84),
         'logo_min.png': (84, 84)}


def build():
    manifest = json.loads((WIDGET / 'manifest.json').read_text())
    for key in ('name', 'description', 'short_description', 'locale', 'installation'):
        assert key in manifest['widget'], f'missing widget.{key}'
    assert manifest['locations'], 'locations required'
    assert 'settings' in manifest, 'settings required'
    locales = manifest['widget']['locale']
    for locale in locales:
        strings = json.loads((WIDGET / 'i18n' / (locale + '.json')).read_text())
        keys = [manifest['widget'][key] for key in ('name', 'description', 'short_description')]
        keys.append(manifest['tour']['tour_description'])
        for key in keys:
            node = strings
            for part in key.split('.'):
                node = node[part]
            assert isinstance(node, str) and node.strip(), f'empty translation {key}'
    sizes = dict(SIZES)
    for locale in locales:
        tours = manifest['tour']['tour_images'][locale]
        assert tours, 'tour images required'
        for name in tours:
            path = Path(name)
            assert path.parent == Path('/images'), name
            sizes[path.name] = (1188, 616)
    for name, size in sizes.items():
        data = (WIDGET / 'images' / name).read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n', name
        assert struct.unpack('>II', data[16:24]) == size, name
        assert len(data) <= 300 * 1024, name
    assert (WIDGET / 'script.js').is_file()
    files = sorted(p for p in WIDGET.rglob('*') if p.is_file())
    for file in files:
        assert not file.is_symlink(), 'symlinks forbidden in distribution'
        assert file.suffix in ('.js', '.json', '.css', '.png', '.svg'), str(file)
        if file.suffix in ('.js', '.json', '.css', '.svg'):
            data = file.read_bytes()
            assert not data.startswith(b'\xef\xbb\xbf') and b'\r' not in data, str(file)
            data.decode('utf-8')
    dist = ROOT / 'dist'
    dist.mkdir(exist_ok=True)
    archive = dist / 'widget.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for file in files:
            info = zipfile.ZipInfo(str(file.relative_to(WIDGET)), (2026, 9, 26, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            bundle.writestr(info, file.read_bytes())
    result = {'archive': 'widget.zip', 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
              'bytes': archive.stat().st_size, 'files': [str(p.relative_to(WIDGET)) for p in files]}
    (dist / 'manifest.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    build()
