import React from "react";
import { createRoot } from "react-dom/client";
import { Download, ExternalLink, Grid3X3, ImageUp, SlidersHorizontal } from "lucide-react";
import { MARD_PALETTE } from "./mardPalette";
import "./styles.css";

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type Cell = {
  color: Rgb | null;
  label: string;
  blank?: boolean;
};

type PaletteItem = {
  label: string;
  hex: string;
  color: Rgb;
  count: number;
};

type FitMode = "contain" | "cover";
type PaletteStrategy = "usage" | "representative";

const SAMPLE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 360'%3E%3Cdefs%3E%3CradialGradient id='g' cx='48%25' cy='42%25' r='58%25'%3E%3Cstop offset='0' stop-color='%23fff2c4'/%3E%3Cstop offset='0.54' stop-color='%23f3a84f'/%3E%3Cstop offset='1' stop-color='%23545a9e'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='480' height='360' fill='%23eef2f5'/%3E%3Ccircle cx='240' cy='168' r='122' fill='url(%23g)'/%3E%3Ccircle cx='194' cy='138' r='18' fill='%23212b35'/%3E%3Ccircle cx='286' cy='138' r='18' fill='%23212b35'/%3E%3Cpath d='M194 210c30 34 76 34 106 0' fill='none' stroke='%23212b35' stroke-width='16' stroke-linecap='round'/%3E%3Cpath d='M147 94l-48-58 82 22zM333 94l48-58-82 22z' fill='%23f3a84f' stroke='%23212b35' stroke-width='8' stroke-linejoin='round'/%3E%3C/svg%3E";

