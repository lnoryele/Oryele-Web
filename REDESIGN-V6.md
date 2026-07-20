# Platform Animation Redesign V6

The prior connector implementation was removed and rebuilt from scratch.

- Uses a clean stack asset without baked connector lines.
- Uses one SVG map for all six continuous connectors.
- Every line terminates at the center-left edge of its matching card.
- Animated dash flow and travelling pulses move from platform to capability.
- Hover and keyboard focus isolate the selected card and its complete connector.
- No runtime geometry calculations, transformed CSS layers, or black rendering artifacts.
- Responsive and reduced-motion behavior are included.
