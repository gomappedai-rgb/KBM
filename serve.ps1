# Minimal static file server for local development (no Node/Python needed).
# Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1   ->  http://localhost:8080
param([int]$Port = 8080)

$root = $PSScriptRoot
$types = @{
  ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8";   ".json" = "application/json"
  ".svg" = "image/svg+xml";             ".png" = "image/png"; ".ico" = "image/x-icon"
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Teacher Hub running at http://localhost:$Port  (Ctrl+C to stop)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart("/")
      if ($path -eq "") { $path = "index.html" }
      $file = [System.IO.Path]::GetFullPath((Join-Path $root $path))

      if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [System.IO.Path]::GetExtension($file).ToLower()
        $ctx.Response.ContentType = if ($types[$ext]) { $types[$ext] } else { "application/octet-stream" }
        $ctx.Response.Headers["Cache-Control"] = "no-cache"
        $ctx.Response.ContentLength64 = $bytes.Length
        if ($ctx.Request.HttpMethod -ne "HEAD") {
          $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
      } else {
        $ctx.Response.StatusCode = 404
      }
    } catch {
      Write-Warning $_
    } finally {
      $ctx.Response.Close()
    }
  }
} finally {
  $listener.Stop()
}
