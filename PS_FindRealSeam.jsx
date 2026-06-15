#target photoshop

/* ============================================================
 * SeamFinder.jsx  (v2 - pure-white gate)
 *
 * Finds the 1px, full-width / full-height "white line" seams the
 * Illustrator / Photoshop rasterizer leaves behind, and selects every
 * one of them into ONE selection so you can patch them all at once with
 *     Shift+F5  ->  Contents: Content-Aware  ->  OK
 *
 * READ-ONLY: it never touches your image. It measures brightness on
 * throwaway copies and only leaves a selection on your original.
 *
 * HOW IT TELLS A SEAM FROM A REAL HIGHLIGHT
 * A true seam is coverage-deficient: the white canvas bleeds through, so
 * the line is (near) pure white across its WHOLE span. A highlight in the
 * art is usually a gradient, only partial-width, or just shy of pure
 * white. So instead of "brighter than its neighbors" (which also catches
 * bright highlights on dark art), this version:
 *   1. binarizes a throwaway copy at WHITE LEVEL (>= level -> white),
 *   2. collapses width->1 (or height->1) so each row/column value is just
 *      "what fraction of that line was white",
 *   3. flags a line only if its white coverage >= MIN COVERAGE while the
 *      rows/columns on both sides are NOT that white (i.e. an isolated
 *      white hairline, not the edge of a genuinely white area).
 *
 * TUNING
 *   White level  : raise toward 255 = only strict paper-white counts;
 *                  lower it to also catch off-white / partially-bled seams.
 *   Min coverage : how much of the line must be white to call it full-span.
 *                  raise toward 100% to be stricter (fewer false hits).
 *
 * Install: File > Scripts > Browse...  (or drop into Presets/Scripts).
 * ============================================================ */