function clamp(value: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

function normalizeGridSize(value: number) {
  return Math.max(20, Math.min(150, Math.round(value / 5) * 5));
}

function normalizeExportResolution(value: number) {
  return Math.max(1, Math.min(4, Math.round(value)));
}

function rgbToHex(color: Rgb) {
  return `#${[color.r, color.g, color.b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

const MARD_COLORS = MARD_PALETTE.map((item) => ({
  ...item,
  color: hexToRgb(item.hex),
}));

function colorDistance(a: Rgb, b: Rgb) {
  const rMean = (a.r + b.r) / 2;
  const r = a.r - b.r;
  const g = a.g - b.g;
  const blue = a.b - b.b;
  return Math.sqrt((2 + rMean / 256) * r * r + 4 * g * g + (2 + (255 - rMean) / 256) * blue * blue);
}

function nearestColor<T extends { color: Rgb }>(color: Rgb, palette: T[]) {
  let best = palette[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of palette) {
    const distance = colorDistance(color, candidate.color);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

function contrastColor(color: Rgb) {
  const luminance = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255;
  return luminance > 0.62 ? "#111827" : "#FFFFFF";
}

function colorSaturation(color: Rgb) {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  return max === 0 ? 0 : (max - min) / max;
}

function choosePaletteCodes(
  counts: Map<string, number>,
  colorCount: number,
  strategy: PaletteStrategy,
) {
  const candidates = MARD_COLORS
    .map((item) => ({
      ...item,
      count: counts.get(item.code) ?? 0,
      saturation: colorSaturation(item.color),
    }))
    .filter((item) => item.count > 0);

  if (strategy === "usage") {
    return candidates
      .sort((a, b) => b.count - a.count)
      .slice(0, colorCount)
      .map((item) => item.code);
  }

  const totalPixels = candidates.reduce((sum, item) => sum + item.count, 0);
  const grayLimit = Math.max(2, Math.ceil(colorCount * 0.45));
  const grayItems = candidates
    .filter((item) => item.saturation < 0.14)
    .sort((a, b) => b.count - a.count)
    .slice(0, grayLimit);
  const colorItems = candidates
    .filter((item) => item.saturation >= 0.14)
    .sort((a, b) => {
      const scoreA = a.count * (1 + a.saturation * 3) + totalPixels * a.saturation * 0.012;
      const scoreB = b.count * (1 + b.saturation * 3) + totalPixels * b.saturation * 0.012;
      return scoreB - scoreA;
    });
  const selected = new Set<string>();

  grayItems.forEach((item) => selected.add(item.code));
  for (const item of colorItems) {
    if (selected.size >= colorCount) break;
    selected.add(item.code);
  }
  for (const item of candidates.sort((a, b) => b.count - a.count)) {
    if (selected.size >= colorCount) break;
    selected.add(item.code);
  }

  return Array.from(selected);
}

function drawImageToGrid(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, fitMode: FitMode) {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  const scale = fitMode === "cover"
    ? Math.max(width / image.naturalWidth, height / image.naturalHeight)
    : Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function makePattern(
  image: HTMLImageElement,
  width: number,
  height: number,
  colorCount: number,
  useDither: boolean,
  fitMode: FitMode,
  paletteStrategy: PaletteStrategy,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas not available");

  ctx.imageSmoothingEnabled = true;
  drawImageToGrid(ctx, image, width, height, fitMode);

  const imageData = ctx.getImageData(0, 0, width, height);
  const sourcePixels: Rgb[] = [];
  for (let i = 0; i < imageData.data.length; i += 4) {
    sourcePixels.push({
      r: imageData.data[i],
      g: imageData.data[i + 1],
      b: imageData.data[i + 2],
    });
  }

  const initialMapped = sourcePixels.map((pixel) => nearestColor(pixel, MARD_COLORS));
  const initialCounts = new Map<string, number>();
  initialMapped.forEach((item) => {
    initialCounts.set(item.code, (initialCounts.get(item.code) ?? 0) + 1);
  });
  const selectedCodes = choosePaletteCodes(initialCounts, colorCount, paletteStrategy);
  const selectedPalette = MARD_COLORS.filter((item) => selectedCodes.includes(item.code));
  const usablePalette = selectedPalette.length > 0 ? selectedPalette : MARD_COLORS;
  const workPixels = sourcePixels.map((pixel) => ({ ...pixel }));
  const quantized: Array<(typeof MARD_COLORS)[number] | null> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const oldColor = workPixels[index];
      const newColor = nearestColor(oldColor, usablePalette);
      quantized[index] = newColor;

      if (useDither) {
        const error = {
          r: oldColor.r - newColor.color.r,
          g: oldColor.g - newColor.color.g,
          b: oldColor.b - newColor.color.b,
        };
        distributeError(workPixels, width, height, x + 1, y, error, 7 / 16);
        distributeError(workPixels, width, height, x - 1, y + 1, error, 3 / 16);
        distributeError(workPixels, width, height, x, y + 1, error, 5 / 16);
        distributeError(workPixels, width, height, x + 1, y + 1, error, 1 / 16);
      }
    }
  }

  const counts = new Map<string, PaletteItem>();
  quantized.forEach((item) => {
    if (!item) return;
    const key = item.code;
    const current = counts.get(key);
    if (current) {
      current.count += 1;
    } else {
      counts.set(key, { label: item.code, hex: item.hex, color: item.color, count: 1 });
    }
  });

  const paletteItems = Array.from(counts.values())
    .sort((a, b) => b.count - a.count);

  const cells = quantized.map((item) => ({
    color: item?.color ?? null,
    label: item?.code ?? "",
    blank: !item,
  }));

  return { cells, palette: paletteItems };
}

function makePaletteFromCells(cells: Cell[]) {
  const counts = new Map<string, PaletteItem>();

  cells.forEach((cell) => {
    if (cell.blank || !cell.color || !cell.label) return;
    const current = counts.get(cell.label);
    if (current) {
      current.count += 1;
      return;
    }
    const mardColor = MARD_COLORS.find((item) => item.code === cell.label);
    counts.set(cell.label, {
      label: cell.label,
      hex: mardColor?.hex ?? rgbToHex(cell.color),
      color: cell.color,
      count: 1,
    });
  });

  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

function applyIgnoredCells(cells: Cell[], ignoredIndices: Set<number>) {
  return cells.map((cell, index) => {
    if (!ignoredIndices.has(index)) return cell;
    return {
      color: null,
      label: "",
      blank: true,
    };
  });
}

function collectConnectedSameColor(cells: Cell[], width: number, startIndex: number) {
  const targetLabel = cells[startIndex]?.label;
  if (!targetLabel || cells[startIndex]?.blank) return [];

  const selected: number[] = [];
  const seen = new Set<number>();
  const stack = [startIndex];
  const height = Math.ceil(cells.length / width);

  while (stack.length > 0) {
    const index = stack.pop()!;
    if (seen.has(index)) continue;
    seen.add(index);
    const cell = cells[index];
    if (!cell || cell.blank || cell.label !== targetLabel) continue;

    selected.push(index);
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) stack.push(index - 1);
    if (x < width - 1) stack.push(index + 1);
    if (y > 0) stack.push(index - width);
    if (y < height - 1) stack.push(index + width);
  }

  return selected;
}

function distributeError(
  pixels: Rgb[],
  width: number,
  height: number,
  x: number,
  y: number,
  error: Rgb,
  factor: number,
) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const index = y * width + x;
  pixels[index] = {
    r: clamp(Math.round(pixels[index].r + error.r * factor)),
    g: clamp(Math.round(pixels[index].g + error.g * factor)),
    b: clamp(Math.round(pixels[index].b + error.b * factor)),
  };
}

function drawPatternCanvas(
  canvas: HTMLCanvasElement,
  cells: Cell[],
  palette: PaletteItem[],
  width: number,
  height: number,
  showLabels: boolean,
  showGrid: boolean,
  forExport = false,
  exportResolution = 2,
) {
  const exportTargetSize = normalizeExportResolution(exportResolution) * 1024;
  const cellSize = forExport ? Math.max(8, Math.floor(exportTargetSize / width)) : Math.max(9, Math.floor(720 / width));
  const axisSize = cellSize;
  const gridLeft = axisSize;
  const gridTop = axisSize;
  const gridWidth = width * cellSize;
  const gridHeight = height * cellSize;
  const legendRowHeight = forExport ? 72 : 62;
  const legendTop = gridTop + gridHeight + (forExport ? 22 : 12);
  const legendWidth = forExport ? gridLeft + gridWidth : Math.max(gridLeft + gridWidth, 520);
  const legendItemWidth = forExport ? 86 : 54;
  const legendColumns = Math.max(1, Math.floor((legendWidth - gridLeft) / legendItemWidth));
  const legendHeight = Math.ceil(palette.length / legendColumns) * legendRowHeight + 26;
  canvas.width = Math.max(gridLeft + gridWidth, legendWidth);
  canvas.height = legendTop + legendHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#D8E1EA";
  ctx.fillRect(0, 0, gridLeft, gridTop);
  ctx.fillStyle = "#111827";
  ctx.font = `${Math.max(11, Math.floor(cellSize * 0.44))}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let x = 0; x < width; x += 1) {
    ctx.fillStyle = x % 2 === 0 ? "#EEF3F8" : "#D8E1EA";
    ctx.fillRect(gridLeft + x * cellSize, 0, cellSize, gridTop);
    ctx.strokeStyle = "rgba(17, 24, 39, 0.14)";
    ctx.lineWidth = 1;
    ctx.strokeRect(gridLeft + x * cellSize + 0.5, 0.5, cellSize, gridTop);
    ctx.fillStyle = "#111827";
    const label = String(x + 1);
    ctx.fillText(label, gridLeft + x * cellSize + cellSize / 2, gridTop / 2);
  }

  for (let y = 0; y < height; y += 1) {
    ctx.fillStyle = y % 2 === 0 ? "#EEF3F8" : "#D8E1EA";
    ctx.fillRect(0, gridTop + y * cellSize, gridLeft, cellSize);
    ctx.strokeStyle = "rgba(17, 24, 39, 0.14)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, gridTop + y * cellSize + 0.5, gridLeft, cellSize);
    ctx.fillStyle = "#111827";
    const label = String(y + 1);
    ctx.fillText(label, gridLeft / 2, gridTop + y * cellSize + cellSize / 2);
  }

  ctx.strokeStyle = "rgba(17, 24, 39, 0.36)";
  ctx.lineWidth = 1;
  ctx.strokeRect(gridLeft + 0.5, gridTop + 0.5, gridWidth, gridHeight);

  cells.forEach((cell, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const cellX = gridLeft + x * cellSize;
    const cellY = gridTop + y * cellSize;
    ctx.fillStyle = cell.blank || !cell.color ? "#FFFFFF" : rgbToHex(cell.color);
    ctx.fillRect(cellX, cellY, cellSize, cellSize);

    if (showGrid) {
      ctx.strokeStyle = "rgba(17, 24, 39, 0.28)";
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX + 0.5, cellY + 0.5, cellSize, cellSize);
    }

    if (!cell.blank && cell.color && showLabels && cellSize >= 8) {
      ctx.fillStyle = contrastColor(cell.color);
      const labelScale = cell.label.length >= 3 ? 0.38 : 0.5;
      ctx.font = `${Math.max(7, Math.floor(cellSize * labelScale))}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cell.label, cellX + cellSize / 2, cellY + cellSize / 2 + 0.5);
    }
  });

  if (showGrid) {
    ctx.strokeStyle = "rgba(17, 24, 39, 0.72)";
    ctx.lineWidth = forExport ? 3 : 2;

    for (let x = 5; x < width; x += 5) {
      const lineX = gridLeft + x * cellSize;
      ctx.beginPath();
      ctx.moveTo(lineX + 0.5, gridTop);
      ctx.lineTo(lineX + 0.5, gridTop + gridHeight);
      ctx.stroke();
    }

    for (let y = 5; y < height; y += 5) {
      const lineY = gridTop + y * cellSize;
      ctx.beginPath();
      ctx.moveTo(gridLeft, lineY + 0.5);
      ctx.lineTo(gridLeft + gridWidth, lineY + 0.5);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = forExport ? 5 : 3;
  ctx.strokeRect(gridLeft + 0.5, gridTop + 0.5, gridWidth, gridHeight);

  palette.forEach((item, index) => {
    const column = index % legendColumns;
    const row = Math.floor(index / legendColumns);
    const x = gridLeft + column * legendItemWidth;
    const y = legendTop + row * legendRowHeight;
    const swatchWidth = forExport ? 70 : 46;
    const swatchHeight = forExport ? 46 : 32;
    const radius = forExport ? 10 : 6;

    ctx.fillStyle = rgbToHex(item.color);
    ctx.beginPath();
    ctx.roundRect(x, y, swatchWidth, swatchHeight, radius);
    ctx.fill();
    ctx.strokeStyle = "rgba(17, 24, 39, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, swatchWidth, swatchHeight, radius);
    ctx.stroke();

    ctx.fillStyle = contrastColor(item.color);
    ctx.font = `${forExport ? 24 : 15}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.label, x + swatchWidth / 2, y + swatchHeight / 2 + 0.5);

    ctx.fillStyle = "#111827";
    ctx.font = `${forExport ? 20 : 13}px Arial`;
    ctx.fillText(String(item.count), x + swatchWidth / 2, y + swatchHeight + (forExport ? 20 : 14));
  });
}

