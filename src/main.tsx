import React from "react";
import { createRoot } from "react-dom/client";
import { Download, Grid3X3, ImageUp, SlidersHorizontal } from "lucide-react";
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

const SAMPLE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 360'%3E%3Cdefs%3E%3CradialGradient id='g' cx='48%25' cy='42%25' r='58%25'%3E%3Cstop offset='0' stop-color='%23fff2c4'/%3E%3Cstop offset='0.54' stop-color='%23f3a84f'/%3E%3Cstop offset='1' stop-color='%23545a9e'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='480' height='360' fill='%23eef2f5'/%3E%3Ccircle cx='240' cy='168' r='122' fill='url(%23g)'/%3E%3Ccircle cx='194' cy='138' r='18' fill='%23212b35'/%3E%3Ccircle cx='286' cy='138' r='18' fill='%23212b35'/%3E%3Cpath d='M194 210c30 34 76 34 106 0' fill='none' stroke='%23212b35' stroke-width='16' stroke-linecap='round'/%3E%3Cpath d='M147 94l-48-58 82 22zM333 94l48-58-82 22z' fill='%23f3a84f' stroke='%23212b35' stroke-width='8' stroke-linejoin='round'/%3E%3C/svg%3E";

function clamp(value: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

function normalizeGridSize(value: number) {
  return Math.max(20, Math.min(150, Math.round(value / 5) * 5));
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

function kMeans(pixels: Rgb[], k: number): Rgb[] {
  if (k >= pixels.length) return pixels.map((p) => ({ ...p }));

  // k-means++ initialization
  const centroids: Rgb[] = [pixels[Math.floor(Math.random() * pixels.length)]];
  const dists = new Float64Array(pixels.length);
  for (let i = 1; i < k; i++) {
    let total = 0;
    for (let j = 0; j < pixels.length; j++) {
      const d = colorDistance(pixels[j], centroids[i - 1]);
      dists[j] = Math.min(dists[j] || d, d);
      total += dists[j];
    }
    let r = Math.random() * total;
    let idx = 0;
    while (r > dists[idx]) { r -= dists[idx]; idx++; }
    centroids.push({ ...pixels[idx] });
    dists.fill(0);
  }

  const assignments = new Uint16Array(pixels.length);
  for (let iter = 0; iter < 20; iter++) {
    let moved = false;
    for (let i = 0; i < pixels.length; i++) {
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let j = 0; j < k; j++) {
        const d = colorDistance(pixels[i], centroids[j]);
        if (d < bestDist) { bestDist = d; best = j; }
      }
      if (assignments[i] !== best) { assignments[i] = best; moved = true; }
    }
    if (!moved) break;

    const counts = new Uint32Array(k);
    const sums = new Float64Array(k * 3);
    for (let i = 0; i < pixels.length; i++) {
      const c = assignments[i];
      counts[c]++;
      sums[c * 3] += pixels[i].r;
      sums[c * 3 + 1] += pixels[i].g;
      sums[c * 3 + 2] += pixels[i].b;
    }
    for (let j = 0; j < k; j++) {
      if (counts[j] > 0) {
        centroids[j] = {
          r: Math.round(sums[j * 3] / counts[j]),
          g: Math.round(sums[j * 3 + 1] / counts[j]),
          b: Math.round(sums[j * 3 + 2] / counts[j]),
        };
      }
    }
  }

  return centroids;
}

function drawImageToGrid(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, fitMode: "contain" | "cover") {
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
  method: "kmeans" | "pixel",
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas not available");

  // 像素图模式用最近邻插值，保留硬边缘，避免模糊混色
  ctx.imageSmoothingEnabled = method !== "pixel";
  drawImageToGrid(ctx, image, width, height, "contain");

  const imageData = ctx.getImageData(0, 0, width, height);
  const sourcePixels: Rgb[] = [];
  for (let i = 0; i < imageData.data.length; i += 4) {
    sourcePixels.push({
      r: imageData.data[i],
      g: imageData.data[i + 1],
      b: imageData.data[i + 2],
    });
  }

  let usablePalette: Array<(typeof MARD_COLORS)[number]>;

  if (method === "pixel") {
    // 步骤 1：提取原图唯一色并各自映射到最近 MARD 色
    // 同色一定映射同色，消除因插值产生的中间色干扰
    const uniqueToMard = new Map<string, (typeof MARD_COLORS)[number]>();
    for (const pixel of sourcePixels) {
      const key = `${pixel.r},${pixel.g},${pixel.b}`;
      if (!uniqueToMard.has(key)) {
        uniqueToMard.set(key, nearestColor(pixel, MARD_COLORS));
      }
    }
    // 步骤 2：统计每个 MARD 色的实际用量，取前 colorCount 名
    const mardCounts = new Map<string, number>();
    for (const pixel of sourcePixels) {
      const key = `${pixel.r},${pixel.g},${pixel.b}`;
      const mard = uniqueToMard.get(key)!;
      mardCounts.set(mard.code, (mardCounts.get(mard.code) ?? 0) + 1);
    }
    const topCodes = new Set(
      Array.from(mardCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, colorCount)
        .map(([code]) => code),
    );
    usablePalette = MARD_COLORS.filter((item) => topCodes.has(item.code));

    // 步骤 3：用缓存做一对一映射（同源色 → 同 MARD 色，无抖动）
    const colorCache = new Map<string, (typeof MARD_COLORS)[number]>();
    const quantized = sourcePixels.map((pixel) => {
      const key = `${pixel.r},${pixel.g},${pixel.b}`;
      if (!colorCache.has(key)) {
        colorCache.set(key, nearestColor(pixel, usablePalette));
      }
      return colorCache.get(key)!;
    });

    const paletteCounts = new Map<string, PaletteItem>();
    quantized.forEach((item) => {
      const current = paletteCounts.get(item.code);
      if (current) { current.count += 1; }
      else { paletteCounts.set(item.code, { label: item.code, hex: item.hex, color: item.color, count: 1 }); }
    });
    return {
      cells: quantized.map((item) => ({ color: item.color, label: item.code, blank: false })),
      palette: Array.from(paletteCounts.values()).sort((a, b) => b.count - a.count),
    };
  } else {
    // kmeans
    const k = Math.min(colorCount, sourcePixels.length);
    const centroids = kMeans(sourcePixels, k);
    const selectedCodes = new Set<string>();
    centroids.forEach((c) => {
      const mardColor = nearestColor(c, MARD_COLORS);
      selectedCodes.add(mardColor.code);
    });
    usablePalette = MARD_COLORS.filter((item) => selectedCodes.has(item.code));
  }

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

/**
 * 找出背景/边缘散点：面积 ≤ maxSize 且周长中空白占比 ≥ blankRatioThreshold 的连通区域。
 *
 * 判断逻辑：收集同色连通区域后，统计其「周长格」（不属于本区域的四邻格）中
 * 空白格（blank）vs 其他颜色格的比例。
 * - 空白占比高 → 区域漂浮在背景中 → 删除
 * - 空白占比低（四周都是其他颜色）→ 可能是主体细节 → 保留
 */
function findBackgroundSpeckles(
  cells: Cell[],
  width: number,
  maxSize: number,
  blankRatioThreshold = 0.60,
) {
  const visited = new Set<number>();
  const toRemove: number[] = [];
  const height = Math.ceil(cells.length / width);

  for (let i = 0; i < cells.length; i++) {
    if (visited.has(i) || cells[i].blank) continue;

    // 第一步：收集连通区域
    const region: number[] = [];
    const regionSet = new Set<number>();
    const stack = [i];

    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (visited.has(idx)) continue;
      visited.add(idx);
      const cell = cells[idx];
      if (!cell || cell.blank || cell.label !== cells[i].label) continue;

      region.push(idx);
      regionSet.add(idx);
      const x = idx % width;
      const y = Math.floor(idx / width);
      if (x > 0) stack.push(idx - 1);
      if (x < width - 1) stack.push(idx + 1);
      if (y > 0) stack.push(idx - width);
      if (y < height - 1) stack.push(idx + width);
    }

    if (region.length > maxSize) continue;

    // 第二步：统计周长格中空白 vs 其他颜色的比例
    let blankPerimeter = 0;
    let colorPerimeter = 0;

    for (const idx of region) {
      const x = idx % width;
      const y = Math.floor(idx / width);
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y < height - 1 ? idx + width : -1,
      ];
      for (const n of neighbors) {
        if (n === -1) { blankPerimeter++; continue; } // 画布边缘算空白
        if (regionSet.has(n)) continue;               // 区域内部不计
        cells[n].blank ? blankPerimeter++ : colorPerimeter++;
      }
    }

    const totalPerimeter = blankPerimeter + colorPerimeter;
    const blankRatio = totalPerimeter === 0 ? 1 : blankPerimeter / totalPerimeter;

    if (blankRatio >= blankRatioThreshold) {
      toRemove.push(...region);
    }
  }

  return toRemove;
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
  maxPreviewSize = 720,
  forExport = false,
) {
  const cellSize = forExport
    ? 102
    : Math.max(9, Math.floor(maxPreviewSize / width));
  const legendScale = forExport ? 4 : 1;
  const axisSize = cellSize;
  const gridLeft = axisSize;
  const gridTop = axisSize;
  const gridWidth = width * cellSize;
  const gridHeight = height * cellSize;
  const legendRowHeight = legendScale * (forExport ? 96 : 66);
  const legendTop = gridTop + gridHeight + legendScale * (forExport ? 56 : 12);
  const legendWidth = forExport ? gridLeft + gridWidth : Math.max(gridLeft + gridWidth, 520);
  const legendItemWidth = legendScale * (forExport ? 86 : 54);
  const legendColumns = Math.max(1, Math.floor((legendWidth - gridLeft) / legendItemWidth));
  const legendHeight = Math.ceil(palette.length / legendColumns) * legendRowHeight + legendScale * 26;
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

  if (forExport) {
    const totalBeads = palette.reduce((sum, item) => sum + item.count, 0);
    const summary = `${width} × ${height} 格  ·  ${palette.length} 色  ·  ${totalBeads} 颗`;
    const summaryY = gridTop + gridHeight + legendScale * 30;
    ctx.fillStyle = "#5d6976";
    ctx.font = `${legendScale * 18}px Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(summary, gridLeft, summaryY);
  }

  palette.forEach((item, index) => {
    const column = index % legendColumns;
    const row = Math.floor(index / legendColumns);
    const x = gridLeft + column * legendItemWidth;
    const y = legendTop + row * legendRowHeight;
    const swatchWidth = legendScale * (forExport ? 70 : 46);
    const swatchHeight = legendScale * (forExport ? 46 : 32);
    const radius = legendScale * (forExport ? 10 : 6);

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
    ctx.font = `${legendScale * (forExport ? 24 : 15)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.label, x + swatchWidth / 2, y + swatchHeight / 2 + 0.5);

    ctx.fillStyle = "#111827";
    ctx.font = `${legendScale * (forExport ? 20 : 13)}px Arial`;
    ctx.fillText(String(item.count), x + swatchWidth / 2, y + swatchHeight + legendScale * (forExport ? 20 : 14));
  });
}

