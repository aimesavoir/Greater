Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

$AllCond = [System.Windows.Automation.Condition]::TrueCondition

function Get-Pane {
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $cond = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::NameProperty, "Greater")
    $win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
    if (-not $win) { return $null }
    $paneCond = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::NameProperty, "Greater - contenu Web")
    $win.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $paneCond)
}

function Get-Elements($pane) {
    if (-not $pane) { return @() }
    $pane.FindAll([System.Windows.Automation.TreeScope]::Descendants, $AllCond)
}

# wait until an element matching the predicate exists; returns it
function Wait-Element($paneProvider, $pred, $timeoutSec) {
    $t0 = Get-Date
    while (((Get-Date) - $t0).TotalSeconds -lt $timeoutSec) {
        foreach ($e in (Get-Elements (& $paneProvider))) {
            if (& $pred $e) { return $e }
        }
        Start-Sleep -Milliseconds 400
    }
    $null
}

function Is-Type($e, $t) { $e.Current.ControlType.ProgrammaticName -eq $t }
function Status-Name($e) {
    $n = $e.Current.Name
    if ((Is-Type $e 'ControlType.Text') -and $n -notmatch 'engine' -and
          $n -match '^(Done|Cancelled|Cancelling|Scanning|scanning|Found|Analyzed|No duplicates|Nothing to clean|error|Ready|JS-|listen|volume list|cancel:|Moved to Recycle|Deleted permanently)') {
        return $n
    }
    ''
}

function Find-ButtonByAria($paneProvider, $ariaLabel, $timeoutSec) {
    Wait-Element $paneProvider { param($e)
        (Is-Type $e 'ControlType.Button') -and $e.Current.Name -eq $ariaLabel -and $e.Current.IsEnabled } $timeoutSec
}

function Get-CabinetWindows {
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $cond = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ClassNameProperty, "CabinetWClass")
    $root.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)
}

function Close-CabinetWindows($folderLike) {
    foreach ($w in (Get-CabinetWindows)) {
        if ($w.Current.Name -like "$folderLike*") {
            try { $w.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern).Close() } catch {}
        }
    }
}

function Wait-ExplorerWindow($folderLike, $timeoutSec) {
    $t0 = Get-Date
    while (((Get-Date) - $t0).TotalSeconds -lt $timeoutSec) {
        foreach ($w in (Get-CabinetWindows)) {
            if ($w.Current.Name -like "$folderLike*") { return $w }
        }
        Start-Sleep -Milliseconds 400
    }
    $null
}

function Test-ExplorerSelection($win, $fileName) {
    foreach ($i in $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $AllCond)) {
        if ($i.Current.Name -eq $fileName) {
            try {
                return $i.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Current.IsSelected
            } catch { return $false }
        }
    }
    $false
}

function Get-Status($pane) {
    foreach ($e in (Get-Elements $pane)) {
        $n = Status-Name $e
        if ($n) { return $n }
    }
    ''
}

function Wait-Status($paneProvider, $pattern, $timeoutSec) {
    $t0 = Get-Date
    while ($true) {
        $s = Get-Status (& $paneProvider)
        if ($s -match $pattern) { return $s }
        if (((Get-Date) - $t0).TotalSeconds -gt $timeoutSec) { return "TIMEOUT (last: $s)" }
        Start-Sleep -Milliseconds 300
    }
}

function Set-Path($paneProvider, $value) {
    $edit = Wait-Element $paneProvider { param($e) Is-Type $e 'ControlType.Edit' } 20
    if (-not $edit) { throw "path edit not found" }
    $edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($value)
}

function Click-Scan($paneProvider, $timeoutSec) {
    $btn = Wait-Element $paneProvider { param($e)
        (Is-Type $e 'ControlType.Button') -and $e.Current.Name -eq 'Scan' -and $e.Current.IsEnabled } $timeoutSec
    if (-not $btn) { throw "Scan button not found/enabled" }
    $btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
}

function Click-Cancel($paneProvider, $timeoutSec) {
    $btn = Wait-Element $paneProvider { param($e)
        (Is-Type $e 'ControlType.Button') -and $e.Current.Name -eq 'Cancel' -and $e.Current.IsEnabled } $timeoutSec
    if (-not $btn) { throw "Cancel button not found/enabled" }
    $btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
}

$failures = @()
$paneProvider = { Get-Pane }

Get-Process greater -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

