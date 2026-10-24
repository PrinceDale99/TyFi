import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Lock, ShieldCheck, Wind, XCircle } from 'lucide-react';
import type { FarmData } from '../types';
import { claimPayoutOnChain, isUserRejection } from '../lib/stellar';
import { explorerTxUrl, getClaimedPayoutStroops, requestZkWeatherProof, type ZkWeatherResult } from '../lib/zkOracle';

/** Season the app subscribes policies under (registerPolicyOnChain default). */
const POLICY_SEASON = 'Wet Season 2026';
const STROOPS_PER_XLM = 10_000_000n;

const SIGNAL_LABELS = ['Oracle key hash', 'Typhoon id', 'Region id', 'Wind floor (km/h)', 'Damage (%)'];

type Stage = 'idle' | 'proving' | 'verified' | 'claiming' | 'paid' | 'error';

const short = (h: string, n = 10) => (h.length > 2 * n ? `${h.slice(0, n)}…${h.slice(-n)}` : h);
const sym = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 32);

interface Props {
  farms: FarmData[];
  walletAddress: string | null;
  addNotification: (msg: string, type: 'success' | 'warning' | 'info') => void;
  onPaid?: (farm: FarmData, xlm: number, txHash: string) => void;
}

/**
 * Testnet ZK payout: the oracle proves (Groth16) that a signed wind reading
 * cleared a payout band, the vault verifies the proof with a BN254 pairing
 * check, and the farmer claims against the resulting on-chain consensus.
 */
