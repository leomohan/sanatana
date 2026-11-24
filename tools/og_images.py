#!/usr/bin/env python3
"""Draw the 1200x630 social preview images (assets/og/<page>.jpg) shown when a page is shared.

Run after adding a page or changing a page title:
    pip install playwright pyyaml && python -m playwright install chromium
    python3 tools/og_images.py            # every page
    python3 tools/og_images.py festivals  # one page
A page without its own image falls back to site.yaml's og_image, so this step is optional.
"""
import html
import os
import sys
from pathlib import Path

import yaml
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
CONTENT, OUT = ROOT / 'content', ROOT / 'assets' / 'og'
DEFAULT = ['#ff9f43', '#e07b1a']

CARD = """<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1200px;height:630px;overflow:hidden;font-family:'Inter','DejaVu Sans',sans-serif;color:#eae6f7;
  background:radial-gradient(900px 600px at 100% 0%,{a}33,transparent 60%),radial-gradient(700px 500px at 0% 100%,{b}22,transparent 60%),
  linear-gradient(160deg,#1b1435,#0e0b1a 70%);position:relative}}
.bar{{position:absolute;left:0;top:0;bottom:0;width:14px;background:linear-gradient({a},{b})}}
.om{{position:absolute;right:56px;top:40px;font:400 300px/1 'FreeSerif',serif;color:{a};opacity:.13}}
.wrap{{position:absolute;left:84px;right:84px;top:70px;bottom:64px;display:flex;flex-direction:column}}
.brand{{font:700 26px/1 'Inter';letter-spacing:.24em;text-transform:uppercase;color:{a};display:flex;align-items:center;gap:14px}}
.brand b{{font:400 40px/1 'FreeSerif',serif;letter-spacing:0}}
h1{{font-family:'Inter Display','Inter',sans-serif;font-weight:800;font-size:{size}px;line-height:1.06;letter-spacing:-.02em;margin-top:auto;max-width:960px}}
p{{font-size:32px;line-height:1.3;color:#a29ac2;margin-top:22px;max-width:980px}}
.foot{{margin-top:auto;padding-top:28px;font-size:22px;color:#a29ac2;display:flex;gap:14px;align-items:center}}
.foot i{{width:10px;height:10px;border-radius:50%;background:{a};display:inline-block}}
</style></head><body><div class="bar"></div><div class="om">ॐ</div>
<div class="wrap"><div class="brand"><b>ॐ</b>Sanatana</div><h1>{title}</h1>{sub}
<div class="foot"><i></i>{host}{tag}</div></div></body></html>"""


def colours(page):
    pal, grad = page.get('palette') or {}, page.get('gradient') or []
    keys = [k for k in grad if k in pal] or list(pal)
    if not keys:
        return DEFAULT
    first = pal[keys[0]][0]
    second = pal[keys[1]][0] if len(keys) > 1 else pal[keys[0]][1]
    return [first, second]


def card(site, page):
    if page.get('layout') == 'home':
        title, sub = 'Visual maps of Hindu literature, philosophy &amp; saints', \
            'Vedas · Gita · Vedanta · Ramayana · Mahabharata · Temples · Festivals · Carnatic music'
    else:
        parts = [x.strip() for x in page['title'].split(' — ', 1)]
        title, sub = html.escape(parts[0]), html.escape(parts[1]) if len(parts) > 1 else ''
    a, b = colours(page)
    size = 84 if len(title) <= 28 else 72 if len(title) <= 44 else 60
    host = site['url'].split('//', 1)[-1].rstrip('/')
    tag = '' if page.get('layout') == 'home' else '<span>·</span>visual maps of Hindu literature, philosophy and saints'
    return CARD.format(a=a, b=b, title=title, sub=f'<p>{sub}</p>' if sub else '', size=size, host=host, tag=tag)


def main(names):
    site = yaml.safe_load((CONTENT / 'site.yaml').read_text(encoding='utf-8'))
    OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in CONTENT.glob('*.yaml') if p.name != 'site.yaml' and not p.name.startswith('_'))
    if names:
        files = [CONTENT / (n if n.endswith('.yaml') else n + '.yaml') for n in names]
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.environ.get('CHROME') or None)  # CHROME=/path/to/chrome to use your own
        tab = browser.new_page(viewport={'width': 1200, 'height': 630})
        for path in files:
            page = yaml.safe_load(path.read_text(encoding='utf-8'))['page']
            if page.get('noindex'):
                continue
            tab.set_content(card(site, page))
            tab.wait_for_timeout(50)
            out = OUT / (page['file'][:-5] + '.jpg')
            tab.screenshot(path=str(out), type='jpeg', quality=88)
            print('drew', out.relative_to(ROOT))
        browser.close()


if __name__ == '__main__':
    main(sys.argv[1:])