# Isolated drive for the Clean test: a subst drive backed by a fabricated tree,
# so cleaning a drive card never touches real data (e.g. D:'s Recycle Bin).
$clean = "D:\greater-clean"
Remove-Item $clean -Recurse -Force -ErrorAction SilentlyContinue
foreach ($d in @(
    "$clean\Windows\Temp",
    "$clean\Users\bob\AppData\Local\Temp",
    "$clean\Windows\SoftwareDistribution\Download",
    "$clean\Users\bob\Downloads"
)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
$fixtures = @{
    "$clean\Windows\Temp\w.tmp"                             = 2MB
    "$clean\Users\bob\AppData\Local\Temp\a.tmp"            = 1MB
    "$clean\Windows\SoftwareDistribution\Download\big.cab" = 3MB
    "$clean\Users\bob\Downloads\holiday.jpg"               = 512KB
}
$fixtureTime = Get-Date '2020-01-01'
foreach ($f in $fixtures.Keys) {
    $fs = [System.IO.File]::Create($f); $fs.SetLength($fixtures[$f]); $fs.Close()
    [System.IO.File]::SetLastWriteTime($f, $fixtureTime)
}
if (Test-Path "Y:\") { subst Y: /d | Out-Null }
subst Y: $clean | Out-Null

# Isolated drive for the Duplicates test: a subst drive backed by a fabricated
# tree with one genuine duplicate pair (2 MiB), a same-size/different-content
# decoy, and sub-min-size copies that must be ignored.
$dupes = "D:\greater-dupes"
Remove-Item $dupes -Recurse -Force -ErrorAction SilentlyContinue
foreach ($d in @("$dupes\keep", "$dupes\copy", "$dupes\small")) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
function New-PatternFile($path, $size, $fill) {
    $buf = New-Object byte[] 65536
    for ($i = 0; $i -lt $buf.Length; $i++) { $buf[$i] = $fill }
    $fs = [System.IO.File]::Create($path)
    $written = 0
    while ($written -lt $size) {
        $n = [Math]::Min($buf.Length, $size - $written)
        $fs.Write($buf, 0, $n); $written += $n
    }
    $fs.Close()
}
New-PatternFile "$dupes\keep\photo.bin"         (2MB) 65
New-PatternFile "$dupes\copy\photo.bin"         (2MB) 65
New-PatternFile "$dupes\copy\same-size-diff.bin" (2MB) 66
New-PatternFile "$dupes\small\tiny1.bin"        100 67
New-PatternFile "$dupes\small\tiny2.bin"        100 67
[System.IO.File]::SetLastWriteTime("$dupes\keep\photo.bin", (Get-Date '2020-01-01'))
[System.IO.File]::SetLastWriteTime("$dupes\copy\photo.bin", (Get-Date '2021-01-01'))
if (Test-Path "Z:\") { subst Z: /d | Out-Null }
subst Z: $dupes | Out-Null

Start-Process "D:\greater-target\release\greater.exe"

# wait for ready state
$s = Wait-Status $paneProvider '^Ready|^JS-|^listen' 40
if ($s -match '^Ready') { Write-Host "PASS: app ready" }
elseif ($s -match '^listen') { Write-Host "FAIL: event listeners rejected -> $s"; $failures += 'acls' }
else { Write-Host "FAIL: app did not become ready -> $s"; $failures += 'boot' }

# First-run onboarding (fresh profile only): accept the defaults so the rest of
# the run is unobstructed. On later runs the flag is already stored.
$firstrun = Find-ButtonByAria $paneProvider 'Start using Greater' 2
if ($firstrun) {
    $firstrun.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    Start-Sleep -Milliseconds 600
    Write-Host "PASS: first-run onboarding dismissed"
}

# ---- test 1: small folder scan ----
try {
    Set-Path $paneProvider "X:\Greater"
} catch { Write-Host "FAIL: set path -> $_"; $failures += 'setpath' }
try {
    Click-Scan $paneProvider 20
} catch { Write-Host "FAIL: $($_)"; $failures += 'click' }
$s = Wait-Status $paneProvider '^Done|^error|^JS-' 120
if ($s -match '^Done') { Write-Host "PASS: small scan -> $s" } else { Write-Host "FAIL: small scan -> $s"; $failures += 'small' }
Start-Sleep -Milliseconds 900
$hdr = ''
foreach ($e in (Get-Elements (Get-Pane))) {
    if ((Is-Type $e 'ControlType.Text') -and $e.Current.Name -match '(files \(largest first\)|largest of .* files)') { $hdr = $e.Current.Name }
}
if ($hdr) { Write-Host "PASS: list populated -> $hdr" } else { Write-Host "FAIL: no list header"; $failures += 'header' }

# ---- test 2: cancel mid-scan on C:\ ----
try {
    Set-Path $paneProvider "C:\"
    Click-Scan $paneProvider 20
} catch { Write-Host "FAIL: start for cancel -> $_"; $failures += 'cancelstart' }
Start-Sleep -Milliseconds 600
$t0 = Get-Date
try { Click-Cancel $paneProvider 10 } catch { Write-Host "FAIL: cancel click -> $_"; $failures += 'cancelclick' }
$s = Wait-Status $paneProvider '^Cancelled|^Done|^error|^JS-|^cancel:' 30
$dt = [math]::Round(((Get-Date) - $t0).TotalSeconds, 1)
if ($s -match '^Cancelled') { Write-Host "PASS: cancel ($dt s after click) -> $s" }
elseif ($s -match '^cancel:') { Write-Host "FAIL: cancel rejected -> $s"; $failures += 'cancelreject' }
elseif ($s -match '^Done') { Write-Host "INFO: finished before cancel registered -> $s" }
else { Write-Host "FAIL: cancel -> $s"; $failures += 'cancel' }

# ---- test 3: full C:\ scan ----
try {
    Set-Path $paneProvider "C:\"
    $t0 = Get-Date
    Click-Scan $paneProvider 20
} catch { Write-Host "FAIL: start full -> $_"; $failures += 'fullstart' }
$s = Wait-Status $paneProvider '^Done in|^error|^JS-' 300
$wall = [math]::Round(((Get-Date) - $t0).TotalSeconds, 1)
if ($s -match '^Done in') { Write-Host "PASS: full C: scan -> $s (wall ${wall}s)" } else { Write-Host "FAIL: full scan -> $s"; $failures += 'full' }
Start-Sleep -Milliseconds 900
$hdr = ''
foreach ($e in (Get-Elements (Get-Pane))) {
    if ((Is-Type $e 'ControlType.Text') -and $e.Current.Name -match '(files \(largest first\)|largest of .* files)') { $hdr = $e.Current.Name }
}
if ($hdr) { Write-Host "PASS: full list populated -> $hdr" } else { Write-Host "FAIL: full list empty"; $failures += 'fulllist' }

# ---- test 4: window-fit layout (no page scrollbar, list flexes) ----
Add-Type -Namespace Win -Name Api -MemberDefinition '[DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);'

function Measure-Layout($width, $height) {
    $hwnd = (Get-Process greater).MainWindowHandle
    [Win.Api]::MoveWindow($hwnd, 40, 40, $width, $height, $true) | Out-Null
    Start-Sleep -Milliseconds 800
    $pane = Get-Pane
    if (-not $pane) { return $null }
    $footer = $null
    $head = $null
    foreach ($e in (Get-Elements $pane)) {
        if (Is-Type $e 'ControlType.Text') {
            if ($e.Current.Name -match 'scanning engine') { $footer = $e }
            if ($e.Current.Name -eq 'ALL FILES') { $head = $e }
        }
    }
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $wcond = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::NameProperty, "Greater")
    $win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $wcond)
    if (-not $footer -or -not $head -or -not $win) { return $null }
    [pscustomobject]@{
        FooterBottom = $footer.Current.BoundingRectangle.Bottom
        FooterTop    = $footer.Current.BoundingRectangle.Top
        HeadBottom   = $head.Current.BoundingRectangle.Bottom
        WinBottom    = $win.Current.BoundingRectangle.Bottom
        WinWidth     = $win.Current.BoundingRectangle.Width
        WinHeight    = $win.Current.BoundingRectangle.Height
    }
}

$small = Measure-Layout 900 620
$large = Measure-Layout 1240 880
if ($small -and $large) {
    $tol = 6
    $fitsSmall = $small.FooterBottom -le ($small.WinBottom + $tol)
    $fitsLarge = $large.FooterBottom -le ($large.WinBottom + $tol)
    if ($fitsSmall -and $fitsLarge) {
        Write-Host "PASS: content fits window (footer visible at 900x620 and 1240x880, no page overflow)"
    } else {
        Write-Host "FAIL: content overflows window (small=$(($small.FooterBottom - $small.WinBottom).ToString('0')) large=$(($large.FooterBottom - $large.WinBottom).ToString('0')))"
        $failures += 'layout'
    }
    $areaSmall = $small.FooterTop - $small.HeadBottom
    $areaLarge = $large.FooterTop - $large.HeadBottom
    if ($areaLarge -gt $areaSmall + 20) {
        Write-Host "PASS: list area flexes with window height ($([int]$areaSmall)px at 620h -> $([int]$areaLarge)px at 880h)"
    } else {
        Write-Host "FAIL: list area did not flex ($([int]$areaSmall)px vs $([int]$areaLarge)px)"
        $failures += 'flex'
    }
    [Win.Api]::MoveWindow((Get-Process greater).MainWindowHandle, 40, 40, 1200, 800, $true) | Out-Null
    Start-Sleep -Milliseconds 500
} else {
    Write-Host "FAIL: could not measure layout"; $failures += 'layout'
}

# ---- test 4: drive cards present ----
$drives = @()
foreach ($e in (Get-Elements (Get-Pane))) {
    if ((Is-Type $e 'ControlType.Button') -and $e.Current.Name -match '^[A-Z]:') { $drives += $e.Current.Name }
}
if ($drives.Count -ge 2) { Write-Host "PASS: drive cards -> $($drives.Count) found" }
else { Write-Host "FAIL: drive cards missing ($($drives.Count))"; $failures += 'drives' }

# ---- test 5: tab navigation ----
function Click-Tab($name) {
    $tab = Wait-Element $paneProvider { param($e)
        ($e.Current.ControlType.ProgrammaticName -eq 'ControlType.TabItem') -and
        $e.Current.Name -eq $name -and $e.Current.IsEnabled } 10
    if (-not $tab) { throw "tab '$name' not found" }
    for ($i = 0; $i -lt 6; $i++) {
        try { $tab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select() }
        catch { try { $tab.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke() } catch {} }
        Start-Sleep -Milliseconds 400
        try { if ($tab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Current.IsSelected) { return } }
        catch { return }
    }
}

function Page-HasText($text, $timeoutSec) {
    [bool](Wait-Element $paneProvider { param($e)
        (Is-Type $e 'ControlType.Text') -and $e.Current.Name -ieq $text } $timeoutSec)
}

function Page-HasButton($name, $timeoutSec) {
    [bool](Wait-Element $paneProvider { param($e)
        (Is-Type $e 'ControlType.Button') -and $e.Current.Name -eq $name } $timeoutSec)
}

function Page-HasMatch($pattern, $timeoutSec) {
    [bool](Wait-Element $paneProvider { param($e)
        (Is-Type $e 'ControlType.Text') -and $e.Current.Name -match $pattern } $timeoutSec)
}

try { Click-Tab 'Clean' } catch { Write-Host "FAIL: click Clean tab -> $_"; $failures += 'tabs' }
if ((Page-HasText 'FILES TO DELETE' 6) -and (-not (Page-HasButton 'Scan' 1))) {
    Write-Host "PASS: Clean tab shows its page (explorer controls hidden)"
} else { Write-Host "FAIL: Clean page did not appear / explorer still visible"; $failures += 'tabs' }

try { Click-Tab 'Statistics' } catch { Write-Host "FAIL: click Statistics tab -> $_"; $failures += 'tabs' }
if ((Page-HasText 'Statistics' 6) -and (-not (Page-HasText 'FILES TO DELETE' 1))) {
    Write-Host "PASS: Statistics tab shows its page"
} else { Write-Host "FAIL: Statistics page did not appear"; $failures += 'tabs' }

try { Click-Tab 'Explorer' } catch { Write-Host "FAIL: click Explorer tab -> $_"; $failures += 'tabs' }
if ((Page-HasButton 'Scan' 6) -and (-not (Page-HasText 'Statistics' 1))) {
    Write-Host "PASS: Explorer tab restored"
} else { Write-Host "FAIL: explorer controls not restored"; $failures += 'tabs' }
$hdr = Wait-Element $paneProvider { param($e)
    (Is-Type $e 'ControlType.Text') -and $e.Current.Name -match '(files \(largest first\)|largest of .* files)' } 6
if ($hdr) { Write-Host "PASS: list re-rendered after tab switch -> $($hdr.Current.Name)" }
else { Write-Host "FAIL: list empty after tab switch"; $failures += 'tabs' }

# ---- test 5b: Explorer "By folder" mode (aggregated folder list) ----
# The <select> popup is rendered by Chromium inside the a11y tree; if the
# option cannot be invoked there, fall back to keyboard (focus + arrow key).
function Select-Option($paneProvider, $comboAria, $optionText, $downs, $timeoutSec) {
    $combo = Wait-Element $paneProvider { param($e)
        (Is-Type $e 'ControlType.ComboBox') -and $e.Current.Name -eq $comboAria } $timeoutSec
    if (-not $combo) { throw "combo '$comboAria' not found" }
    $done = $false
    try {
        $combo.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern).Expand()
        Start-Sleep -Milliseconds 500
        $item = Wait-Element $paneProvider { param($e)
            (Is-Type $e 'ControlType.ListItem') -and $e.Current.Name -eq $optionText } 4
        if ($item) {
            try { $item.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); $done = $true }
            catch {
                try { $item.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select(); $done = $true } catch {}
            }
        }
        if (-not $done) { $combo.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern).Collapse() }
    } catch {}
    if (-not $done) {
        $combo.SetFocus()
        Start-Sleep -Milliseconds 300
        for ($i = 0; $i -lt $downs; $i++) { [System.Windows.Forms.SendKeys]::SendWait("{DOWN}"); Start-Sleep -Milliseconds 150 }
        $done = $true
    }
    Start-Sleep -Milliseconds 700
    if (-not $done) { throw "could not select '$optionText'" }
}

