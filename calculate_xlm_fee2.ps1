$contracts = @(
    @{Name='Typhoon Resilience Vault'; Path='contracts\target\wasm32v1-none\release\typhoon_resilience_vault.optimized.wasm'},
    @{Name='Smart Wallet Factory'; Path='contracts\target\wasm32v1-none\release\smart_wallet_factory.wasm'},
    @{Name='TyFi DAO Governance'; Path='contracts\target\wasm32v1-none\release\tyfi_dao.wasm'}
)
$total_stroops = 0
$total_xlm = 0
Write-Host '------------------------------------------------------------------------------------------------------'
Write-Host '| Contract Name                  | Size (Bytes) | Est. Upload Fee (XLM) | Est. Deploy Fee (XLM)  |'
Write-Host '------------------------------------------------------------------------------------------------------'
foreach ($c in $contracts) {
    if (Test-Path $c.Path) {
        $size = (Get-Item $c.Path).Length
        # Adjusted Soroban Mainnet Cost Matrix logic for higher provision buffers
        $upload_stroops = 4000000 + ($size * 4500)
        $deploy_stroops = 2500000
        $total_contract_stroops = $upload_stroops + $deploy_stroops
        $total_stroops += $total_contract_stroops
        $upload_xlm = $upload_stroops / 10000000
        $deploy_xlm = $deploy_stroops / 10000000
        Write-Host ('| {0,-30} | {1,-12} | {2,-21:F5} | {3,-22:F5} |' -f $c.Name, $size, $upload_xlm, $deploy_xlm)
    } else {
        Write-Host ('| {0,-30} | {1,-12} | {2,-21} | {3,-22} |' -f $c.Name, 'MISSING', 'N/A', 'N/A') -ForegroundColor Red
    }
}
Write-Host '------------------------------------------------------------------------------------------------------'
$total_xlm = $total_stroops / 10000000
Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ('  TOTAL NETWORK FEE:       {0:N0} STROOPS' -f $total_stroops) -ForegroundColor Yellow
Write-Host ('  TOTAL REQUIRED BALANCE:  {0:F5} XLM' -f $total_xlm) -ForegroundColor Green
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'RECOMMENDATION: Send exactly 20.00 XLM to your Mainnet Deployer wallet to comfortably cover all fees, plus the maximum initial storage allocations required during the initialization of the vault.' -ForegroundColor Magenta
