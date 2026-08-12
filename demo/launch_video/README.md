# UniformOrder launch video

A 40.5-second, silent-first launch film for the open-source release of UniformOrder.

The film follows the product's real workflow: parents order from a mobile storefront, operators receive the order in a live dashboard, and the P&C manages fulfilment, reporting, and its catalogue. All product screens are captured from the repository's seeded `demo-academy` tenant. Claims are limited to implemented functionality documented in `docs/User_Manuals` and verified against the application.

## Structure

- `hyperframes/` — animated brand opener, built and rendered with HyperFrames.
- `remotion/` — final edit, product walkthrough, transitions, and closing card.
- `renders/` — rendered MP4 masters.
- `previews/` — representative stills used for visual review.
- `DESIGN.md` — visual identity and motion rules.
- `screens.json` — source capture manifest.

## Render

Render the HyperFrames opener first:

```bash
cd demo/launch_video/hyperframes
npm install
npm run check
npx --yes hyperframes@0.7.107 render --strict-all --output ../renders/hyperframes-intro.mp4
cp ../renders/hyperframes-intro.mp4 ../remotion/public/assets/hyperframes-intro.mp4
```

Then build the final film:

```bash
cd demo/launch_video/remotion
npm install
npm run lint
npx remotion render UniformOrderLaunch ../renders/uniformorder-open-source-launch.mp4 --codec=h264 --crf=18 --concurrency=6
```

Final output: `renders/uniformorder-open-source-launch.mp4`.

## Editorial notes

- Designed for muted autoplay; no narration is required to understand the story.
- Real product captures use synthetic demo data only.
- Planned or partial features are intentionally excluded from the launch claims.
- The call to action uses `uniformorder.online`; no repository remote was configured when the film was produced.
