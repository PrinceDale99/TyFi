import React, { useState, useEffect } from 'react';
import { FileText, Download, ExternalLink, Loader2, Award, Calendar, MapPin, Shield } from 'lucide-react';

interface Certificate {
  id: string;
  farmId: string;
  region: string;
  season: string;
  premium: number;
  payoutAmount: number;
  txHash: string;
  downloadUrl: string;
  timestamp: any;
}

interface CertificateListProps {
  address: string;
  network?: string;
}

const CertificateList: React.FC<CertificateListProps> = ({ address, network }) => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCertificates = async () => {
      if (!address) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`http://localhost:3001/api/certificates/${address}`);
        const result = await response.json();
        
        if (result.success) {
          setCertificates(result.data);
        } else {
          setError(result.error || 'Failed to fetch certificates');
        }
      } catch (err) {
        setError('Network error: Could not reach certificate server');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCertificates();
  }, [address]);

  const handleGenerateDemoCert = () => {
    const demoCert: Certificate = {
      id: `CERT-DEMO-${Math.floor(Math.random() * 10000)}`,
      farmId: 'FARM-DEMO',
      region: 'Demo Region',
      season: 'Demo Season',
      premium: 100,
      payoutAmount: 1000,
      txHash: '0x' + Math.random().toString(16).slice(2, 10),
      downloadUrl: '/demo-certificate.pdf',
      timestamp: { _seconds: Math.floor(Date.now() / 1000) }
    };
    setCertificates(prev => [demoCert, ...prev]);
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-sky-500" size={32} />
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Retrieving Official Documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center bg-rose-500/5 border border-rose-500/10 rounded-2xl">
        <p className="text-xs font-bold text-rose-400">{error}</p>
      </div>
    );
  }

  if (certificates.length === 0) {
    return (
      <div className="p-12 rounded-3xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-slate-600 gap-3 relative">
        <FileText size={40} opacity={0.2} />
        <p className="text-sm font-bold">No active insurance certificates found.</p>
        <p className="text-[10px] uppercase tracking-widest font-black text-slate-700">Subscribe to a policy to generate proof of coverage</p>
        {network === 'demo' && (
          <button 
            onClick={handleGenerateDemoCert}
            className="mt-4 px-4 py-2 rounded-xl bg-sky-500/20 text-sky-400 text-xs font-bold uppercase tracking-wider hover:bg-sky-500/30 transition-all border border-sky-500/30"
          >
            Generate Demo Certificate
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Award size={14} className="text-sky-400" />
          Official Insurance Certificates ({certificates.length})
        </h3>
        {network === 'demo' && (
          <button 
            onClick={handleGenerateDemoCert}
            className="px-3 py-1 rounded-lg bg-sky-500/10 text-sky-400 text-[10px] font-bold uppercase tracking-wider hover:bg-sky-500/20 transition-all border border-sky-500/20 flex items-center gap-1"
          >
            <FileText size={12} />
            Add Demo Cert
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {certificates.map((cert) => (
          <div key={cert.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-sky-500/20 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                  <Shield size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-white uppercase italic">Policy: {cert.farmId}</h4>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                      <MapPin size={10} />
                      {cert.region}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                      <Calendar size={10} />
                      {cert.season}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-black uppercase tracking-tight">
                      <Shield size={10} />
                      {cert.payoutAmount.toLocaleString()} XLM COVERAGE
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <a 
                  href={cert.downloadUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white transition-all shadow-lg shadow-sky-500/20 flex items-center gap-2 group/btn"
                >
                  <Download size={14} className="group-hover/btn:translate-y-0.5 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">PDF</span>
                </a>
                <a 
                  href={`https://stellar.expert/explorer/testnet/tx/${cert.txHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                  title="Verify on Explorer"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
              <div className="text-[9px] font-mono text-slate-600 truncate max-w-[200px]">
                TX: {cert.txHash}
              </div>
              <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                Issued {cert.timestamp ? new Date(cert.timestamp._seconds * 1000).toLocaleDateString() : 'Recently'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CertificateList;
