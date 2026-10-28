# 轮询等待 GitHub Pages 生效，一旦 200 就跑线上验收
$ErrorActionPreference = 'Continue'
$site = 'https://liaohailin88.github.io/pinyin-kid/'
$api  = 'https://api.github.com/repos/liaohailin88/pinyin-kid'
$h    = @{ 'User-Agent' = 'dsh-poll' }
$deadline = (Get-Date).AddMinutes(20)
$i = 0

while ((Get-Date) -lt $deadline) {
  $i++
  $hasPages = $null
  try { $hasPages = (Invoke-RestMethod -Uri $api -Headers $h -TimeoutSec 15).has_pages } catch { $hasPages = 'err' }
  $code = curl.exe -sS -m 15 -o NUL -w "%{http_code}" $site 2>$null
  "[{0}] t+{1}s has_pages={2} url={3}" -f (Get-Date -Format 'HH:mm:ss'), ($i * 15), $hasPages, $code

  if ($code -eq '200') {
    "== LIVE (direct) =="
    Push-Location 'F:\harness0916\pinyin-kid'
    $out = node scripts/e2e-live.js $site 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
      "-- direct failed, retry via proxy --"
      $out = node scripts/e2e-live.js $site 'http://127.0.0.1:7890' 2>&1 | Out-String
    }
    Pop-Location
    $out
    exit 0
  }
  Start-Sleep -Seconds 15
}

"== TIMEOUT: Pages 20 分钟内没有生效 =="
exit 1
