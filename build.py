#!/usr/bin/env python3
"""Build the Sanatana site.

    python3 build.py            build every page listed in content/
    python3 build.py gita       build just content/gita.yaml

Reads   content/site.yaml        site name, footer links
        content/<page>.yaml      one file per page: settings + content blocks
        templates/*.html         page layout and reusable blocks
Writes  <page>.html              in this folder, ready to publish as-is

Requires PyYAML and Jinja2:  pip install -r requirements.txt
"""
import hashlib, json, re, sys
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined, ChainableUndefined

ROOT = Path(__file__).resolve().parent
CONTENT, TEMPLATES, ASSETS = ROOT / 'content', ROOT / 'templates', ROOT / 'assets'


def color(v):
    """Palette name -> CSS variable; literal colours pass through."""
    if v is None:
        return 'inherit'
    v = str(v)
    return v if v.startswith(('#', 'rgb', 'hsl', 'var(')) else f'var(--{v})'


def to_js(obj):
    """JSON for an inline <script>, safe even if content contains '</script>'."""
    return json.dumps(obj, ensure_ascii=False).replace('</', '<\\/')


MELA_PAIRS = [(1, 1), (1, 2), (1, 3), (2, 2), (2, 3), (3, 3)]


def mela(n):
    """Swara positions of melakarta n (1-72): six R-G pairs x six D-N pairs x two Madhyamas."""
    i = n - 1
    r, g = MELA_PAIRS[(i % 36) // 6]
    d, nn = MELA_PAIRS[i % 6]
    return {'r': r, 'g': g, 'm': 1 if i < 36 else 2, 'd': d, 'n': nn, 'pairs': MELA_PAIRS}


def polar(cx, cy, r, deg):
    """Point on a circle; 0 degrees is straight up, angles run clockwise."""
    import math
    a = math.radians(deg - 90)
    return round(cx + r * math.cos(a), 2), round(cy + r * math.sin(a), 2)


def sector(cx, cy, r1, r2, a0, a1):
    """SVG path for a ring segment between radii r1 < r2 and angles a0 < a1 (degrees, clockwise from top)."""
    large = 1 if a1 - a0 > 180 else 0
    p1, p2 = polar(cx, cy, r2, a0), polar(cx, cy, r2, a1)
    p3, p4 = polar(cx, cy, r1, a1), polar(cx, cy, r1, a0)
    return (f'M{p1[0]} {p1[1]} A{r2} {r2} 0 {large} 1 {p2[0]} {p2[1]} '
            f'L{p3[0]} {p3[1]} A{r1} {r1} 0 {large} 0 {p4[0]} {p4[1]} Z')


def inline_svg(name):
    """Inline an SVG from assets/figures so the page theme (CSS variables) can colour it."""
    from markupsafe import Markup
    svg = (ASSETS / 'figures' / name).read_text(encoding='utf-8')
    # drop embedded metadata (e.g. provenance manifests some tools add) so it is not inlined into pages
    svg = re.sub(r'<metadata>.*?</metadata>\s*', '', svg, flags=re.S).replace(' xmlns:c2pa="http://c2pa.org/manifest"', '')
    return Markup(svg)


TITHI = {'shukla': 0, 'krishna': 15}


def wheel_angle(w):
    """Angle on the festival wheel: 30 degrees per amanta month, 1 degree per tithi.
    tithi: 1-15 shukla (15 = purnima), 1-14 krishna, 'amavasya' = 30th."""
    if w.get('angle') is not None:
        return w['angle']
    t = 29 if w.get('tithi') == 'amavasya' else TITHI[w.get('paksha', 'shukla')] + int(w['tithi']) - 1
    return w['month'] * 30 + t + 0.5


def wheel_lanes(cards, lanes=(214, 184), gap=8.0):
    """Radius for each lunar festival dot so neighbours closer than `gap` degrees
    move to the inner lane instead of overlapping. Returns {card id: radius}."""
    dots = sorted(((wheel_angle(c['wheel']), c['id']) for c in cards
                   if c.get('wheel') and not c['wheel'].get('solar')))
    last, out = {}, {}
    for ang, cid in dots:
        r = next((r for r in lanes if ang - last.get(r, -99) >= gap), None)
        if r is None:  # all lanes busy: take the lane whose last dot is furthest back
            r = min(lanes, key=lambda r: last.get(r, -99))
        last[r] = ang; out[cid] = r
    return out


def combine(a, b):
    out = dict(a); out.update(b); return out


def palette_css(page):
    pal = page.get('palette', {}) or {}
    dark = ' '.join(f'--{k}:{v[0]};' for k, v in pal.items())
    light = ' '.join(f'--{k}:{v[1]};' for k, v in pal.items())
    grad = [color(g) for g in page.get('gradient') or [page.get('primary', 'muted')]]
    if len(grad) == 1: grad = grad * 2
    extra = [f'--primary:{color(page.get("primary", "muted"))};',
             f'--grad-h:linear-gradient(90deg,{",".join(grad)});',
             f'--grad-v:linear-gradient({",".join(grad)});']
    if page.get('om_gradient'):
        extra.append(f'--grad-om:linear-gradient(135deg,{",".join(color(g) for g in page["om_gradient"])});')
    return f':root,[data-theme="dark"]{{{dark}}} [data-theme="light"]{{{light}}} :root{{{" ".join(extra)}}}'


def group_blocks(blocks):
    """Wrap consecutive blocks marked group: category in one container (Vedic map view)."""
    out = []
    for b in blocks:
        g = b.get('group')
        if g and out and out[-1].get('type') == 'group' and out[-1]['name'] == g:
            out[-1]['blocks'].append(b)
        elif g:
            out.append({'type': 'group', 'name': g, 'cls': g + '-view', 'blocks': [b]})
        else:
            out.append(b)
    return out


def all_cards(blocks):
    for b in blocks:
        yield from b.get('cards', [])
        for st in b.get('stages', []):
            yield from st['cards']
        yield from all_cards(b.get('blocks', []))


def check(name, page, blocks):
    """Catch common editing mistakes early with a clear message."""
    pal = set((page.get('palette') or {}).keys()) | {'muted', 'text', 'primary'}
    problems = []
    def chk(v, where):
        if v and not str(v).startswith(('#', 'rgb', 'hsl', 'var(')) and v not in pal:
            problems.append(f'{where}: colour "{v}" is not in this page\'s palette')
    ids = {}
    for c in all_cards(blocks):
        chk(c.get('accent'), f'card "{c.get("title")}"')
        if c.get('id'):
            if c['id'] in ids: problems.append(f'duplicate card id "{c["id"]}"')
            ids[c['id']] = c
    for c in all_cards(blocks):
        for link in (c.get('links') or '').split(','):
            if link.strip() and link.strip() not in ids:
                problems.append(f'card "{c.get("title")}" links to unknown id "{link.strip()}"')
    for c in all_cards(blocks):
        for f in c.get('facts') or []:
            if len(f) != 2:
                problems.append(f'card "{c.get("title")}": a fact has {len(f)} parts (put quotes around text with commas)')
    def walk(bs):
        for b in bs:
            if b.get('type') == 'compare':
                for r in b['rows']:
                    if len(r['cells']) != len(b['columns']):
                        problems.append(f'table row "{r["label"]}" has {len(r["cells"])} cells for {len(b["columns"])} columns')
            walk(b.get('blocks', []))
    walk(blocks)
    for f in page.get('filters') or []:
        chk(f.get('color'), f'filter "{f.get("label")}"')
    if problems:
        raise SystemExit(f'\n{name}: please fix\n  - ' + '\n  - '.join(problems))


def build(names=None):
    site = yaml.safe_load((CONTENT / 'site.yaml').read_text(encoding='utf-8'))
    env = Environment(loader=FileSystemLoader(TEMPLATES), undefined=ChainableUndefined,
                      trim_blocks=False, lstrip_blocks=False, autoescape=True)
    env.filters['color'] = color
    env.filters['combine'] = combine
    env.globals.update(mela=mela, polar=polar, sector=sector, inline_svg=inline_svg, wheel_angle=wheel_angle, wheel_lanes=wheel_lanes)
    tpl = env.get_template('base.html')
    version = hashlib.sha1(b''.join(f.read_bytes() for f in sorted(ASSETS.glob('*.*')))).hexdigest()[:8]

    files = sorted(p for p in CONTENT.glob('*.yaml') if p.name != 'site.yaml' and not p.name.startswith('_'))
    if names:
        files = [CONTENT / (n if n.endswith('.yaml') else n + '.yaml') for n in names]
    for path in files:
        data = yaml.safe_load(path.read_text(encoding='utf-8'))
        page, blocks = data['page'], data['blocks']
        check(path.name, page, blocks)
        cards = list(all_cards(blocks))
        sites = [{'id': c['id'], 'n': c.get('num') or i + 1, 'name': c['map'].get('name', c['title']), 'sub': c['map']['popup'],
                  'lat': c['map']['lat'], 'lng': c['map']['lng'], 'color': color(c.get('accent') or page.get('primary'))}
                 for i, c in enumerate(c for c in cards if c.get('map'))]
        route = None
        if any(b['type'] == 'map' and b.get('route') for b in blocks):
            route = [c['id'] for c in cards if c.get('map') and c['map'].get('route', True)]
        data = {}
        for b in blocks:
            if b['type'] == 'raga-geometry':
                data['ragas'] = b['ragas']
        groups = None
        for b in blocks:
            if b['type'] == 'geo-map':
                groups = [{'key': g['key'], 'label': g['label'], 'plural': g.get('plural', g['label']), 'color': color(g['color']),
                           'sites': g['sites']} for g in b['groups']]
        html = tpl.render(site=site, page=page, blocks=group_blocks(blocks), all_cards=cards, palette_css=palette_css(page),
                          uses_map=bool(sites or groups), sites_json=to_js(sites) if sites else None, groups_json=to_js(groups) if groups else None, asset_version=version,
                          route_json=to_js(route) if route else None, data_json=to_js(data) if data else None,
                          has_empty=any(b.get('type') == 'empty' or b.get('empty') for b in blocks))
        html = '\n'.join(line.rstrip() for line in html.splitlines() if line.strip()) + '\n'
        (ROOT / page['file']).write_text(html, encoding='utf-8')
        print(f'built {page["file"]}')


if __name__ == '__main__':
    build(sys.argv[1:] or None)
