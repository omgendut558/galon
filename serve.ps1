$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://127.0.0.1:8080/')
$listener.Start()
Write-Host "Server listening at http://127.0.0.1:8080/"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response
    
    $localPath = $req.Url.LocalPath
    if ($localPath -eq '/') { $localPath = '/index.html' }
    
    $filePath = "c:\Users\DEDE\Documents\galon" + $localPath.Replace('/', '\')
    
    if (Test-Path $filePath -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        if ($filePath.EndsWith('.html')) { $res.ContentType = 'text/html; charset=utf-8' }
        elseif ($filePath.EndsWith('.css')) { $res.ContentType = 'text/css' }
        elseif ($filePath.EndsWith('.js')) { $res.ContentType = 'application/javascript' }
        elseif ($filePath.EndsWith('.json')) { $res.ContentType = 'application/json' }
        
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $res.StatusCode = 404
    }
    $res.OutputStream.Close()
}
