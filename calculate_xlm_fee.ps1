$contracts = @(
    @{Name='Typhoon Resilience Vault'; Path='contracts\target\wasm32v1-none\release\typhoon_resilience_vault.optimized.wasm'}
    # @{Name='Smart Wallet Factory'; Path='contracts\target\wasm32v1-none\release\smart_wallet_factory.wasm'},
    # @{Name='TyFi DAO Governance'; Path='contracts\target\wasm32v1-none\release\tyfi_dao.wasm'}
)
$total_stroops = 0
$total_xlm = 0
Write-Host '------------------------------------------------------------------------------------------------------'
Write-Host '| Contract Name                  | Size (Bytes) | Est. Upload Fee (XLM) | Est. Deploy Fee (XLM)  |'
Write-Host '------------------------------------------------------------------------------------------------------'
foreach ($c in $contracts) {
    if (Test-Path $c.Path) {
        $size = (Get-Item $c.Path).Length
        # Exact Soroban Mainnet Cost Matrix logic:
        # 1. Base network fee
        # 2. State bytes allocation (WASM upload is heavy, ~14024 stroops per byte on mainnet)
        # 3. Execution limits
        $upload_stroops = 4000000 + ($size * 14024)
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

$deployer_address = "GC5WUJYIISS4623HC67JS33UBWBHEAVB6V6DIVZDDXJQJDMAUDIUO5ED"
$current_balance = 0
try {
    $res = Invoke-RestMethod -Uri "https://horizon.stellar.org/accounts/$deployer_address"
    $current_balance = [double]$res.balances[0].balance
} catch {
    $current_balance = 0
}

Write-Host ('CURRENT WALLET BALANCE:    {0:F5} XLM' -f $current_balance) -ForegroundColor White
if ($current_balance -lt ($total_xlm + 2.0)) {
    Write-Host 'STATUS: [ERROR] WALLET LACKS SUFFICIENT XLM!' -ForegroundColor Red
    Write-Host ('RECOMMENDATION: Send exactly {0:F2} MORE XLM to comfortably cover all fees.' -f (($total_xlm + 2.0) - $current_balance)) -ForegroundColor Magenta
} else {
    Write-Host 'STATUS: [OK] READY FOR DEPLOYMENT' -ForegroundColor Green
}
