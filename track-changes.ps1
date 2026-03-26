# Claude Code Change Tracker - Supabase + Local Backup
# Run: powershell -ExecutionPolicy Bypass -File track-changes.ps1

$watchPaths = @(
    "c:\Users\ajimenez\Downloads\MAC-M2M-Assistant"
)

# Load local env if it exists (keys kept out of git)
$envFile = Join-Path $PSScriptRoot ".tracker-env.ps1"
if (Test-Path $envFile) { . $envFile }
$supabaseUrl = $env:SUPABASE_URL
$supabaseKey = $env:SUPABASE_SERVICE_KEY
$diffContextLines = 5
$logDirectory = "$env:USERPROFILE\claude-change-logs"

if (-not (Test-Path $logDirectory)) {
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
}

function Send-ToSupabase {
    param(
        [string]$ProjectName,
        [string]$CommitHash,
        [string]$CommitMessage,
        [string]$DiffContent,
        [string[]]$FilesChanged,
        [string]$Author
    )
    $today = Get-Date -Format "yyyy-MM-dd"
    $ts = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
    $body = @{
        date           = $today
        timestamp      = $ts
        project        = $ProjectName
        commit_hash    = $CommitHash
        commit_message = $CommitMessage
        diff           = $DiffContent
        files_changed  = $FilesChanged
        author         = $Author
        reviewed       = $false
        notes          = ""
    } | ConvertTo-Json -Depth 5
    $headers = @{
        "apikey"        = $supabaseKey
        "Authorization" = "Bearer $supabaseKey"
        "Content-Type"  = "application/json"
        "Prefer"        = "return=minimal"
    }
    try {
        Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/code_changes" -Method POST -Headers $headers -Body $body
        Write-Host "  -> Pushed to Supabase" -ForegroundColor Green
    } catch {
        Write-Host "  -> Supabase error: $_" -ForegroundColor Red
    }
}

function Save-LocalBackup {
    param(
        [string]$ProjectName,
        [string]$CommitHash,
        [string]$CommitMessage,
        [string]$DiffContent,
        [string[]]$FilesChanged,
        [string]$Author
    )
    $d = Get-Date -Format "yyyy-MM-dd"
    $logPath = Join-Path $logDirectory "changes-$d.json"
    $entry = @{
        id            = [guid]::NewGuid().ToString().Substring(0, 8)
        timestamp     = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
        project       = $ProjectName
        commitHash    = $CommitHash
        commitMessage = $CommitMessage
        diff          = $DiffContent
        filesChanged  = $FilesChanged
        author        = $Author
        reviewed      = $false
        notes         = ""
    }
    if (Test-Path $logPath) {
        try { $log = Get-Content $logPath -Raw | ConvertFrom-Json }
        catch { $log = @{ date = $d; entries = @() } }
    } else {
        $log = @{ date = $d; entries = @() }
    }
    $entries = [System.Collections.ArrayList]@()
    if ($log.entries) { foreach ($e in $log.entries) { $entries.Add($e) | Out-Null } }
    $entries.Add($entry) | Out-Null
    @{ date = $d; entries = $entries } | ConvertTo-Json -Depth 10 | Set-Content $logPath -Encoding UTF8
}

function Get-LatestCommitInfo {
    param([string]$RepoPath)
    Push-Location $RepoPath
    try {
        $hash    = git log -1 --format="%H" 2>$null
        $short   = git log -1 --format="%h" 2>$null
        $msg     = git log -1 --format="%s" 2>$null
        $auth    = git log -1 --format="%an" 2>$null
        $filesRaw = git diff-tree --no-commit-id --name-only -r HEAD 2>$null
        $diffRaw  = git diff HEAD~1 HEAD --unified=$diffContextLines 2>$null
        if (-not $diffRaw) { $diffRaw = git show HEAD --format="" --unified=$diffContextLines 2>$null }
        # Pipe through Out-String to get a single string with real newlines preserved
        $diffStr = if ($diffRaw) { ($diffRaw | Out-String).TrimEnd() } else { "(no diff available)" }
        $filesArr = if ($filesRaw -is [array]) { $filesRaw } elseif ($filesRaw) { @($filesRaw) } else { @() }
        return @{
            Hash    = $hash
            Short   = $short
            Message = $msg
            Author  = $auth
            Files   = $filesArr
            Diff    = $diffStr
        }
    } finally { Pop-Location }
}

$lastSeenCommits = @{}
foreach ($path in $watchPaths) {
    if (Test-Path (Join-Path $path ".git")) {
        Push-Location $path
        $lastSeenCommits[$path] = git log -1 --format="%H" 2>$null
        Pop-Location
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host "  Code Study Tracker - Live to Supabase"   -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Watching:" -ForegroundColor White
foreach ($p in $watchPaths) {
    $n = Split-Path $p -Leaf
    Write-Host "  -> $n ($p)" -ForegroundColor Gray
}
Write-Host ""
Write-Host "Logs: $logDirectory" -ForegroundColor White
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

while ($true) {
    foreach ($repoPath in $watchPaths) {
        if (-not (Test-Path (Join-Path $repoPath ".git"))) { continue }
        Push-Location $repoPath
        $currentHash = git log -1 --format="%H" 2>$null
        Pop-Location
        if ($currentHash -and $currentHash -ne $lastSeenCommits[$repoPath]) {
            $projectName = Split-Path $repoPath -Leaf
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] New commit in $projectName!" -ForegroundColor Green
            $info = Get-LatestCommitInfo -RepoPath $repoPath
            $p = @{
                ProjectName   = $projectName
                CommitHash    = $info.Short
                CommitMessage = $info.Message
                DiffContent   = $info.Diff
                FilesChanged  = $info.Files
                Author        = $info.Author
            }
            Send-ToSupabase @p
            Save-LocalBackup @p
            $m = $info.Message
            Write-Host "  Logged: $m" -ForegroundColor Cyan
            $lastSeenCommits[$repoPath] = $currentHash
        }
    }
    Start-Sleep -Seconds 5
}