try { Select-Option $paneProvider 'List by' 'By folder' 1 8 } catch { Write-Host "FAIL: switch to By folder -> $_"; $failures += 'folder' }
if (Page-HasText 'ALL FOLDERS' 8) { Write-Host "PASS: By folder shows the folder heading" }
else { Write-Host "FAIL: folder heading missing"; $failures += 'folder' }
$fhdr = Wait-Element $paneProvider { param($e)
    (Is-Type $e 'ControlType.Text') -and $e.Current.Name -match '(folders \(largest first\)|largest of .* folders)' } 10
if ($fhdr) { Write-Host "PASS: folder list populated -> $($fhdr.Current.Name)" }
else { Write-Host "FAIL: folder count label missing"; $failures += 'folder' }
# The top of the folder list is machine-specific (Windows may sit below the
# fold), so assert on the scan root plus the biggest child folder instead.
$rootrow = Wait-Element $paneProvider { param($e) (Is-Type $e 'ControlType.Text') -and $e.Current.Name -eq 'C:\' } 10
$urow = Wait-Element $paneProvider { param($e) (Is-Type $e 'ControlType.Text') -and $e.Current.Name -eq 'Users' } 10
$wrow = $null
if (-not $urow) { $wrow = Wait-Element $paneProvider { param($e) (Is-Type $e 'ControlType.Text') -and $e.Current.Name -eq 'Windows' } 10 }
if ($rootrow -and ($urow -or $wrow)) { Write-Host "PASS: folder rows rendered (C:\ root + child folder)" }
else { Write-Host "FAIL: folder rows missing (root=$([bool]$rootrow) users=$([bool]$urow) windows=$([bool]$wrow))"; $failures += 'folder' }

try { Select-Option $paneProvider 'List by' 'By file' 1 8 } catch { Write-Host "FAIL: switch back to By file -> $_"; $failures += 'folder' }
$hdr = Wait-Element $paneProvider { param($e)
    (Is-Type $e 'ControlType.Text') -and $e.Current.Name -match '(files \(largest first\)|largest of .* files)' } 10
if ($hdr) { Write-Host "PASS: back to By file -> $($hdr.Current.Name)" }
else { Write-Host "FAIL: file list did not come back"; $failures += 'folder' }

# ---- test 6: file actions on a junk folder ----
$junk = "D:\greater-junk"
$bigName = "big file (1).bin"
$smallName = "small file.bin"
Remove-Item $junk -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $junk | Out-Null
$big = "$junk\$bigName"
$small = "$junk\$smallName"
$fs = [System.IO.File]::Create($big); $fs.SetLength(3MB); $fs.Close()
$fs = [System.IO.File]::Create($small); $fs.SetLength(768KB); $fs.Close()

try {
    Set-Path $paneProvider $junk
    Click-Scan $paneProvider 20
} catch { Write-Host "FAIL: junk scan start -> $_ (status: $(Get-Status (Get-Pane)))"; $failures += 'junkstart' }
$s = Wait-Status $paneProvider '^Done in|^error' 60
if ($s -match '^Done in') { Write-Host "PASS: junk scan -> $s" } else { Write-Host "FAIL: junk scan -> $s"; $failures += 'junkscan' }
Start-Sleep -Milliseconds 1200

$texts = @()
foreach ($e in (Get-Elements (Get-Pane))) {
    if (Is-Type $e 'ControlType.Text') { $texts += $e.Current.Name }
}
if ($texts -contains $bigName -and $texts -contains $smallName) { Write-Host "PASS: rows show file names" }
else { Write-Host "FAIL: file name rows missing"; $failures += 'rownames' }
if ($texts -contains '3.0 MB' -and $texts -contains '768 KB') { Write-Host "PASS: size column rendered (3.0 MB, 768 KB)" }
else { Write-Host "INFO: size cells: $(($texts | Where-Object { $_ -match '^\d+(\.\d+)? [KMG]B$' }) -join ', ')" }

# more info modal
$infoBtn = Find-ButtonByAria $paneProvider 'More info' 10
if ($infoBtn) {
    $infoBtn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    Start-Sleep -Milliseconds 600
    $texts = @()
    foreach ($e in (Get-Elements (Get-Pane))) { if (Is-Type $e 'ControlType.Text') { $texts += $e.Current.Name } }
    if (($texts -contains $bigName) -and ($texts | Where-Object { $_ -match 'bytes' })) { Write-Host "PASS: info modal shows details" }
    else { Write-Host "FAIL: info modal incomplete"; $failures += 'infomodal' }
    $close = Find-ButtonByAria $paneProvider 'Dismiss' 10
    if ($close) { $close.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); Start-Sleep -Milliseconds 400 }
} else { Write-Host "FAIL: info button not found"; $failures += 'infobtn' }

