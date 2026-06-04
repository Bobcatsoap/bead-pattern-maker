# Bead Pattern Maker

Convert any image into a fuse bead (Perler / MARD) pattern with automatic color matching.

## Features

- **Image import**: supports any image format, auto-fits to canvas
- **Smart color quantization**: K-means clustering or usage-priority algorithms, picks optimal palette from 221 MARD colors (4–60 selectable)
- **Color ignore**: click any color region on the canvas to erase connected same-color areas; optional stray-pixel cleanup
- **Auto-trim**: automatically crops canvas to content bounding box
- **Undo**: revert ignore and trim operations
- **Export**: preview export with axis labels, color codes, and legend; clean PNG download without text or lines
- **Frosted glass UI**: premium glass-morphism interface

## Tech Stack

React 19 · TypeScript · Vite · Lucide React

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
```

## Palette

MARD standard palette, 221 colors across series A through M.
