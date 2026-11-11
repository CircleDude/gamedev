# Очистка фона спрайта из рисунка на белом фоне:
# 1) flood fill (BFS) от границы изображения красит фон в прозрачный;
# 2) обрезка до bounding box непрозрачных пикселей;
# 3) масштабирование до макс. стороны MaxSide (HighQualityBicubic);
# 4) сохранение в PNG + вывод итогового размера.
# Пригоден и для будущих спрайтов: .\tools\clean-fist.ps1 -InputPath <рисунок> -OutputPath public\<имя>.png
param(
    [string]$InputPath = "$PSScriptRoot\..\fist.png",
    [string]$OutputPath = "$PSScriptRoot\..\public\fist.png",
    [int]$Tolerance = 30,   # допуск по каждому каналу R/G/B против цвета фона
    [int]$MaxSide = 64      # максимальная сторона итогового спрайта, px
)

Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class SpriteCleaner
{
    private static int Idx(int x, int y, int stride)
    {
        return y * stride + x * 4; // Format32bppArgb: B, G, R, A
    }

    public static string Clean(string inputPath, string outputPath, int tolerance, int maxSide)
    {
        // ВАЖНО: исходник может быть палитровым (8bpp) — конвертируем в 32bppArgb,
        // иначе альфа при записи обратно в LockBits теряется.
        using (var loaded = new Bitmap(inputPath))
        using (var src = loaded.Clone(new Rectangle(0, 0, loaded.Width, loaded.Height), PixelFormat.Format32bppArgb))
        {
            int w = src.Width;
            int h = src.Height;
            var data = src.LockBits(
                new Rectangle(0, 0, w, h),
                ImageLockMode.ReadWrite,
                PixelFormat.Format32bppArgb);
            int stride = data.Stride;
            byte[] px = new byte[stride * h];
            Marshal.Copy(data.Scan0, px, 0, px.Length);

            // Цвет фона — усреднение четырёх угловых пикселей.
            int[] corners =
            {
                Idx(0, 0, stride), Idx(w - 1, 0, stride),
                Idx(0, h - 1, stride), Idx(w - 1, h - 1, stride)
            };
            int sumB = 0, sumG = 0, sumR = 0;
            foreach (int c in corners)
            {
                sumB += px[c];
                sumG += px[c + 1];
                sumR += px[c + 2];
            }
            int bgB = sumB / 4, bgG = sumG / 4, bgR = sumR / 4;

            // Flood fill (BFS) от всех граничных пикселей, похожих на фон.
            var visited = new bool[w * h];
            var queue = new Queue<int>();
            Action<int, int> trySeed = (x, y) =>
            {
                int p = y * w + x;
                if (visited[p]) return;
                int i = Idx(x, y, stride);
                if (Math.Abs(px[i] - bgB) <= tolerance &&
                    Math.Abs(px[i + 1] - bgG) <= tolerance &&
                    Math.Abs(px[i + 2] - bgR) <= tolerance)
                {
                    visited[p] = true;
                    queue.Enqueue(p);
                }
            };
            for (int x = 0; x < w; x++) { trySeed(x, 0); trySeed(x, h - 1); }
            for (int y = 0; y < h; y++) { trySeed(0, y); trySeed(w - 1, y); }

            while (queue.Count > 0)
            {
                int p = queue.Dequeue();
                int x = p % w;
                int y = p / w;
                int i = Idx(x, y, stride);
                px[i + 3] = 0; // прозрачный
                Action<int, int> visit = trySeed;
                if (x > 0) visit(x - 1, y);
                if (x < w - 1) visit(x + 1, y);
                if (y > 0) visit(x, y - 1);
                if (y < h - 1) visit(x, y + 1);
            }

            Marshal.Copy(px, 0, data.Scan0, px.Length);
            src.UnlockBits(data);

            // Bounding box непрозрачных пикселей.
            int minX = w, minY = h, maxX = -1, maxY = -1;
            for (int y = 0; y < h; y++)
            {
                int row = y * stride;
                for (int x = 0; x < w; x++)
                {
                    if (px[row + x * 4 + 3] == 0) continue;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
            if (maxX < 0) throw new InvalidOperationException("Все пиксели признаны фоном — проверь допуск.");

            int cw = maxX - minX + 1;
            int ch = maxY - minY + 1;
            double scale = (double)maxSide / Math.Max(cw, ch);
            int nw = Math.Max(1, (int)Math.Round(cw * scale));
            int nh = Math.Max(1, (int)Math.Round(ch * scale));

            using (var cropped = src.Clone(new Rectangle(minX, minY, cw, ch), src.PixelFormat))
            using (var result = new Bitmap(nw, nh, PixelFormat.Format32bppArgb))
            {
                using (var g = Graphics.FromImage(result))
                {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.SmoothingMode = SmoothingMode.HighQuality;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    // TileFlipXY исключает ореол по краям при бикубике.
                    var attr = new ImageAttributes();
                    attr.SetWrapMode(WrapMode.TileFlipXY);
                    g.DrawImage(cropped, new Rectangle(0, 0, nw, nh), 0, 0, cw, ch, GraphicsUnit.Pixel, attr);
                }
                string dir = Path.GetDirectoryName(Path.GetFullPath(outputPath));
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
                result.Save(outputPath, ImageFormat.Png);
            }
        }

        var fi = new FileInfo(outputPath);
        using (var outBmp = new Bitmap(outputPath))
        {
            return string.Format(
                "{0}: {1}x{2} px, {3} байт",
                outputPath, outBmp.Width, outBmp.Height, fi.Length);
        }
    }
}
"@

[SpriteCleaner]::Clean($InputPath, $OutputPath, $Tolerance, $MaxSide)
