# 拼音星球 · 局域网小服务器
# 用途：让平板 / 手机通过 http://电脑IP:8000 打开（比直接双击 index.html 更稳）
param([int]$Port = 8000)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Get-LanIp {
  $c = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
       Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
       Sort-Object -Property { $_.InterfaceAlias -match 'Wi-?Fi|以太网|Ethernet' } -Descending
  if ($c) { return $c[0].IPAddress }
  return '127.0.0.1'
}

$ip = Get-LanIp
Write-Host ''
Write-Host '  拼音星球已启动' -ForegroundColor Green
Write-Host "  本机访问：  http://localhost:$Port" -ForegroundColor Cyan
Write-Host "  平板/手机： http://${ip}:$Port   （需在同一 WiFi 下）" -ForegroundColor Cyan
Write-Host ''
Write-Host '  按 Ctrl+C 停止' -ForegroundColor DarkGray
Write-Host ''

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://+:$Port/")
try {
  $listener.Start()
} catch {
  Write-Host "  以管理员身份绑定失败，退回 localhost 模式（平板可能访问不了）" -ForegroundColor Yellow
  $listener = [System.Net.HttpListener]::new()
  $listener.Prefixes.Add("http://localhost:$Port/")
  $listener.Start()
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
  '.woff2'= 'font/woff2'
  '.md'   = 'text/plain; charset=utf-8'
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch { break }

  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
    $full = Join-Path $root $rel
    $full = [System.IO.Path]::GetFullPath($full)

    if (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403; $res.Close(); continue
    }
    if (Test-Path -LiteralPath $full -PathType Container) {
      $full = Join-Path $full 'index.html'
    }
    if (Test-Path -LiteralPath $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', 'no-cache')
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $body = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found: ' + $rel)
      $res.ContentLength64 = $body.Length
      $res.OutputStream.Write($body, 0, $body.Length)
    }
  } catch {
    $res.StatusCode = 500
  } finally {
    try { $res.Close() } catch { }
  }
}
