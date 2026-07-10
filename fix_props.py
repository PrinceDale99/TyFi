import re

with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'userLpBalance={userLpBalance}',
    'userLpBalance={String(userLpBalance)}'
)

content = content.replace(
    'onAddLiquidity={handleAddLiquidity}',
    "onAddLiquidity={(amount) => { setFundingAmount(Number(amount)); handleContributeLiquidity('lp'); }}"
)

content = content.replace(
    'onWithdrawLiquidity={handleWithdrawLiquidity}',
    "onWithdrawLiquidity={(amount) => { setFundingAmount(Number(amount)); setStakingMode('withdraw'); handleContributeLiquidity('lp'); }}"
)

with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed type errors.")