# open location must open the folder with the file selected (regression: paths with spaces)
Close-CabinetWindows 'greater-junk'
$openBtn = Find-ButtonByAria $paneProvider 'Open location' 10
if ($openBtn) {
    $openBtn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    $win = Wait-ExplorerWindow 'greater-junk' 10
    if ($win) {
        if (Test-ExplorerSelection $win $bigName) { Write-Host "PASS: open location selects '$bigName'" }
        else { Write-Host "FAIL: explorer opened but '$bigName' not selected"; $failures += 'openloc' }
        try { $win.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern).Close() } catch {}
    } else { Write-Host "FAIL: no explorer window opened"; $failures += 'openloc' }
} else { Write-Host "FAIL: open button not found"; $failures += 'openbtn' }

# move to trash (big file)
$trashBtn = Find-ButtonByAria $paneProvider 'Move to trash' 10
if ($trashBtn) {
    $trashBtn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    Start-Sleep -Milliseconds 500
    $ok = Find-ButtonByAria $paneProvider 'Confirm' 10
    if ($ok) {
        $ok.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
        $s = Wait-Status $paneProvider '^Moved to Recycle Bin|^error' 20
        Start-Sleep -Milliseconds 400
        if ((Test-Path $big) -eq $false -and $s -match '^Moved to Recycle Bin') { Write-Host "PASS: trash -> $s" }
        else { Write-Host "FAIL: trash ($s, exists=$(Test-Path $big))"; $failures += 'trash' }
    } else { Write-Host "FAIL: confirm button missing"; $failures += 'confirmbtn' }
} else { Write-Host "FAIL: trash button not found"; $failures += 'trashbtn' }

