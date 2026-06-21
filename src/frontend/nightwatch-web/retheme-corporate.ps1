# Replace Calm Blue palette → Corporate Charcoal (no hue, pure neutral silver)
# Palette:  highlight=#c0c0c0  secondary=#888888  muted=#5a5a5a  deep=#383838

$srcDir = "src"
$files = Get-ChildItem -Path $srcDir -Recurse -Include "*.tsx","*.ts" | Where-Object { !$_.PSIsContainer }

$changes = 0
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content

    # ── TAILWIND ARBITRARY TEXT CLASSES ─────────────────────────────────
    $content = $content -replace 'text-\[#90D5FF\]', 'text-[#e0e0e0]'
    $content = $content -replace 'text-\[#57B9FF\]', 'text-[#c0c0c0]'
    $content = $content -replace 'text-\[#77B1D4\]', 'text-[#888888]'
    $content = $content -replace 'text-\[#517891\]', 'text-[#5a5a5a]'

    # ── TAILWIND ARBITRARY BG CLASSES ────────────────────────────────────
    $content = [regex]::Replace($content, 'bg-\[#57B9FF\]/(\d+)', 'bg-white/$1')
    $content = [regex]::Replace($content, 'bg-\[#77B1D4\]/(\d+)', 'bg-white/$1')
    $content = [regex]::Replace($content, 'bg-\[#90D5FF\]/(\d+)', 'bg-white/$1')
    $content = $content -replace 'bg-\[#57B9FF\]', 'bg-[#c0c0c0]'
    $content = $content -replace 'bg-\[#77B1D4\]', 'bg-[#888888]'
    $content = $content -replace 'bg-\[#90D5FF\]', 'bg-[#e0e0e0]'

    # ── TAILWIND ARBITRARY BORDER/RING CLASSES ───────────────────────────
    $content = [regex]::Replace($content, 'border-\[#57B9FF\]/(\d+)', 'border-white/$1')
    $content = [regex]::Replace($content, 'border-\[#77B1D4\]/(\d+)', 'border-white/$1')
    $content = [regex]::Replace($content, 'border-\[#90D5FF\]/(\d+)', 'border-white/$1')
    $content = $content -replace 'border-\[#57B9FF\]', 'border-white/20'
    $content = $content -replace 'border-\[#77B1D4\]', 'border-white/15'
    $content = [regex]::Replace($content, 'ring-\[#57B9FF\]/(\d+)', 'ring-white/$1')
    $content = $content -replace 'ring-\[#57B9FF\]', 'ring-white'

    # ── CHART / INLINE HEX REPLACEMENTS ─────────────────────────────────
    # Palette accents → silver
    $content = $content -replace '#57B9FF', '#c0c0c0'
    $content = $content -replace '#90D5FF', '#e0e0e0'
    $content = $content -replace '#77B1D4', '#888888'
    $content = $content -replace '#517891', '#5a5a5a'

    # Old card/elevated backgrounds still lingering in inline styles
    $content = $content -replace '#162c40', '#1c1c1c'
    $content = $content -replace '#1e3850', '#242424'
    $content = $content -replace '#10202e', '#141414'
    $content = $content -replace '#0b1520', '#0c0c0c'

    # Near-white tooltip text
    $content = $content -replace '#e8f4ff', '#f0f0f0'
    $content = $content -replace '#b8d8f0', '#d8d8d8'

    # Tooltip border glows → plain white
    $content = $content -replace 'rgba\(87,185,255,0\.12\)',      'rgba(255,255,255,0.08)'
    $content = $content -replace 'rgba\(87, 185, 255, 0\.12\)',   'rgba(255, 255, 255, 0.08)'
    $content = $content -replace 'rgba\(87,185,255,0\.10\)',      'rgba(255,255,255,0.06)'
    $content = $content -replace 'rgba\(87, 185, 255, 0\.10\)',   'rgba(255, 255, 255, 0.06)'
    $content = $content -replace 'rgba\(87,185,255,0\.15\)',      'rgba(255,255,255,0.08)'
    $content = $content -replace 'rgba\(87, 185, 255, 0\.15\)',   'rgba(255, 255, 255, 0.08)'

    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        $changes++
        Write-Host "  $($file.Name)"
    }
}
Write-Host "`nDone. Files updated: $changes"