function App() {
  const [imageSrc, setImageSrc] = React.useState(SAMPLE_IMAGE);
  const [gridSize, setGridSize] = React.useState(40);
  const [colorCount, setColorCount] = React.useState(20);
  const [exportResolution, setExportResolution] = React.useState(2);
  const [fitMode, setFitMode] = React.useState<FitMode>("contain");
  const [paletteStrategy, setPaletteStrategy] = React.useState<PaletteStrategy>("usage");
  const [showLabels, setShowLabels] = React.useState(true);
  const [showGrid, setShowGrid] = React.useState(true);
  const [useDither, setUseDither] = React.useState(false);
  const [pickIgnoreMode, setPickIgnoreMode] = React.useState(false);
  const [baseCells, setBaseCells] = React.useState<Cell[]>([]);
  const [ignoredIndices, setIgnoredIndices] = React.useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [exportImageSrc, setExportImageSrc] = React.useState("");
  const [exportPreviewUrl, setExportPreviewUrl] = React.useState("");
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const cells = React.useMemo(() => applyIgnoredCells(baseCells, ignoredIndices), [baseCells, ignoredIndices]);
  const palette = React.useMemo(() => makePaletteFromCells(cells), [cells]);
  const ignoredSummary = React.useMemo(() => {
    const counts = new Map<string, { color: Rgb; count: number }>();

    ignoredIndices.forEach((index) => {
      const cell = baseCells[index];
      if (!cell || !cell.color || !cell.label) return;
      const current = counts.get(cell.label);
      if (current) {
        current.count += 1;
      } else {
        counts.set(cell.label, { color: cell.color, count: 1 });
      }
    });

    return Array.from(counts.entries())
      .map(([label, item]) => ({ label, ...item }))
      .sort((a, b) => b.count - a.count);
  }, [baseCells, ignoredIndices]);

  React.useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      setIsProcessing(true);
      window.setTimeout(() => {
        if (cancelled) return;
        const result = makePattern(
          image,
          gridSize,
          gridSize,
          colorCount,
          useDither,
          fitMode,
          paletteStrategy,
        );
        setBaseCells(result.cells);
        setIgnoredIndices(new Set());
        setPickIgnoreMode(false);
        setIsProcessing(false);
      }, 20);
    };
    image.src = imageSrc;
    return () => {
      cancelled = true;
    };
  }, [imageSrc, gridSize, colorCount, useDither, fitMode, paletteStrategy]);

  React.useEffect(() => {
    if (!canvasRef.current || cells.length === 0) return;
    drawPatternCanvas(canvasRef.current, cells, palette, gridSize, gridSize, showLabels, showGrid);
  }, [cells, palette, gridSize, showLabels, showGrid]);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageSrc(String(reader.result));
    reader.readAsDataURL(file);
  };

  const exportPng = () => {
    if (!cells.length) return;
    const canvas = document.createElement("canvas");
    drawPatternCanvas(canvas, cells, palette, gridSize, gridSize, true, true, true, exportResolution);
    const dataUrl = canvas.toDataURL("image/png");
    setExportImageSrc(dataUrl);
    const previewHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>拼豆图纸 PNG 预览</title>
    <style>
      body {
        margin: 0;
        padding: 24px;
        color: #172033;
        font-family: "Microsoft YaHei", system-ui, sans-serif;
        background: #eef1f4;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 20px;
      }
      p {
        margin: 0 0 18px;
        color: #5d6976;
        font-size: 14px;
      }
      img {
        display: block;
        max-width: 100%;
        height: auto;
        background: #ffffff;
        border: 1px solid #cbd5df;
      }
    </style>
  </head>
  <body>
    <h1>拼豆图纸 PNG 预览</h1>
    <p>右键图片，选择保存图片。</p>
    <img src="${dataUrl}" alt="拼豆图纸" />
  </body>
</html>`;
    const previewUrl = URL.createObjectURL(new Blob([previewHtml], { type: "text/html" }));
    if (exportPreviewUrl) {
      URL.revokeObjectURL(exportPreviewUrl);
    }
    setExportPreviewUrl(previewUrl);
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  const onCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pickIgnoreMode || baseCells.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;
    const cellSize = Math.max(9, Math.floor(720 / gridSize));
    const axisSize = cellSize;
    const gridX = Math.floor((canvasX - axisSize) / cellSize);
    const gridY = Math.floor((canvasY - axisSize) / cellSize);

    if (gridX < 0 || gridY < 0 || gridX >= gridSize || gridY >= gridSize) return;

    const startIndex = gridY * gridSize + gridX;
    const connected = collectConnectedSameColor(baseCells, gridSize, startIndex);
    if (connected.length === 0) return;

    setIgnoredIndices((current) => {
      const next = new Set(current);
      connected.forEach((index) => next.add(index));
      return next;
    });
    setPickIgnoreMode(false);
  };

  const beadCount = palette.reduce((sum, item) => sum + item.count, 0);

  return (
    <main className="app">
      <aside className="panel">
        <div className="brand">
          <Grid3X3 size={28} />
          <div>
            <h1>拼豆图纸生成器</h1>
            <p>上传图片，按 MARD 色卡生成图纸</p>
          </div>
        </div>

        <label className="upload">
          <ImageUp size={20} />
          <span>选择图片</span>
          <input accept="image/*" type="file" onChange={onFileChange} />
        </label>

        <section className="controlGroup">
          <div className="groupTitle">
            <SlidersHorizontal size={18} />
            <span>图纸设置</span>
          </div>

          <label>
            <span>正方形板子格数</span>
            <input
              min="20"
              max="150"
              step="5"
              type="number"
              value={gridSize}
              onChange={(e) => setGridSize(normalizeGridSize(Number(e.target.value)))}
            />
          </label>
          <input
            min="20"
            max="150"
            step="5"
            type="range"
            value={gridSize}
            onChange={(e) => setGridSize(normalizeGridSize(Number(e.target.value)))}
          />

          <label>
            <span>最大 MARD 色数</span>
            <input min="4" max="48" type="number" value={colorCount} onChange={(e) => setColorCount(Number(e.target.value))} />
          </label>
          <input min="4" max="48" type="range" value={colorCount} onChange={(e) => setColorCount(Number(e.target.value))} />

          <div className="fitControl">
            <span>图片适配</span>
            <div className="segmented two">
              <button
                type="button"
                className={fitMode === "contain" ? "active" : ""}
                onClick={() => setFitMode("contain")}
              >
                完整显示
              </button>
              <button
                type="button"
                className={fitMode === "cover" ? "active" : ""}
                onClick={() => setFitMode("cover")}
              >
                裁剪填满
              </button>
            </div>
          </div>

          <div className="fitControl">
            <span>导出分辨率</span>
            <div className="segmented four">
              {[1, 2, 3, 4].map((value) => (
                <button
                  type="button"
                  className={exportResolution === value ? "active" : ""}
                  key={value}
                  onClick={() => setExportResolution(value)}
                >
                  {value}K
                </button>
              ))}
            </div>
          </div>

          <div className="fitControl">
            <span>保色策略</span>
            <div className="segmented two">
              <button
                type="button"
                className={paletteStrategy === "usage" ? "active" : ""}
                onClick={() => setPaletteStrategy("usage")}
              >
                用量优先
              </button>
              <button
                type="button"
                className={paletteStrategy === "representative" ? "active" : ""}
                onClick={() => setPaletteStrategy("representative")}
              >
                代表性优先
              </button>
            </div>
          </div>
        </section>

        <section className="toggles">
          <label>
            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
            <span>显示颜色编码</span>
          </label>
          <label>
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
            <span>显示网格线</span>
          </label>
          <label>
            <input type="checkbox" checked={useDither} onChange={(e) => setUseDither(e.target.checked)} />
            <span>启用抖动细节</span>
          </label>
        </section>

        <div className="actions">
          <button type="button" onClick={exportPng}>
            <Download size={18} />
            导出 PNG
          </button>
        </div>
      </aside>

      <section className="workspace">
        <div className="previewHeader">
          <div>
            <h2>图纸预览</h2>
            <p>
              {gridSize} x {gridSize}，MARD {palette.length} 色，{beadCount} 颗
            </p>
          </div>
          {isProcessing && <span className="status">处理中</span>}
        </div>

        <div className="previewGrid">
          <div className="sourceColumn">
            <div className="sourcePreview">
              <img src={imageSrc} alt="原图预览" />
            </div>
            <section className="ignorePanel">
              <div className="ignoreActions">
                <button
                  type="button"
                  className={pickIgnoreMode ? "active" : ""}
                  onClick={() => setPickIgnoreMode((value) => !value)}
                >
                  {pickIgnoreMode ? "点击图纸取色" : "取色忽略"}
                </button>
                <button type="button" onClick={() => setIgnoredIndices(new Set())}>
                  清除忽略
                </button>
              </div>
              {ignoredSummary.length > 0 && (
                <div className="ignoredList">
                  {ignoredSummary.map((item) => (
                    <span className="ignoredChip" key={item.label}>
                      <i style={{ backgroundColor: rgbToHex(item.color) }} />
                      {item.label}
                      <strong>{item.count}</strong>
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>
          <div className="canvasWrap">
            <canvas className={pickIgnoreMode ? "pickMode" : ""} ref={canvasRef} onClick={onCanvasClick} />
          </div>
        </div>

        {exportImageSrc && exportPreviewUrl && (
          <div className="exportResult">
            <div>
              <strong>PNG 已生成</strong>
              <span>已打开预览页，可以在图片上右键保存。</span>
            </div>
            <a href={exportPreviewUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={17} />
              打开预览页
            </a>
          </div>
        )}
      </section>
    </main>
  );
}

const rootElement = document.getElementById("root")! as HTMLElement & {
  _beadPatternRoot?: ReturnType<typeof createRoot>;
};
const root = rootElement._beadPatternRoot ?? createRoot(rootElement);
rootElement._beadPatternRoot = root;

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