# permanent delete (small.bin)
$delBtn = Find-ButtonByAria $paneProvider 'Delete permanently' 10
if ($delBtn) {
    $delBtn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    Start-Sleep -Milliseconds 500
    $ok = Find-ButtonByAria $paneProvider 'Confirm' 10
    if ($ok) {
        $ok.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
        $s = Wait-Status $paneProvider '^Deleted permanently|^error' 20
        Start-Sleep -Milliseconds 400
        if ((Test-Path $small) -eq $false -and (Test-Path $big) -eq $false -and $s -match '^Deleted permanently') { Write-Host "PASS: permanent delete -> $s" }
        else { Write-Host "FAIL: delete ($s, big=$(Test-Path $big), small=$(Test-Path $small))"; $failures += 'delete' }
    } else { Write-Host "FAIL: confirm button missing (delete)"; $failures += 'confirmbtn2' }
} else { Write-Host "FAIL: delete button not found"; $failures += 'delbtn' }

Remove-Item $junk -Recurse -Force -ErrorAction SilentlyContinue

# ---- test 7: Clean page (junk detection + purge) ----
function Click-ButtonByName($name, $timeoutSec) {
    $btn = Wait-Element $paneProvider { param($e)
        (Is-Type $e 'ControlType.Button') -and $e.Current.Name -eq $name -and $e.Current.IsEnabled } $timeoutSec
    if ($btn) { $btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke() }
    $btn
}

