# Sanatana

Visual maps of Hindu literature, philosophy and saints — live at <https://sanatanadharma.pages.dev>.

The site is plain static HTML. The pages are **generated** from content files, so the words live in one place and the design lives in another.

```
content/        one YAML file per page — all the words, dates, colours and map coordinates
  site.yaml     site name and the footer links shown on every page
  _template.yaml  a commented starter for a new page
templates/      page layout (base.html) and reusable blocks (blocks.html)
assets/         site.css and site.js, shared by every page
build.py        turns content + templates into the .html files
*.html          the generated pages — publish these as-is
```

## Editing a page

1. Open the page's file in `content/`, for example `content/gita.yaml`, and change the text.
2. Rebuild: `python3 build.py` (or just that page: `python3 build.py gita`).
3. Open the `.html` file in a browser to check it, then commit both the `.yaml` and the `.html`.

Don't edit the `.html` files directly — the next build will overwrite them.

First time only: `pip install -r requirements.txt` (PyYAML and Jinja2).

## Adding a page

1. Copy `content/_template.yaml` to `content/<name>.yaml` and fill it in.
2. Add the page to the `nav` list in `content/site.yaml` (it then appears in every footer).
3. Add a card for it to `content/index.yaml` so it shows on the home page.
4. Run `python3 build.py`.

The build stops with a plain message if something is off — a colour that isn't in the page's palette, two cards with the same `id`, or a Vedic connection pointing at a card that doesn't exist.

## Block types

Each entry under `blocks:` has a `type`:

| type | used for |
|---|---|
| `filters` | the row of filter chips (defined under `page.filters`) |
| `cards` | a titled section of cards — the workhorse of every page |
| `journey` | the jump strip of numbered links (`style: numbers` for Gita-style squares) |
| `map` | the Leaflet map; markers come from cards that have a `map:` entry. Add `route: true` to draw the journey line in card order (a card can opt out with `route: false` in its `map:`) |
| `compare` | side-by-side comparison table; a chip named after a column shows only that column, and rows with `tags` follow the chips |
| `tree` / `lineage` | Vedic knowledge tree / matha lineage tree |
| `spectrum`, `glance`, `pairs` | Vedanta spectrum, Shanmata at-a-glance, Darshana pairs |
| `table`, `numgrid` | Nakshatra table, Samvatsara grid |
| `family` | left-to-right family tree; each person may have `with` (spouses), `note`, `tags` (house) and `children`; `side: true` draws a dashed box |
| `lifespans` | horizontal lifetime bars on a year axis (`from`, `to`, `step`); `circa: true` gives a dotted bar; `label:` replaces the printed years (e.g. `1989–present`) |
| `melakarta` | the 72-melakarta chart; swaras are computed by `build.py`, so only the names are listed; `play: {29: shankarabharanam}` adds a ▶ link to Raga Geometry |
| `figures` | side-by-side labelled diagrams; each item names an SVG in `assets/figures/` (`svg: nagara.svg`) and is drawn inline so it follows the theme colours |
| `festival-wheel` | the year as a lunar wheel: `ritus`, 12 amanta `months` (with `greg`), a `hub` and a `key`. Every card on the page with `wheel: {month, paksha, tithi}` becomes a numbered dot linking to it; `{angle, solar: true}` puts it on the outer solar ring, `approx: true` draws it dashed. Close dots move to an inner lane automatically |
| `raga-geometry` | the interactive raga and Adi Talam wheels; the ragas are listed in the YAML (`avaro: reverse` = descent is the ascent reversed) and the page sets `scripts: [raga.js]` |
| `life-timeline` | Samskaras timeline, grouped by life stage |
| `story`, `callout`, `counts`, `panel` | text boxes |
| `sources` | the Sources list at the bottom |

## Shared settings

Theme (light/dark), text size and the Sanskrit/Tamil toggle are saved once for the whole site, so a choice made on one page carries to every other page.

## Card fields

Every field is optional except `title`. Fields that may contain links or emphasis (`body`, `intro`, `facts` values, table cells, `deity_line`) accept HTML; the rest are plain text.

`id`, `anchor`, `title`, `native`, `mark`, `icon`, `kicker`, `subtitle`, `badge`, `num`, `corner_icon`, `tagline`, `accent`, `tags`, `era`, `links`, `deity_emoji`, `deity_line`, `body`, `key_teaching`, `facts`, `highlight`, `chips`, `hint`, `journey`, `map`.
