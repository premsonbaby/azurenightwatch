# Apply Figma Calm Blue palette (#90D5FF / #57B9FF / #77B1D4 / #517891)
# to all violet, indigo, sky, blue, teal accent classes and chart colours

$srcDir = "src"
$files = Get-ChildItem -Path $srcDir -Recurse -Include "*.tsx","*.ts" | Where-Object { !$_.PSIsContainer }

$changes = 0
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content

    # ── VIOLET → calm blue (#90D5FF light, #57B9FF medium) ──────────────
    $content = [regex]::Replace($content, 'text-violet-\d+',           'text-[#90D5FF]')
    $content = [regex]::Replace($content, 'bg-violet-(\d+)/(\d+)',     'bg-[#57B9FF]/$2')
    $content = [regex]::Replace($content, 'bg-violet-\d+',             'bg-[#57B9FF]')
    $content = [regex]::Replace($content, 'border-violet-(\d+)/(\d+)', 'border-[#57B9FF]/$2')
    $content = [regex]::Replace($content, 'border-violet-\d+',         'border-[#57B9FF]')
    $content = [regex]::Replace($content, 'ring-violet-(\d+)/(\d+)',   'ring-[#57B9FF]/$2')
    $content = [regex]::Replace($content, 'ring-violet-\d+',           'ring-[#57B9FF]')
    $content = [regex]::Replace($content, 'from-violet-\d+/(\d+)',     'from-[#57B9FF]/$1')
    $content = [regex]::Replace($content, 'to-violet-\d+/(\d+)',       'to-[#57B9FF]/$1')

    # ── INDIGO → calm blue muted (#77B1D4 / #517891) ────────────────────
    $content = [regex]::Replace($content, 'text-indigo-\d+',           'text-[#77B1D4]')
    $content = [regex]::Replace($content, 'bg-indigo-(\d+)/(\d+)',     'bg-[#57B9FF]/$2')
    $content = [regex]::Replace($content, 'bg-indigo-\d+',             'bg-[#57B9FF]')
    $content = [regex]::Replace($content, 'border-indigo-(\d+)/(\d+)', 'border-[#77B1D4]/$2')
    $content = [regex]::Replace($content, 'border-indigo-\d+',         'border-[#77B1D4]')
    $content = [regex]::Replace($content, 'ring-indigo-\d+',           'ring-[#77B1D4]')

    # ── SKY → #57B9FF (medium calm blue) ────────────────────────────────
    $content = [regex]::Replace($content, 'text-sky-\d+',              'text-[#57B9FF]')
    $content = [regex]::Replace($content, 'bg-sky-(\d+)/(\d+)',        'bg-[#57B9FF]/$2')
    $content = [regex]::Replace($content, 'bg-sky-\d+',                'bg-[#57B9FF]')
    $content = [regex]::Replace($content, 'border-sky-(\d+)/(\d+)',    'border-[#57B9FF]/$2')
    $content = [regex]::Replace($content, 'border-sky-\d+',            'border-[#57B9FF]')

    # ── BLUE → #77B1D4 (muted calm blue) ────────────────────────────────
    $content = [regex]::Replace($content, 'text-blue-\d+',             'text-[#77B1D4]')
    $content = [regex]::Replace($content, 'bg-blue-(\d+)/(\d+)',       'bg-[#57B9FF]/$2')
    $content = [regex]::Replace($content, 'bg-blue-\d+',               'bg-[#57B9FF]')
    $content = [regex]::Replace($content, 'border-blue-(\d+)/(\d+)',   'border-[#57B9FF]/$2')
    $content = [regex]::Replace($content, 'border-blue-\d+',           'border-[#57B9FF]')

    # ── TEAL → #77B1D4 ──────────────────────────────────────────────────
    $content = [regex]::Replace($content, 'text-teal-\d+',             'text-[#77B1D4]')
    $content = [regex]::Replace($content, 'bg-teal-(\d+)/(\d+)',       'bg-[#77B1D4]/$2')
    $content = [regex]::Replace($content, 'bg-teal-\d+',               'bg-[#77B1D4]')

    # ── HEX: violet/indigo/sky/blue → calm blue ──────────────────────────
    $content = $content -replace '#8b5cf6', '#77B1D4'   # violet-500
    $content = $content -replace '#a78bfa', '#90D5FF'   # violet-400 light
    $content = $content -replace '#7c3aed', '#517891'   # violet-600
    $content = $content -replace '#6366f1', '#517891'   # indigo-500
    $content = $content -replace '#818cf8', '#77B1D4'   # indigo-400
    $content = $content -replace '#4f46e5', '#517891'   # indigo-600
    $content = $content -replace '#38bdf8', '#90D5FF'   # sky-400
    $content = $content -replace '#0ea5e9', '#57B9FF'   # sky-500
    $content = $content -replace '#0284c7', '#517891'   # sky-600
    $content = $content -replace '#3b82f6', '#57B9FF'   # blue-500
    $content = $content -replace '#60a5fa', '#90D5FF'   # blue-400
    $content = $content -replace '#93c5fd', '#90D5FF'   # blue-300
    $content = $content -replace '#1d4ed8', '#517891'   # blue-700
    $content = $content -replace '#14b8a6', '#77B1D4'   # teal-500
    $content = $content -replace '#2dd4bf', '#90D5FF'   # teal-400

    # ── CHART TOOLTIPS: update text & border to match palette ───────────
    $content = $content -replace '#f4f4f5',                         '#e8f4ff'
    $content = $content -replace 'rgba\(148,163,184,0\.2\)',        'rgba(87,185,255,0.12)'
    $content = $content -replace 'rgba\(148, 163, 184, 0\.2\)',     'rgba(87, 185, 255, 0.12)'
    $content = $content -replace 'rgba\(255,255,255,0\.1\)',        'rgba(87,185,255,0.10)'
    $content = $content -replace 'rgba\(255, 255, 255, 0\.1\)',     'rgba(87, 185, 255, 0.10)'

    # ── LineTrendChart card bg: zinc-500 (placeholder) → zinc-700 (card) -
    $content = $content -replace 'bg-zinc-500 p-4 backdrop-blur-sm', 'bg-zinc-700 p-4 backdrop-blur-sm'

    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        $changes++
        Write-Host "  Updated: $($file.Name)"
    }
}
Write-Host "`nDone. Files updated: $changes"
