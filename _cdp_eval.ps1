# Headless-Edge CDP driver: load a URL, evaluate a JS expression, print the result.
# Usage: powershell -File _cdp_eval.ps1 -Url <url> -Expr <js> [-WaitMs 1500]
param(
  [Parameter(Mandatory=$true)][string]$Url,
  [Parameter(Mandatory=$true)][string]$Expr,
  [int]$WaitMs = 1500
)
$ErrorActionPreference = 'Stop'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$port = 9222
$prof = Join-Path $env:TEMP ('mcgen_cdp_' + [guid]::NewGuid().ToString('N'))

$args = @(
  '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port=' + $port, '--user-data-dir=' + $prof, $Url
)
$proc = Start-Process -FilePath $edge -ArgumentList $args -PassThru -WindowStyle Hidden

try {
  # Wait for a page target to appear.
  $ws = $null
  for ($i = 0; $i -lt 50; $i++) {
    Start-Sleep -Milliseconds 200
    try {
      $targets = Invoke-RestMethod -Uri ("http://127.0.0.1:$port/json/list") -TimeoutSec 2
      $page = $targets | Where-Object { $_.type -eq 'page' -and $_.webSocketDebuggerUrl } | Select-Object -First 1
      if ($page) { $ws = $page.webSocketDebuggerUrl; break }
    } catch {}
  }
  if (-not $ws) { throw 'No DevTools page target found' }

  # Let the page's synchronous load scripts run.
  Start-Sleep -Milliseconds $WaitMs

  $client = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [System.Threading.CancellationToken]::None
  $client.ConnectAsync([Uri]$ws, $ct).Wait()

  function Send-Cmd($obj) {
    $json = $obj | ConvertTo-Json -Compress -Depth 10
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $seg = New-Object System.ArraySegment[byte] (,$bytes)
    $client.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
  }
  function Recv {
    $buf = New-Object byte[] 65536
    $sb = New-Object System.Text.StringBuilder
    do {
      $seg = New-Object System.ArraySegment[byte] (,$buf)
      $res = $client.ReceiveAsync($seg, $ct)
      $res.Wait()
      [void]$sb.Append([System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Result.Count))
    } while (-not $res.Result.EndOfMessage)
    return $sb.ToString()
  }

  $expr = $Expr + ';'
  Send-Cmd @{ id = 1; method = 'Runtime.evaluate'; params = @{ expression = $expr; returnByValue = $true; awaitPromise = $true } }
  for ($i = 0; $i -lt 30; $i++) {
    $msg = Recv
    if ($msg -match '"id"\s*:\s*1\b') {
      $parsed = $msg | ConvertFrom-Json
      if ($parsed.result.result.value -ne $null) { Write-Output $parsed.result.result.value }
      elseif ($parsed.result.exceptionDetails) { Write-Output ('JS-EXCEPTION: ' + ($parsed.result.exceptionDetails | ConvertTo-Json -Compress)) }
      else { Write-Output ('RAW: ' + $msg) }
      break
    }
  }
  $client.Dispose()
}
finally {
  try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
  Start-Sleep -Milliseconds 200
  Remove-Item -Recurse -Force $prof -ErrorAction SilentlyContinue
}
