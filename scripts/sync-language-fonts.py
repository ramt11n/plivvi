"""Vendor OFL script fonts from Google Fonts. Runtime never uploads document text."""
import pathlib
import re
import urllib.parse
import urllib.request

root = pathlib.Path(__file__).resolve().parents[1] / 'public' / 'fonts'
for script in ['Arabic', 'Devanagari', 'Bengali', 'Tamil', 'Telugu', 'Gujarati',
               'Gurmukhi', 'Kannada', 'Malayalam', 'Hebrew', 'Thai']:
    family = 'NotoSans' + script
    base = 'https://raw.githubusercontent.com/google/fonts/main/ofl/' + family.lower() + '/'
    meta = urllib.request.urlopen(base + 'METADATA.pb', timeout=30).read().decode()
    filename = re.search(r'filename: "([^"]+)"', meta).group(1)
    for remote, local in [(filename, family + '.ttf'), ('OFL.txt', family + '-OFL.txt')]:
        destination = root / local
        if not destination.exists():
            destination.write_bytes(urllib.request.urlopen(base + urllib.parse.quote(remote), timeout=60).read())
    print(family, (root / (family + '.ttf')).stat().st_size)
