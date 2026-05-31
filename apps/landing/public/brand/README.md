# UniformOrder brand / logo assets

Standalone logo exports for video, decks, and external use. Transparent background.

| File | Use |
|---|---|
| `uniformorder-logo-navy.{svg,png}` | Primary lockup (mark + wordmark), navy `#0E2A47` — on light backgrounds |
| `uniformorder-logo-white.{svg,png}` | Reversed lockup, white — for the closing reveal / dark backgrounds |
| `uniformorder-mark-navy.{svg,png}` | Icon-only (UO monogram), navy |
| `uniformorder-mark-white.{svg,png}` | Icon-only, white — dark backgrounds |
| `uniformorder-mark-gold.{svg,png}` | Icon-only, gold `#B08A3E` — accent use |

**SVGs** are fully portable vectors — the "UniformOrder" wordmark is converted to outlines
(Newsreader SemiBold), so they render identically with no font installed. Scale to any size.

**PNGs** are rendered at 4× (lockups 3480×672, marks 640×640) with a transparent background.
Re-render larger from the SVG if needed.

Brand colours: navy `#0E2A47`, gold `#B08A3E`. Wordmark typeface: Newsreader (weight 600).

Regenerate: `python3 /tmp/build_logo.py` then the Chrome-headless render step (see commit notes).