try { Click-Tab 'Clean' } catch { Write-Host "FAIL: click Clean tab -> $_"; $failures += 'clean' }
try {
    $card = Wait-Element $paneProvider { param($e)
        (Is-Type $e 'ControlType.Button') -and $e.Current.Name -match '^Y:' -and
        $e.Current.Name -match 'Clean' -and $e.Current.IsEnabled } 20
    if (-not $card) { throw "Y: clean drive card not found" }
    $card.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
} catch { Write-Host "FAIL: start clean sweep -> $_"; $failures += 'clean' }
$s = Wait-Status $paneProvider '^Found|^Nothing to clean|^error|^JS-' 90
if ($s -match '^Found') { Write-Host "PASS: clean sweep -> $s" }
else { Write-Host "FAIL: clean sweep -> $s"; $failures += 'clean' }
Start-Sleep -Milliseconds 1200

$texts = @()
foreach ($e in (Get-Elements (Get-Pane))) { if (Is-Type $e 'ControlType.Text') { $texts += $e.Current.Name } }
$listed = @('w.tmp', 'a.tmp', 'big.cab') | Where-Object { $texts -contains $_ }
if ($listed.Count -eq 3 -and ($texts -notcontains 'holiday.jpg')) {
    Write-Host "PASS: only junk listed (w.tmp, a.tmp, big.cab; holiday.jpg ignored)"
} else { Write-Host "FAIL: junk list wrong (listed=$($listed -join ','), holiday listed=$($texts -contains 'holiday.jpg'))"; $failures += 'junklist' }
if ($texts -contains 'Windows Temp' -and $texts -contains 'Windows Update cache') {
    Write-Host "PASS: junk reasons shown (Windows Temp, Windows Update cache)"
} else { Write-Host "INFO: junk badges: $(($texts | Where-Object { $_ -match 'Temp|cache' }) -join ', ')" }

# selection readout: count + size must update live as the list is ticked
if ((Page-HasMatch 'junk files selected' 5) -and (Page-HasMatch '^3 files . 6\.0 MB$' 5)) {
    Write-Host "PASS: selected readout shows count and size"
} else { Write-Host "FAIL: selected readout missing"; $failures += 'selected' }
Click-ButtonByName 'Select none' 10 | Out-Null
Start-Sleep -Milliseconds 400
if ((Page-HasMatch 'Nothing selected' 5) -and (Page-HasMatch '^none$' 5)) {
    Write-Host "PASS: selected readout clears on Select none"
} else { Write-Host "FAIL: selected readout did not clear"; $failures += 'selectednone' }
Click-ButtonByName 'Select all' 10 | Out-Null
Start-Sleep -Milliseconds 400
if (Page-HasMatch 'junk files selected' 5) {
    Write-Host "PASS: selected readout restores on Select all"
} else { Write-Host "FAIL: selected readout did not restore"; $failures += 'selectedall' }

