import React, { useState } from 'react';
import { api } from '../api';
import { Sparkles, Waves, ArrowRight, ShieldCheck, CheckCircle2, Zap } from 'lucide-react';

interface CrisisSimulatorBarProps {
  campaignId: string;
  onCrisisInjected: () => void;
  onNavigateTab: (tab: string) => void;
  onOpenJourney?: (orderId?: string) => void;
}

export const CrisisSimulatorBar: React.FC<CrisisSimulatorBarProps> = ({
  campaignId,
  onCrisisInjected,
  onNavigateTab,
  onOpenJourney,
}) => {
  const [isInjecting, setIsInjecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSimulateCrisis = async () => {
    if (!campaignId) return;
    setIsInjecting(true);
    setStatusMessage(null);
    try {
      const res = await api.simulateCrisis(campaignId, 'flash_flood_wave');
      setStatusMessage('Injected 3 urgent flood requests with approved needs!');
      onCrisisInjected();
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      setStatusMessage('Simulation failed: ' + (err.message || 'Error'));
    } finally {
      setIsInjecting(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-sky-100/90 via-white to-mint-50/90 border-b border-sky-200/80 py-2.5 px-4 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Left: Judge Showcase Pitch */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0070BA]/10 text-[#0070BA] font-bold text-[11px] border border-[#0070BA]/20">
            <Zap className="w-3.5 h-3.5" />
            <span>Judge Showcase Mode</span>
          </div>
          <span className="text-slate-700 font-medium hidden sm:inline">
            Test the complete 360° closed-loop disaster relief rail:
          </span>
        </div>

        {/* Center/Right: Interactive Flow Steps */}
        <div className="flex flex-wrap items-center gap-2 font-semibold">
          <button
            type="button"
            disabled={isInjecting}
            onClick={handleSimulateCrisis}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white hover:bg-sky-50 text-brand-700 border border-sky-300 shadow-sm transition-all text-[11px] active:scale-95"
            title="Inject 3 realistic disaster relief requests"
          >
            <Waves className="w-3 h-3 text-brand-500" />
            <span>{isInjecting ? 'Injecting...' : '1. Inject Crisis Cases'}</span>
          </button>

          <span className="text-slate-300 hidden sm:inline">&bull;</span>

          <button
            type="button"
            onClick={() => onNavigateTab('board')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-sm text-[11px]"
          >
            <span>2. Disburse PayPal Grant</span>
          </button>

          <span className="text-slate-300 hidden sm:inline">&bull;</span>

          <button
            type="button"
            onClick={() => onNavigateTab('fulfillment')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-sm text-[11px]"
          >
            <span>3. Audit Store Receipt</span>
          </button>

          <span className="text-slate-300 hidden sm:inline">&bull;</span>

          <button
            type="button"
            onClick={() => onOpenJourney && onOpenJourney('84Y94709MX0315008')}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-gradient-to-r from-[#0070BA] to-brand-600 hover:from-[#005ea6] hover:to-brand-700 text-white shadow-sm text-[11px] font-bold transition-all active:scale-95"
            title="Inspect Live PayPal Transaction Impact Journey & Zero-PII AI Story"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-200" />
            <span>4. Trace PayPal Journey</span>
          </button>

          {statusMessage && (
            <span className="ml-2 px-2 py-0.5 rounded-lg bg-mint-100 text-mint-800 text-[11px] font-bold animate-pulse">
              {statusMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
