$content = Get-Content -Path 'c:\Users\errorscript\.gemini\antigravity\scratch\invoice-system\duid-JPM\frontend\assets\logo.txt' -Raw
if ($content) {
    # Remove whitespace/newlines from ends
    $b64 = $content.Trim()
    # Write as single line JS variable
    $js = "window.JPM_LOGO_BASE64 = 'data:image/png;base64," + $b64 + "';"
    Set-Content -Path 'c:\Users\errorscript\.gemini\antigravity\scratch\invoice-system\duid-JPM\frontend\assets\logo-data.js' -Value $js -Encoding UTF8
    Write-Host "Logo JS file created."
} else {
    Write-Host "Logo text file empty or not found."
}