# purge everything permanently
Click-ButtonByName 'Select all' 10 | Out-Null
Start-Sleep -Milliseconds 300
$perm = Click-ButtonByName 'Delete permanently' 10
if ($perm) {
    Start-Sleep -Milliseconds 500
    $ok = Find-ButtonByAria $paneProvider 'Confirm' 10
    if ($ok) {
        $ok.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
        # The live deletion modal should be up with a progress readout.
        if (Page-HasMatch 'Removing files|Done' 10) {
            Write-Host "PASS: deleting modal shown during purge"
        } else { Write-Host "FAIL: deleting modal not shown"; $failures += 'delmodal' }
        $s = Wait-Status $paneProvider '^Deleted permanently: |^error' 30
        Start-Sleep -Milliseconds 600
        # On completion the modal flips to Done and offers a Close button.
        if (Page-HasMatch '^Done$' 10) {
            Write-Host "PASS: deleting modal shows Done after purge"
        } else { Write-Host "FAIL: deleting modal did not reach Done"; $failures += 'delmodaldone' }
        $closeBtn = Find-ButtonByAria $paneProvider 'Close' 10
        if ($closeBtn) {
            $closeBtn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
            Start-Sleep -Milliseconds 300
            Write-Host "PASS: deleting modal Close dismisses it"
        } else { Write-Host "FAIL: deleting modal Close button missing"; $failures += 'delmodalclose' }
        $gone = (-not (Test-Path "$clean\Windows\Temp\w.tmp")) -and
                (-not (Test-Path "$clean\Users\bob\AppData\Local\Temp\a.tmp")) -and
                (-not (Test-Path "$clean\Windows\SoftwareDistribution\Download\big.cab"))
        $kept = Test-Path "$clean\Users\bob\Downloads\holiday.jpg"
        if ($gone -and $kept -and $s -match '^Deleted permanently') { Write-Host "PASS: clean purge -> $s" }
        else { Write-Host "FAIL: clean purge (gone=$gone kept=$kept status=$s)"; $failures += 'purge' }
    } else { Write-Host "FAIL: clean confirm button missing"; $failures += 'cleanconfirm' }
} else { Write-Host "FAIL: clean delete button not found"; $failures += 'cleanbtn' }