export const ZkPayoutPanel: React.FC<Props> = ({ farms, walletAddress, addNotification, onPaid }) => {
  const [farmId, setFarmId] = useState(farms[0]?.id ?? '');
  const [typhoonId, setTyphoonId] = useState('ODETTE_2026');
  const [windSpeed, setWindSpeed] = useState(172);
  const [damage, setDamage] = useState(85);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<ZkWeatherResult | null>(null);
  const [claim, setClaim] = useState<{ txHash: string; xlm: number | null } | null>(null);

  const farm = farms.find(f => f.id === farmId) ?? farms[0];

  const prove = async () => {
    if (!farm) return;
    setStage('proving');
    setError(null);
    setVerified(null);
    setClaim(null);
    try {
      const result = await requestZkWeatherProof({ typhoonId, region: farm.region, windSpeed, damagePercentage: damage });
      setVerified(result);
      setStage('verified');
      addNotification(`Groth16 proof verified on-chain in ledger ${result.zk.ledger}`, 'success');
    } catch (e: any) {
      setError(e.message);
      setStage('error');
    }
  };

  const claimPayout = async () => {
    if (!farm || !walletAddress || !verified) return;
    setStage('claiming');
    setError(null);
    try {
      const txHash = await claimPayoutOnChain(walletAddress, farm.id, POLICY_SEASON, 'testnet', verified.typhoonId);
      const stroops = await getClaimedPayoutStroops(txHash).catch(() => null);
      const xlm = stroops === null ? null : Number(stroops) / Number(STROOPS_PER_XLM);
      setClaim({ txHash, xlm });
      setStage('paid');
      if (xlm !== null) onPaid?.(farm, xlm, txHash);
    } catch (e: any) {
      setError(isUserRejection(e) ? 'Claim cancelled in your wallet.' : e.message);
      setStage('verified');
    }
  };

  if (!farms.length) {
    return (
      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 text-sm text-slate-400">
        Register and insure a farm first — the proof is checked against your policy's region.
      </div>
    );
  }

  const busy = stage === 'proving' || stage === 'claiming';

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center">
            <Wind size={20} />
          </div>
          <div>
            <div className="text-sm font-black text-white">1 · Oracle weather reading</div>
            <div className="text-xs text-slate-400">The raw wind speed stays with the oracle. Only the payout band it clears is published.</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Insured farm</span>
            <select value={farm?.id} onChange={e => setFarmId(e.target.value)} disabled={busy}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
              {farms.map(f => <option key={f.id} value={f.id}>{f.farmName} — {f.region}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Typhoon</span>
            <input value={typhoonId} onChange={e => setTyphoonId(e.target.value)} disabled={busy}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest font-black text-slate-500 flex items-center gap-1">
              <Lock size={10} /> Observed wind (private) · {windSpeed} km/h
            </span>
            <input type="range" min={60} max={250} value={windSpeed} onChange={e => setWindSpeed(Number(e.target.value))} disabled={busy}
              className="w-full accent-sky-400" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Assessed damage · {damage}%</span>
            <input type="range" min={1} max={100} value={damage} onChange={e => setDamage(Number(e.target.value))} disabled={busy}
              className="w-full accent-amber-400" />
          </label>
        </div>

        <button onClick={prove} disabled={busy || !typhoonId.trim()}
          className="w-full md:w-auto px-6 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
          {stage === 'proving' ? <><Loader2 size={14} className="animate-spin" /> Proving & verifying on Soroban…</> : <><ShieldCheck size={14} /> Generate proof & verify on-chain</>}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm text-red-300 flex gap-2">
          <XCircle size={18} className="shrink-0" /> {error}
        </div>
      )}

      {verified && (
        <div className="p-6 rounded-3xl bg-emerald-500/[0.06] border border-emerald-500/30 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-emerald-400" size={22} />
              <div>
                <div className="text-sm font-black text-white">2 · Proof verified by the vault</div>
                <div className="text-xs text-slate-400">
                  Groth16 · BN254 pairing check in <span className="font-mono">submit_weather_report_zk</span>
                </div>
              </div>
            </div>
            <a href={explorerTxUrl(verified.txHash)} target="_blank" rel="noreferrer"
              className="text-xs font-mono text-emerald-300 hover:text-emerald-200 flex items-center gap-1">
              {short(verified.txHash)} <ExternalLink size={12} />
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <Stat label="Wind band proven" value={`≥ ${verified.windFloor} km/h`} />
            <Stat label="Damage" value={`${verified.damagePercentage}%`} />
            <Stat label="Proving time" value={`${(verified.zk.provingMs / 1000).toFixed(1)} s`} />
            <Stat label="Ledger" value={String(verified.zk.ledger)} />
          </div>

          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-widest font-black text-slate-500">Public inputs (rebuilt by the contract)</div>
            {verified.zk.publicSignals.map((s, i) => (
              <div key={i} className="flex justify-between gap-4 text-xs">
                <span className="text-slate-400">{SIGNAL_LABELS[i]}</span>
                <span className="font-mono text-slate-200">{short(s, 8)}</span>
              </div>
            ))}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1">Proof (A ‖ B ‖ C, 256 bytes)</div>
            <div className="bg-black/40 p-3 rounded-xl font-mono text-[10px] text-slate-400 break-all max-h-16 overflow-y-auto custom-scrollbar">
              {verified.zk.proof}
            </div>
          </div>

          {sym(farm.region) !== verified.region && (
            <p className="text-xs text-amber-300">This proof is for {verified.region}; the selected farm is in {sym(farm.region)}.</p>
          )}

          {stage !== 'paid' && (
            <button onClick={claimPayout} disabled={busy || !walletAddress}
              className="w-full md:w-auto px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
              {stage === 'claiming' ? <><Loader2 size={14} className="animate-spin" /> Claiming…</> : `3 · Claim payout for ${farm.farmName}`}
            </button>
          )}
          {!walletAddress && <p className="text-xs text-slate-400">Connect a wallet to claim.</p>}
        </div>
      )}

      {claim && (
        <div className="p-6 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/40 text-center space-y-2">
          <div className="text-[10px] uppercase tracking-widest font-black text-emerald-400">Paid by the vault contract</div>
          <div className="text-4xl font-black text-white font-mono">{claim.xlm === null ? '—' : `${claim.xlm.toLocaleString()} XLM`}</div>
          <a href={explorerTxUrl(claim.txHash)} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-mono text-emerald-300 hover:text-emerald-200">
            {short(claim.txHash)} <ExternalLink size={12} />
          </a>
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-3 rounded-2xl bg-black/30 border border-white/5">
    <div className="text-[9px] uppercase tracking-widest font-black text-slate-500">{label}</div>
    <div className="text-sm font-black text-white font-mono mt-1">{value}</div>
  </div>
);
