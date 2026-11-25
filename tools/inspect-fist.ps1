# Инспектор спрайта: сколько прозрачных пикселей, есть ли белые ореолы
# (непрозрачные белые пиксели рядом с прозрачными), статистика альфы по краям.
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class SpriteInspect
{
    public static string Report(string path)
    {
        using (var bmp = new Bitmap(path))
        {
            int w = bmp.Width, h = bmp.Height;
            var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            int stride = data.Stride;
            byte[] px = new byte[stride * h];
            Marshal.Copy(data.Scan0, px, 0, px.Length);
            bmp.UnlockBits(data);

            int total = w * h, transparent = 0, semi = 0;
            int haloWhite = 0; // непрозрачный бело-серый пиксель рядом с прозрачным
            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++)
                {
                    int i = y * stride + x * 4;
                    int a = px[i + 3];
                    if (a == 0) { transparent++; continue; }
                    if (a < 255) semi++;
                    bool nearTransparent = false;
                    if (x > 0 && px[i - 1] == 0 && px[i - 4 + 3] == 0) nearTransparent = true;
                    if (x < w - 1 && px[i + 7] == 0) nearTransparent = true;
                    if (y > 0 && px[i - stride + 3] == 0) nearTransparent = true;
                    if (y < h - 1 && px[i + stride + 3] == 0) nearTransparent = true;
                    if (nearTransparent && a == 255 && px[i] > 200 && px[i + 1] > 200 && px[i + 2] > 200)
                        haloWhite++;
                }
            }
            return string.Format(
                "{0}: {1}x{2}, прозрачных {3}/{4} ({5:P1}), полупрозрачных {6}, белых граничных (возможный ореол) {7}",
                path, w, h, transparent, total, (double)transparent / total, semi, haloWhite);
        }
    }
}
"@

[SpriteInspect]::Report("$PSScriptRoot\..\public\fist.png")
