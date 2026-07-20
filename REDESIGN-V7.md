# Platform Hero Redesign V7

The homepage platform visual was rebuilt from scratch as a single coordinated interaction system.

## What changed
- Removed the previous PNG-led stack and brittle connector layout.
- Rebuilt the platform stack in scalable SVG with six independent layers.
- Added exact continuous connectors from each layer anchor to its matching capability card.
- Added flowing dash animation and a travelling signal pulse.
- Added hover and keyboard focus interactions that highlight the selected layer, connector, and card while fading unrelated elements.
- Added ambient core glow, independent floating layers, a floating top cap, glass capability cards, and responsive fallbacks.
- Added reduced-motion support.

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```
