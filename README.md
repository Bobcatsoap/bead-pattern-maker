# 拼豆图纸生成器 · Bead Pattern Maker

上传图片，按 MARD 色卡自动生成拼豆 / 拼拼豆图纸。

Convert any image into a fuse bead (Perler / MARD) pattern with automatic color matching.

---

## 功能 · Features

- **图片导入**：支持任意图片格式，自动适配画布
- **智能取色**：K-means 聚类 / 用量优先 两种算法，自动从 221 色 MARD 色卡中选取最佳配色（4–60 色可选）
- **取色忽略**：点击图纸上的色块，擦除整片连通区域；配合「去除游离色块」一键清理残余散点
- **自动贴边**：裁剪画布至图案有效区域，去除多余白边
- **撤销**：支持忽略与贴边操作的回退
- **图纸导出**：含坐标轴、色号、图例的预览导出；纯色块无文字的无损下载
- **毛玻璃 UI**：磨砂玻璃质感界面

---

- **Image import**: supports any image format, auto-fits to canvas
- **Smart color quantization**: K-means clustering or usage-priority algorithms, picks optimal palette from 221 MARD colors (4–60 selectable)
- **Color ignore**: click any color region on the canvas to erase connected same-color areas; optional stray-pixel cleanup
- **Auto-trim**: automatically crops canvas to content bounding box
- **Undo**: revert ignore and trim operations
- **Export**: preview export with axis labels, color codes, and legend; clean PNG download without text or lines
- **Frosted glass UI**: premium glass-morphism interface

---

## 技术栈 · Tech Stack

React 19 · TypeScript · Vite · Lucide React

---

## 开发 · Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
```

---

## 色卡 · Palette

MARD 标准色卡，共 221 色，涵盖 A–M 系列。

MARD standard palette, 221 colors across series A through M.