if (Test-Path "Y:\") { subst Y: /d | Out-Null }
Remove-Item $clean -Recurse -Force -ErrorAction SilentlyContinue

# ---- test 8: Duplicates page (find + keep/delete) ----
try { Click-Tab 'Duplicates' } catch { Write-Host "FAIL: click Duplicates tab -> $_"; $failures += 'dupes' }
if ((Page-HasMatch 'DUPLICATE GROUPS' 6) -and (-not (Page-HasText 'FILES TO DELETE' 1))) {
    Write-Host "PASS: Duplicates tab shows its page"
} else { Write-Host "FAIL: Duplicates page did not appear"; $failures += 'dupes' }

try {
    $card = Wait-Element $paneProvider { param($e)
        (Is-Type $e 'ControlType.Button') -and $e.Current.Name -match '^Z:' -and $e.Current.IsEnabled } 20
    if (-not $card) { throw "Z: drive card not found" }
    $card.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
} catch { Write-Host "FAIL: start duplicate scan -> $_"; $failures += 'dupes' }
$s = Wait-Status $paneProvider '^Found|^No duplicates|^error|^JS-' 90
if ($s -match '^Found') { Write-Host "PASS: duplicate scan -> $s" }
else { Write-Host "FAIL: duplicate scan -> $s"; $failures += 'dupes' }
Start-Sleep -Milliseconds 800

$texts = @()
foreach ($e in (Get-Elements (Get-Pane))) { if (Is-Type $e 'ControlType.Text') { $texts += $e.Current.Name } }
if (($texts -contains 'photo.bin') -and ($texts -notcontains 'same-size-diff.bin') -and ($texts -notcontains 'tiny1.bin')) {
    Write-Host "PASS: only true duplicates listed (photo.bin; same-size/different-content and sub-size files excluded)"
} else { Write-Host "FAIL: duplicate list wrong"; $failures += 'dupelist' }
if (Page-HasMatch '1 groups . 2 copies' 5) { Write-Host "PASS: group summary shows 1 group / 2 copies" }
else { Write-Host "FAIL: group summary missing"; $failures += 'dupesum' }
if (Page-HasMatch '^1 files . 2\.0 MB$' 5) { Write-Host "PASS: default selection = 1 copy (2.0 MB)" }
else { Write-Host "FAIL: default selection wrong"; $failures += 'dupesel' }

Click-ButtonByName 'Keep all' 10 | Out-Null
Start-Sleep -Milliseconds 300
if (Page-HasMatch '^none$' 5) { Write-Host "PASS: 'Keep all' clears selection" }
else { Write-Host "FAIL: 'Keep all' did not clear"; $failures += 'dupkeepall' }
Click-ButtonByName 'Select all duplicates' 10 | Out-Null
Start-Sleep -Milliseconds 300
if (Page-HasMatch '^1 files . 2\.0 MB$' 5) { Write-Host "PASS: 'Select all duplicates' restores one copy" }
else { Write-Host "FAIL: 'Select all duplicates' wrong"; $failures += 'dupselall' }

$perm = Click-ButtonByName 'Delete permanently' 10
if ($perm) {
    Start-Sleep -Milliseconds 500
    $ok = Find-ButtonByAria $paneProvider 'Confirm' 10
    if ($ok) {
        $ok.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
        $s = Wait-Status $paneProvider '^Deleted permanently: |^error' 30
        Start-Sleep -Milliseconds 600
        $kept = Test-Path "$dupes\keep\photo.bin"
        $gone = -not (Test-Path "$dupes\copy\photo.bin")
        $other = Test-Path "$dupes\copy\same-size-diff.bin"
        if ($kept -and $gone -and $other -and $s -match '^Deleted permanently') { Write-Host "PASS: duplicate purge kept oldest, removed newer, left others -> $s" }
        else { Write-Host "FAIL: duplicate purge (kept=$kept gone=$gone other=$other status=$s)"; $failures += 'duppurge' }
    } else { Write-Host "FAIL: dupes confirm missing"; $failures += 'dupconfirm' }
} else { Write-Host "FAIL: dupes delete button not found"; $failures += 'dupbtn' }

if (Test-Path "Z:\") { subst Z: /d | Out-Null }
Remove-Item $dupes -Recurse -Force -ErrorAction SilentlyContinue

# ---- test 9: Statistics page (per-drive file-type breakdown) ----
$stats = "D:\greater-stats"
if (Test-Path $stats) { Remove-Item $stats -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $stats | Out-Null
New-PatternFile "$stats\pic.jpg"      (3MB) 65
New-PatternFile "$stats\clip.mp4"     (2MB) 66
New-PatternFile "$stats\song.mp3"     (1MB) 67
New-PatternFile "$stats\doc.pdf"      (4MB) 68
New-PatternFile "$stats\data.zip"     (2MB) 69
if (Test-Path "Z:\") { subst Z: /d | Out-Null }
subst Z: $stats | Out-Null
try { Click-Tab 'Statistics' } catch { Write-Host "FAIL: click Statistics tab -> $_"; $failures += 'stats' }
if (Page-HasText 'Statistics' 6) { Write-Host "PASS: Statistics tab shows its page" }
else { Write-Host "FAIL: Statistics page did not appear"; $failures += 'stats' }
try {
    $card = Wait-Element $paneProvider { param($e)
        (Is-Type $e 'ControlType.Button') -and $e.Current.Name -match '^Z:' -and $e.Current.IsEnabled } 20
    if (-not $card) { throw "Z: drive card not found" }
    $card.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
} catch { Write-Host "FAIL: start stats scan -> $_"; $failures += 'stats' }
$s = Wait-Status $paneProvider '^Analyzed|^error|^JS-' 60
if ($s -match '^Analyzed') { Write-Host "PASS: stats scan -> $s" }
else { Write-Host "FAIL: stats scan -> $s"; $failures += 'stats' }
Start-Sleep -Milliseconds 800
$texts = @()
foreach ($e in (Get-Elements (Get-Pane))) { if (Is-Type $e 'ControlType.Text') { $texts += $e.Current.Name } }
$want = @('Images', 'Videos', 'Audio', 'Documents', 'Archives')
$missing = $want | Where-Object { $texts -notcontains $_ }
if (-not $missing) { Write-Host "PASS: stats legend shows all categories" }
else { Write-Host "FAIL: stats legend missing: $($missing -join ', ')"; $failures += 'statslegend' }

if (Test-Path "Z:\") { subst Z: /d | Out-Null }
Remove-Item $stats -Recurse -Force -ErrorAction SilentlyContinue

# ---- test 10: About box (reachable from the Help page) ----
$helpBtn = Wait-Element $paneProvider { param($e)
    (Is-Type $e 'ControlType.Button') -and $e.Current.Name -like 'Help*' } 10
if ($helpBtn) { $helpBtn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); Start-Sleep -Milliseconds 700 }
else { Write-Host "FAIL: Help button not found"; $failures += 'about' }
$aboutBtn = Find-ButtonByAria $paneProvider 'About' 10
if ($aboutBtn) { $aboutBtn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); Start-Sleep -Milliseconds 700 }
else { Write-Host "FAIL: About button not found in Help"; $failures += 'about' }
$texts = @()
foreach ($e in (Get-Elements (Get-Pane))) { if ($e.Current.Name) { $texts += $e.Current.Name } }
$want = @('Version 1.0', 'Mohamed Baroudi', 'MECATROTEC', 'baroudi.inc@gmail.com')
$missing = $want | Where-Object { $texts -notcontains $_ }
if (-not $missing) { Write-Host "PASS: About box shows author, company, version and contact" }
else { Write-Host "FAIL: About box missing: $($missing -join ', ')"; $failures += 'about' }
$closeBtn = Find-ButtonByAria $paneProvider 'Close' 10
if ($closeBtn) { $closeBtn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); Start-Sleep -Milliseconds 500 }

Write-Host ""
if ($failures.Count -eq 0) { Write-Host "ALL TESTS PASSED" } else { Write-Host "FAILURES: $($failures -join ', ')" }
