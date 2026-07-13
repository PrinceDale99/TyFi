$envLines = Get-Content frontend\.env | Where-Object { $_ -match '=' }
foreach ($line in $envLines) {
    $parts = $line -split '=', 2
    $key = $parts[0].Trim()
    $val = $parts[1].Trim()
    if ($key) {
        Write-Host "Adding $key to production..."
        $val | npx vercel env add $key production
        Write-Host "Adding $key to preview..."
        $val | npx vercel env add $key preview
    }
}
Write-Host "Done!"