(function () {
    if (!app.documents.length) { alert("Open a document first."); return; }

    /* ---------- settings dialog ---------- */
    var w = new Window("dialog", "Seam Finder");
    w.orientation = "column";
    w.alignChildren = "fill";

    var r1 = w.add("group");
    r1.add("statictext", undefined, "White level (0\u2013255):");
    var wlIn = r1.add("edittext", undefined, "250"); wlIn.characters = 4;

    var r2 = w.add("group");
    r2.add("statictext", undefined, "Min white coverage (%):");
    var covIn = r2.add("edittext", undefined, "98"); covIn.characters = 4;

    var cH = w.add("checkbox", undefined, "Scan horizontal seams (full-width rows)");
    cH.value = true;
    var cV = w.add("checkbox", undefined, "Scan vertical seams (full-height columns)");
    cV.value = true;

    var rb = w.add("group"); rb.alignment = "right";
    rb.add("button", undefined, "Cancel", { name: "cancel" });
    rb.add("button", undefined, "Find seams", { name: "ok" });
    if (w.show() != 1) return;

    var whiteLevel = Math.round(parseFloat(wlIn.text));
    if (isNaN(whiteLevel)) whiteLevel = 250;
    if (whiteLevel < 1) whiteLevel = 1; if (whiteLevel > 255) whiteLevel = 255;

    var coverage = parseFloat(covIn.text);
    if (isNaN(coverage)) coverage = 98;
    if (coverage > 100) coverage = 100; if (coverage < 1) coverage = 1;
    var covThresh = coverage / 100 * 255;     // value a collapsed white line must reach

    var doH = cH.value, doV = cV.value;
    if (!doH && !doV) { alert("Nothing to scan."); return; }

    var oldUnits = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;
    var src = app.activeDocument;

    try {
        /* ---------- flattened, binarized measurement copy ---------- */
        var base = src.duplicate("seam_base", true);
        if (base.mode != DocumentMode.RGB) base.changeMode(ChangeMode.RGB);
        if (base.bitsPerChannel != BitsPerChannelType.EIGHT)
            base.bitsPerChannel = BitsPerChannelType.EIGHT;
        base.flatten();
        base.artLayers[0].threshold(whiteLevel);   // >= whiteLevel -> white, else black

        var W = Math.round(base.width.as("px"));
        var H = Math.round(base.height.as("px"));

        var rows = doH ? scanAxis(base, "h", W, H, covThresh) : [];
        var cols = doV ? scanAxis(base, "v", W, H, covThresh) : [];

        base.close(SaveOptions.DONOTSAVECHANGES);

        /* ---------- one combined selection on the ORIGINAL ---------- */
        app.activeDocument = src;
        var made = 0, i;
        for (i = 0; i < rows.length; i++) {
            var y = rows[i];
            addRegion(src, [[0, y], [W, y], [W, y + 1], [0, y + 1]], made === 0); made++;
        }
        for (i = 0; i < cols.length; i++) {
            var x = cols[i];
            addRegion(src, [[x, 0], [x + 1, 0], [x + 1, H], [x, H]], made === 0); made++;
        }

        if (made === 0) {
            alert("No pure-white seams found.\n" +
                  "If a faint line remains, lower the White level (e.g. 240)\n" +
                  "or lower Min coverage a little, and re-run.");
        } else {
            alert(made + " seam line(s) selected.\n" +
                  "    horizontal: " + rows.length + "\n" +
                  "    vertical:   " + cols.length + "\n\n" +
                  "Now: Shift+F5  ->  Content-Aware  ->  OK\n" +
                  "Re-run afterwards to confirm it's clean.");
        }
    } catch (e) {
        alert("Error: " + e + (e.line ? ("  (line " + e.line + ")") : ""));
    } finally {
        app.preferences.rulerUnits = oldUnits;
    }

    /* ============================================================ */

    // Collapse one axis to 1px on the binarized copy, read the white-
    // coverage profile, flag isolated near-fully-white lines.
    function scanAxis(baseDoc, axis, W, H, covThresh) {
        var d = baseDoc.duplicate("seam_strip");
        if (axis === "h")
            d.resizeImage(UnitValue(1, "px"), UnitValue(H, "px"), null, ResampleMethod.BILINEAR);
        else
            d.resizeImage(UnitValue(W, "px"), UnitValue(1, "px"), null, ResampleMethod.BILINEAR);

        var f = new File(Folder.temp + "/seam_strip_" + axis + ".bmp");
        var bo = new BMPSaveOptions();
        bo.depth = BMPDepthType.TWENTYFOUR;
        bo.osType = OperatingSystem.WINDOWS;
        bo.rleCompression = false;
        d.saveAs(f, bo, true, Extension.LOWERCASE);
        d.close(SaveOptions.DONOTSAVECHANGES);

        var prof = readBmpLine(f, axis === "h" ? "col" : "row");
        f.remove();

        // a seam = this line is (near) fully white AND both sides are not
        var hits = [], n = prof.length;
        for (var i = 1; i < n - 1; i++) {
            if (prof[i] >= covThresh && prof[i - 1] < covThresh && prof[i + 1] < covThresh)
                hits.push(i);
        }
        return hits;
    }

    function readBmpLine(file, mode) {
        file.encoding = "BINARY";
        file.open("r");
        var s = file.read();
        file.close();

        var off = u32(s, 10);
        var bw  = s32(s, 18);
        var bh  = s32(s, 22);
        var topDown = bh < 0;
        var Wd = Math.abs(bw), Hd = Math.abs(bh);
        var stride = ((Wd * 3 + 3) >> 2) << 2;

        var out = [];
        if (mode === "col") {                       // 1px wide -> per row
            for (var y = 0; y < Hd; y++) {
                var fileRow = topDown ? y : (Hd - 1 - y);
                out.push(lumAt(s, off + fileRow * stride));
            }
        } else {                                    // 1px tall -> per column
            for (var x = 0; x < Wd; x++) out.push(lumAt(s, off + x * 3));
        }
        return out;
    }

    function lumAt(s, p) {
        var b = s.charCodeAt(p), g = s.charCodeAt(p + 1), r = s.charCodeAt(p + 2);
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }
    function u32(s, o) {
        return s.charCodeAt(o) + s.charCodeAt(o + 1) * 256 +
               s.charCodeAt(o + 2) * 65536 + s.charCodeAt(o + 3) * 16777216;
    }
    function s32(s, o) { var v = u32(s, o); return v >= 2147483648 ? v - 4294967296 : v; }
    function addRegion(doc, region, isFirst) {
        doc.selection.select(region, isFirst ? SelectionType.REPLACE : SelectionType.EXTEND);
    }
})();
