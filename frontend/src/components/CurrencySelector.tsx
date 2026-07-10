import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { CURRENCIES } from '../hooks/useXlmRates';
import { useTranslation } from 'react-i18next';

interface CurrencySelectorProps {
  value: string;
  onChange: (code: string) => void;
  isMainnet?: boolean;
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({ value, onChange, isMainnet }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = CURRENCIES.find(c => c.code === value) ?? CURRENCIES[0];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setIsOpen(false); setSearch(''); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Autofocus search when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => searchRef.current?.focus(), 60);
  }, [isOpen]);

  const filtered = search.trim()
    ? CURRENCIES.filter(c =>
        c.code.includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.symbol.toLowerCase().includes(search.toLowerCase())
      )
    : CURRENCIES;

  const majors = filtered.filter(c => c.group === 'majors');
  const apac   = filtered.filter(c => c.group === 'asia-pacific');

  const accent = isMainnet ? 'focus:border-emerald-500/50 focus:ring-emerald-500/30' : 'focus:border-sky-500/50 focus:ring-sky-500/30';
  const dotColor = isMainnet ? 'bg-emerald-400' : 'bg-sky-400';
  const activeRow = isMainnet ? 'bg-emerald-500/10 text-emerald-300' : 'bg-sky-500/10 text-sky-300';

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative select-none">

      {/* ── Trigger Button ────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className={`flex items-center gap-1.5 bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:border-white/25 hover:text-white transition-all focus:outline-none focus:ring-1 ${accent} cursor-pointer`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="text-[15px] leading-none">{selected.flag}</span>
        <span className="uppercase tracking-widest font-black">{selected.code.toUpperCase()}</span>
        <ChevronDown
          size={11}
          className={`text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Dropdown Panel ────────────────────────────────── */}
      <div
        className="absolute right-0 top-full mt-1.5 z-[300] w-72"
        style={{
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.97)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1), opacity 150ms ease',
          transformOrigin: 'top right',
        }}
      >
        <div className="bg-slate-900/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-slate-950/80 overflow-hidden">

          {/* Search */}
          <div className="p-2.5 border-b border-white/5">
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('common.search')}
              className={`w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-[11px] text-white placeholder-slate-600 focus:outline-none focus:ring-1 ${accent} transition-all`}
            />
          </div>

          {/* Currency list */}
          <div ref={listRef} className="max-h-[280px] overflow-y-auto custom-scrollbar py-1">

            {majors.length > 0 && (
              <div>
                <div className="px-3 pt-2 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-600">
                  {t('common.majorCurrencies')}
                </div>
                {majors.map(c => (
                  <CurrencyRow
                    key={c.code}
                    currency={c}
                    isSelected={c.code === value}
                    activeClass={activeRow}
                    dotColor={dotColor}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}

            {apac.length > 0 && (
              <div className="mt-1">
                <div className="px-3 pt-2 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-600">
                  {t('common.asiaPacific')}
                </div>
                {apac.map(c => (
                  <CurrencyRow
                    key={c.code}
                    currency={c}
                    isSelected={c.code === value}
                    activeClass={activeRow}
                    dotColor={dotColor}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}

            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-slate-600">
                No currencies found
              </div>
            )}
          </div>

          {/* Footer — shows live rate */}
          <div className="border-t border-white/5 px-3 py-2 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
            <span className="text-[9px] text-slate-600 uppercase font-black tracking-widest">
              Rates via CoinGecko · Auto-refreshed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Row sub-component ──────────────────────────────────────────────────────────
interface CurrencyRowProps {
  currency: (typeof CURRENCIES)[number];
  isSelected: boolean;
  activeClass: string;
  dotColor: string;
  onSelect: (code: string) => void;
}

const CurrencyRow: React.FC<CurrencyRowProps> = ({ currency, isSelected, activeClass, dotColor, onSelect }) => (
  <button
    onClick={() => onSelect(currency.code)}
    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-all duration-100 ${
      isSelected
        ? activeClass
        : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
    }`}
  >
    <span className="text-base w-6 text-center leading-none shrink-0">{currency.flag}</span>
    <div className="flex-1 min-w-0">
      <span className="text-[11px] font-black uppercase tracking-wider">
        {currency.code.toUpperCase()}
      </span>
      <span className="text-[10px] text-slate-500 ml-2 truncate">{currency.name}</span>
    </div>
    <span className="text-[10px] text-slate-600 font-mono shrink-0">{currency.symbol}</span>
    {isSelected && <Check size={11} className={`${dotColor.replace('bg-', 'text-')} shrink-0`} />}
  </button>
);

export default CurrencySelector;