function App() {
  const [imageSrc, setImageSrc] = React.useState(SAMPLE_IMAGE);
  const [gridSize, setGridSize] = React.useState(40);
  const [colorCount, setColorCount] = React.useState(20);
  const [showLabels, setShowLabels] = React.useState(true);
  const [showGrid, setShowGrid] = React.useState(true);
  const [quantizeMethod, setQuantizeMethod] = React.useState<"kmeans" | "pixel">("kmeans");
  const gridWidth = gridSize;
  const gridHeight = gridSize;
  const [displayWidth, setDisplayWidth] = React.useState<number | null>(null);
  const [displayHeight, setDisplayHeight] = React.useState<number | null>(null);
  const effWidth = displayWidth ?? gridWidth;
  const effHeight = displayHeight ?? gridHeight;
  const [pickIgnoreMode, setPickIgnoreMode] = React.useState(false);
  const [history, setHistory] = React.useState<Array<{ baseCells: Cell[]; ignoredIndices: Set<number>; displayWidth: number | null; displayHeight: number | null }>>([]);

  const pushHistory = () => {
    setHistory((prev) => [...prev.slice(-29), { baseCells, ignoredIndices: new Set(ignoredIndices), displayWidth, displayHeight }]);
  };

  const onUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setBaseCells(last.baseCells);
    setIgnoredIndices(last.ignoredIndices);
    setDisplayWidth(last.displayWidth);
    setDisplayHeight(last.displayHeight);
  };
  const [baseCells, setBaseCells] = React.useState<Cell[]>([]);
  const [ignoredIndices, setIgnoredIndices] = React.useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = React.useState(false);
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

  // 一键清理散点：移除所有面积 ≤ maxSize 的同色小区域
  const onCleanupSpeckles = () => {
    if (cells.length === 0) return;
    const toRemove = findBackgroundSpeckles(cells, effWidth, 20);
    if (toRemove.length === 0) return;
    pushHistory();
    setIgnoredIndices((current) => {
      const next = new Set(current);
      toRemove.forEach((idx) => next.add(idx));
      return next;
    });
  };

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
          gridWidth,
          gridHeight,
          colorCount,
          false,
          quantizeMethod,
        );
        setBaseCells(result.cells);
        setIgnoredIndices(new Set());
        setPickIgnoreMode(false);
        setDisplayWidth(null);
        setDisplayHeight(null);
        setIsProcessing(false);
      }, 20);
    };
    image.src = imageSrc;
    return () => {
      cancelled = true;
    };
  }, [imageSrc, gridWidth, gridHeight, colorCount, quantizeMethod]);

  const previewCellSize = React.useMemo(() => {
    const availWidth = window.innerWidth - 660;
    const availHeight = window.innerHeight - 340;
    const cellByW = Math.max(9, Math.floor(availWidth / (effWidth + 1)));
    const cellByH = Math.max(9, Math.floor(availHeight / (effHeight + 1)));
    return Math.min(cellByW, cellByH);
  }, [effWidth, effHeight]);
  const previewMaxSize = previewCellSize * effWidth;

  React.useEffect(() => {
    if (!canvasRef.current || cells.length === 0) return;
    drawPatternCanvas(canvasRef.current, cells, palette, effWidth, effHeight, showLabels, showGrid, previewMaxSize);
  }, [cells, palette, effWidth, effHeight, showLabels, showGrid, previewMaxSize]);

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
    drawPatternCanvas(canvas, cells, palette, effWidth, effHeight, true, true, 720, true);
    const dataUrl = canvas.toDataURL("image/png");
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

  const downloadPng = () => {
    if (!cells.length) return;

    const cellSize = 102;

    // Clean image: no axis, grid, labels, legend
    const cleanCanvas = document.createElement("canvas");
    cleanCanvas.width = effWidth * cellSize;
    cleanCanvas.height = effHeight * cellSize;
    const cleanCtx = cleanCanvas.getContext("2d");
    if (cleanCtx) {
      cells.forEach((cell, index) => {
        const x = index % effWidth;
        const y = Math.floor(index / effWidth);
        cleanCtx.fillStyle = cell.blank || !cell.color ? "#FFFFFF" : rgbToHex(cell.color);
        cleanCtx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      });
      cleanCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "bead-pattern.png";
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // Full image: with axis, grid, labels, legend
    const fullCanvas = document.createElement("canvas");
    drawPatternCanvas(fullCanvas, cells, palette, effWidth, effHeight, true, true, 720, true);
    fullCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bead-pattern-full.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const onCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pickIgnoreMode || baseCells.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (event.clientX - rect.left) * scaleX;
    const canvasY = (event.clientY - rect.top) * scaleY;
    const cellSize = previewCellSize;
    const axisSize = cellSize;
    const gridX = Math.floor((canvasX - axisSize) / cellSize);
    const gridY = Math.floor((canvasY - axisSize) / cellSize);

    if (gridX < 0 || gridY < 0 || gridX >= effWidth || gridY >= effHeight) return;

    const startIndex = gridY * effWidth + gridX;
    const connected = collectConnectedSameColor(baseCells, effWidth, startIndex);
    if (connected.length === 0) return;

    pushHistory();
    setIgnoredIndices((current) => {
      const next = new Set(current);
      connected.forEach((index) => next.add(index));
      return next;
    });
    setPickIgnoreMode(false);
  };

  const beadCount = palette.reduce((sum, item) => sum + item.count, 0);

  const trimToFit = (effectiveCells: Cell[]) => {
    let minX = effWidth, maxX = 0, minY = effHeight, maxY = 0;
    effectiveCells.forEach((cell, index) => {
      if (cell.blank) return;
      const x = index % effWidth;
      const y = Math.floor(index / effWidth);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    if (maxX < minX) return;
    const padX1 = Math.max(0, minX - 1);
    const padY1 = Math.max(0, minY - 1);
    const padX2 = Math.min(effWidth - 1, maxX + 1);
    const padY2 = Math.min(effHeight - 1, maxY + 1);
    const newWidth = padX2 - padX1 + 1;
    const newHeight = padY2 - padY1 + 1;
    const newCells: Cell[] = [];
    for (let y = padY1; y <= padY2; y++) {
      for (let x = padX1; x <= padX2; x++) {
        newCells.push(effectiveCells[y * effWidth + x]);
      }
    }
    setBaseCells(newCells);
    setIgnoredIndices(new Set());
    setDisplayWidth(newWidth);
    setDisplayHeight(newHeight);
  };

  const onTrimToContent = () => {
    if (cells.length === 0) return;
    pushHistory();
    trimToFit(cells);
  };

  return (
    <main className="app">
      <aside className="panel">
        <div className="brand">
          <Grid3X3 size={24} />
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
            <span>板子格数（较长边）</span>
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
            <input min="4" max="60" type="number" value={colorCount} onChange={(e) => setColorCount(Number(e.target.value))} />
          </label>
          <input min="4" max="60" type="range" value={colorCount} onChange={(e) => setColorCount(Number(e.target.value))} />

          <div
            className="fitControl"
            style={{ cursor: "pointer" }}
            onClick={() => setQuantizeMethod((prev) => (prev === "pixel" ? "kmeans" : "pixel"))}
          >
            <span style={{ userSelect: "none" }}>取色算法</span>
            <div className="segmented two">
              <div
                className="segmented-slider"
                style={{
                  transform: quantizeMethod === "pixel" ? "translateX(calc(100% + 2px))" : "translateX(0)"
                }}
              />
              <span className={`seg-btn ${quantizeMethod === "kmeans" ? "active" : ""}`}>
                照片模式
              </span>
              <span className={`seg-btn ${quantizeMethod === "pixel" ? "active" : ""}`}>
                像素模式
              </span>
            </div>
          </div>

        </section>

        <section className="toggles">
          <div
            className="fitControl"
            style={{ cursor: "pointer" }}
            onClick={() => setShowLabels((prev) => !prev)}
          >
            <span style={{ userSelect: "none" }}>显示颜色编码</span>
            <div className="segmented two">
              <div
                className="segmented-slider"
                style={{
                  transform: showLabels ? "translateX(calc(100% + 2px))" : "translateX(0)"
                }}
              />
              <span className={`seg-btn ${!showLabels ? "active" : ""}`}>
                隐藏
              </span>
              <span className={`seg-btn ${showLabels ? "active" : ""}`}>
                显示
              </span>
            </div>
          </div>

          <div
            className="fitControl"
            style={{ cursor: "pointer" }}
            onClick={() => setShowGrid((prev) => !prev)}
          >
            <span style={{ userSelect: "none" }}>显示网格线</span>
            <div className="segmented two">
              <div
                className="segmented-slider"
                style={{
                  transform: showGrid ? "translateX(calc(100% + 2px))" : "translateX(0)"
                }}
              />
              <span className={`seg-btn ${!showGrid ? "active" : ""}`}>
                隐藏
              </span>
              <span className={`seg-btn ${showGrid ? "active" : ""}`}>
                显示
              </span>
            </div>
          </div>
        </section>

        <div className="actions">
          <button type="button" onClick={exportPng}>
            预览导出
          </button>
          <button type="button" onClick={downloadPng}>
            <Download size={18} />
            下载 PNG
          </button>
        </div>
      </aside>

      <section className="workspace">
        <div className="previewHeader">
          <div>
            <h2>图纸预览</h2>
            <p>
              {effWidth} x {effHeight}，MARD {palette.length} 色，{beadCount} 颗
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
              <div className="ignoreActions ignore-gap-tight">
                <button
                  type="button"
                  className={pickIgnoreMode ? "active" : ""}
                  onClick={() => setPickIgnoreMode((value) => !value)}
                >
                  {pickIgnoreMode ? "点击图纸取色" : "取色忽略"}
                </button>
              </div>
              <div className="ignoreStack ignore-gap-tight">
                <button
                  type="button"
                  className="secondary"
                  onClick={onCleanupSpeckles}
                  disabled={cells.length === 0}
                >
                  清理散点
                </button>
              </div>
              <div className="ignoreStack ignore-gap-double">
                <button
                  type="button"
                  className="secondary danger"
                  onClick={() => { pushHistory(); setIgnoredIndices(new Set()); }}
                >
                  清除忽略
                </button>
              </div>
              <div className="ignoreStack ignore-gap-double">
                <button
                  type="button"
                  className="secondary"
                  onClick={onTrimToContent}
                  disabled={cells.length === 0}
                >
                  贴边
                </button>
              </div>
              <div className="ignoreStack ignore-gap-single">
                <button
                  type="button"
                  className="secondary"
                  disabled={history.length === 0}
                  onClick={onUndo}
                >
                  撤销
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
