Add-Type -AssemblyName System.Drawing

$size = 512
$scale = $size / 36.0

$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

# Background rounded rect
$bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#ce754e'))
$corner = [float](11.0 * $scale)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc([float]0, [float]0, [float]($corner * 2), [float]($corner * 2), 180, 90)
$path.AddArc([float]($size - $corner * 2), [float]0, [float]($corner * 2), [float]($corner * 2), 270, 90)
$path.AddArc([float]($size - $corner * 2), [float]($size - $corner * 2), [float]($corner * 2), [float]($corner * 2), 0, 90)
$path.AddArc([float]0, [float]($size - $corner * 2), [float]($corner * 2), [float]($corner * 2), 90, 90)
$path.CloseFigure()
$g.FillPath($bgBrush, $path)

# White shape brush
$whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#fff9f0'))

# Main silhouette: M10 23V11.5L15 14.5L20 10L25.5 14.5V20L20.5 25H15.5L15 20.5L10 23Z
$p1 = New-Object System.Drawing.Drawing2D.GraphicsPath
[System.Drawing.PointF[]]$points1 = @(
    (New-Object System.Drawing.PointF ([float](10.0 * $scale)), ([float](23.0 * $scale))),
    (New-Object System.Drawing.PointF ([float](10.0 * $scale)), ([float](11.5 * $scale))),
    (New-Object System.Drawing.PointF ([float](15.0 * $scale)), ([float](14.5 * $scale))),
    (New-Object System.Drawing.PointF ([float](20.0 * $scale)), ([float](10.0 * $scale))),
    (New-Object System.Drawing.PointF ([float](25.5 * $scale)), ([float](14.5 * $scale))),
    (New-Object System.Drawing.PointF ([float](25.5 * $scale)), ([float](20.0 * $scale))),
    (New-Object System.Drawing.PointF ([float](20.5 * $scale)), ([float](25.0 * $scale))),
    (New-Object System.Drawing.PointF ([float](15.5 * $scale)), ([float](25.0 * $scale))),
    (New-Object System.Drawing.PointF ([float](15.0 * $scale)), ([float](20.5 * $scale)))
)
$p1.AddPolygon($points1)
$g.FillPath($whiteBrush, $p1)

# M10 11.5L9 18L14 17L15 14.5
$p2 = New-Object System.Drawing.Drawing2D.GraphicsPath
[System.Drawing.PointF[]]$points2 = @(
    (New-Object System.Drawing.PointF ([float](10.0 * $scale)), ([float](11.5 * $scale))),
    (New-Object System.Drawing.PointF ([float](9.0 * $scale)), ([float](18.0 * $scale))),
    (New-Object System.Drawing.PointF ([float](14.0 * $scale)), ([float](17.0 * $scale))),
    (New-Object System.Drawing.PointF ([float](15.0 * $scale)), ([float](14.5 * $scale)))
)
$p2.AddPolygon($points2)
$g.FillPath($whiteBrush, $p2)

# M25 18H28L25 21
$p3 = New-Object System.Drawing.Drawing2D.GraphicsPath
[System.Drawing.PointF[]]$points3 = @(
    (New-Object System.Drawing.PointF ([float](25.0 * $scale)), ([float](18.0 * $scale))),
    (New-Object System.Drawing.PointF ([float](28.0 * $scale)), ([float](18.0 * $scale))),
    (New-Object System.Drawing.PointF ([float](25.0 * $scale)), ([float](21.0 * $scale)))
)
$p3.AddPolygon($points3)
$g.FillPath($whiteBrush, $p3)

# Eye dot: cx="22.3" cy="16.2" r="1"
$eyeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#ce6538'))
$r = [float](1.0 * $scale)
$g.FillEllipse($eyeBrush, [float]((22.3 * $scale) - $r), [float]((16.2 * $scale) - $r), [float]($r * 2), [float]($r * 2))

$target = [System.IO.Path]::GetFullPath("public/hound.png")
$bmp.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "Generated: $target"

