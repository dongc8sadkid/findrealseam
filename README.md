# findrealseam 白线别再来了！
Adobe Photoshop JSX script to detect white seam artifacts in rasterized .tiffs for large format print
一个 Photoshop ExtendScript 脚本，用于自动检测并选中 Adobe Illustrator 导出大尺寸 TIFF 时遗留的 1 像素白色缝隙线——然后你只需要一次 Content-Aware 填充就能全部补完。


## The Problem 问题背景
When exporting high-resolution TIFFs from Adobe Illustrator (especially large-format files at 200–720 dpi), the rasterizer occasionally leaves behind 1-pixel-wide white lines that span the entire width or height of the image. They appear at unpredictable positions, and there can be any number of them. This is a long-standing Illustrator bug caused by the rasterizer splitting the canvas into rendering bands; at the seam between bands, sub-pixel coverage math rounds incorrectly and the white canvas bleeds through.

These lines are nearly invisible at 100% zoom but will absolutely show up in print.

用 Adobe Illustrator 导出高分辨率 TIFF（尤其是大幅面、200–720 dpi 的文件）时，栅格化引擎偶尔会在图像上留下若干条贯穿整个宽度或高度的 1 像素白线。它们出现的位置飘忽不定，数量也不一定，可能一条也可能好几条。

根本原因是一个长期存在的 Illustrator bug：导出时引擎把画布切成若干渲染条带分批处理，条带交界处的子像素覆盖率计算出现舍入误差，白色画板从缝隙里透上来，就成了这条线。

这些线在 100% 视图下几乎看不出来，但印刷出来必然显形。




## What This Script Does 脚本做了什么
1. Makes a **throwaway copy** of your document — your original is never touched.
2. Binarizes the copy at a configurable white threshold (pixels ≥ that value become white, everything else black).
3. Collapses each row/column down to a single pixel to get a **white-coverage profile** across the image.
4. Flags any row or column that is nearly 100% white *while both its neighbors are not* — the classic signature of an isolated rasterizer seam.
5. Builds **one combined selection** of every seam found on your original document.
6. You patch them all at once with a single `Shift+F5 → Content-Aware → OK`.

The key insight over a simple brightness-threshold approach: seams are isolated full-span white lines. Client artwork highlights, even bright ones, are typically gradients, locally bounded, or below paper-white — they don't pass the "full-width + pure-white + isolated" test.

1. **复制一份临时副本**——你的原图全程不被碰。
2. 按设定的白度阈值对副本做二值化（亮度 ≥ 阈值的像素变白，其余变黑）。
3. 把副本在宽度或高度方向上压缩到 1 像素，得到每一行/每一列的**白色占比曲线**。
4. 找出哪些行/列"几乎全白，且两侧都不是这么白"——这正是孤立渲染缝的特征。
5. 把所有检出的缝合并成**一个选区**，挂在你的原图上。
6. 你按 `Shift+F5 → 内容识别 → 确定`，一次补完所有缝。

**和"比邻居更亮"方案的区别：** 客户图里的高光通常是渐变、局部分布、或者亮度达不到纸白——无法同时满足"贯穿全幅 + 纯白 + 两侧隔离"这三条，不会被误选。



## Requirements 系统要求
- Adobe Photoshop (CS6 or later; tested through CC 2024)
- ExtendScript support (included in all desktop Photoshop versions)
- A flattened or near-flattened TIFF open in Photoshop

Works with RGB and CMYK documents at any bit depth — the script converts internally to RGB 8-bit on the throwaway copy only.

- Adobe Photoshop CS6 或更高版本（包括 CC 2024）
- 桌面版 Photoshop 内置 ExtendScript 支持，无需另装任何东西
- 建议在拼合图层（或合并副本）上运行

支持 RGB 和 CMYK 文档，任意位深度——脚本只在临时副本上转换为 RGB 8-bit，原图的颜色模式不受影响。



---

## Installation 安装方法
**One-time use:**
`File > Scripts > Browse...` → select `PS_FindRealSeam.jsx`

**Permanent (appears in Scripts menu):**
Copy `PS_FindRealSeam.jsx` into your Photoshop scripts folder:

| OS | Path |
|----|------|
| Windows | `C:\Program Files\Adobe\Adobe Photoshop [version]\Presets\Scripts\` |
| macOS | `/Applications/Adobe Photoshop [version]/Presets/Scripts/` |

Restart Photoshop, then find it under `File > Scripts > PS_FindRealSeam`.

**临时使用：**
`文件 > 脚本 > 浏览...` → 选择 `PS_FindRealSeam.jsx`

**永久安装（出现在脚本菜单里）：**
把 `PS_FindRealSeam.jsx` 复制到 Photoshop 的脚本文件夹，然后重启 PS：

| 操作系统 | 路径 |
|----------|------|
| Windows | `C:\Program Files\Adobe\Adobe Photoshop [版本]\Presets\Scripts\` |
| macOS | `/Applications/Adobe Photoshop [版本]/Presets/Scripts/` |

重启后在 `文件 > 脚本 > SeamFinder` 里找到它。

---
---

## Usage 使用方法
1. Open your TIFF in Photoshop.
2. Run the script via `File > Scripts > Browse...` (or the Scripts menu if installed).
3. A small dialog appears:

   | Setting | Default | What it does |
   |---------|---------|--------------|
   | **White level** | 250 | Pixels at or above this brightness (0–255) are treated as "white". Lower to catch faint or slightly off-white seams; raise toward 255 for strict paper-white only. |
   | **Min white coverage** | 98% | How much of a row/column must be white to count as a full-span seam. Raise toward 100% to reduce false positives from genuine white design elements. |
   | **Scan horizontal seams** | ✓ | Detect full-width rows (the most common seam direction). |
   | **Scan vertical seams** | ✓ | Detect full-height columns. |

4. Click **Find seams**. The script will report how many seams were found and leave them all selected.
5. Press `Shift+F5`, choose **Content-Aware**, click **OK**.
6. Run the script again to confirm the result is clean.

1. 在 Photoshop 里打开需要检查的 TIFF。
2. 通过 `文件 > 脚本 > 浏览...` 运行脚本（或从脚本菜单启动）。
3. 弹出设置对话框：

   | 参数 | 默认值 | 说明 |
   |------|--------|------|
   | **White level（白度阈值）** | 250 | 亮度达到或超过此值（0–255）的像素才被视为"白"。调低可以抓住略微发灰、没完全透白的缝；调向 255 则只认严格的纯白。 |
   | **Min white coverage（最低白色覆盖率）** | 98% | 一行/一列里白色像素的占比必须达到这个比例才算"贯穿全幅"。调高到 99–100% 可以减少误判。 |
   | **扫描横向缝** | ✓ | 检测贯穿整个宽度的行（最常见）。 |
   | **扫描纵向缝** | ✓ | 检测贯穿整个高度的列。 |

4. 点击 **Find seams**，脚本汇报找到几条并把它们全部选中。
5. `Shift+F5 → 内容识别 → 确定`，一次补完。
6. 再跑一遍脚本确认结果干净。

---

## Tuning Tips 调参建议
**No seams found, but I can still see a line:**
Lower the White level (e.g. 240) — the seam may be slightly gray rather than pure white due to anti-aliasing at the edge of the rendering band.

**Bright client artwork is still being selected:**
Raise Min white coverage toward 99–100%. Gradients and locally bright elements typically don't cover the full width/height of a large print file.

**Script is slow on a very large file:**
The script works by resizing a copy of the image down to a 1-pixel-wide or 1-pixel-tall strip before reading pixel values — so even a 19,000-pixel-tall file only requires reading a handful of bytes. If it's still slow, it's likely the initial flatten/duplicate step; make sure your document isn't holding large embedded objects.

**Photoshop prompts me to click Save during the script:**
This is expected behavior on very large files. When the internal working copy exceeds 2 GB (or any single dimension exceeds 30,000 px), Photoshop automatically upgrades it to PSB (Large Document Format) and requires manual confirmation before saving. Just click **Save** when prompted — the script will continue normally. The file it saves is a temporary working copy and is discarded immediately after measurement; it does not overwrite your original.

**明明看得见白线，脚本说没找到：**
把 White level 调低（比如 240）。因为条带边缘有时有轻微抗锯齿，缝的实际亮度可能略低于 250。

**客户图里的亮色元素还是被误选了：**
把 Min white coverage 调高到 99% 甚至 100%。渐变色和局部高光通常不会覆盖整行/整列。

**大文件跑得很慢：**
脚本在读像素之前先把副本压成 1px 宽或 1px 高的细条，所以即使图像有 19000px 高，实际读取量也很小，速度通常很快。如果卡顿，瓶颈更可能是拼合/复制这一步——检查一下文档里有没有未拼合的大型嵌入对象。

**脚本运行中途 Photoshop 弹出了保存确认框：**
这是大文件的正常现象，不是报错。当内部工作副本超过 2GB、或任意一边超过 30000 像素时，Photoshop 会自动把它升格为 PSB（大型文档格式）并要求手动确认保存。直接点 **Save（保存）** 即可，脚本会继续正常运行。这个文件只是临时测量用的副本，完成后会立即被丢弃，不会覆盖你的原图。



---

## Why Content-Aware Fill Works So Well Here 为什么内容识别填充在这里特别好用
A 1-pixel seam is sandwiched between the two rows that were *meant* to be there. Content-Aware fill samples those immediate neighbors and interpolates — which is exactly the correct answer for a coverage-deficient gap. Even on complex, multi-color artwork, the fill will be accurate because the correct pixel information is literally adjacent.

1 像素的缝夹在上下（或左右）两行"本该正确"的像素之间——内容识别就是从紧邻的两行取样插值，等于直接拿到了正确答案。即便是多色复杂图像也不怕，因为正确的像素信息就在缝的两侧，触手可及。

---

## Background: Why Does Illustrator Do This? 技术原理：Illustrator 为什么会这样

When Illustrator rasterizes a large canvas, it splits the image into horizontal (or vertical) bands to manage memory. At the boundary between two bands, the anti-aliasing accumulation from both sides can leave a row of pixels with slightly less than 100% coverage. The white artboard bleeds through, producing a line that:

- is always exactly 1 pixel wide
- always spans the full width or height of the image
- appears at unpredictable positions
- can occur multiple times in one export
- gets worse with larger documents and higher DPIs

Adobe has never formally fixed this. The most reliable workaround at the Illustrator stage is to rasterize objects with `Object > Rasterize` before exporting, so no rasterization happens at export time. This script handles the cases that slip through anyway.

Illustrator 导出大画布时，为了节省内存会把图像切成若干横向（或纵向）条带分批栅格化。条带交界处，两侧抗锯齿的累计覆盖率在浮点舍入后可能不足 100%，白色画板从这道缝里透上来，就形成了：

- 宽度/高度永远是 1 像素
- 永远贯穿整个图像宽度或高度
- 出现位置不可预测
- 一张图里可能出现多条
- 图越大、分辨率越高越容易触发

Adobe 从未正式修复此问题。在 Illustrator 端最可靠的预防方式是导出前先用 `对象 > 栅格化` 手动栅格化，这样导出时就不会再发生二次栅格化。本脚本用于处理漏网之鱼。


---

## License

MIT
