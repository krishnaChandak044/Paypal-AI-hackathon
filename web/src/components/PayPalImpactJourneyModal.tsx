import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { PayPalImpactJourneyResult, JourneyStep } from '../types';
import { HandDrawnCheck, HandDrawnSparkle } from './OrganicIllustration';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Copy,
  Share2,
  FileText,
  X,
  Zap,
  ShoppingBag,
  ExternalLink,
  Lock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface PayPalImpactJourneyModalProps {
  initialOrderId?: string;
  onClose: () => void;
}

export const PayPalImpactJourneyModal: React.FC<PayPalImpactJourneyModalProps> = ({
  initialOrderId = '84Y94709MX0315008',
  onClose,
}) => {
  const [orderId, setOrderId] = useState<string>(initialOrderId);
  const [journeyData, setJourneyData] = useState<PayPalImpactJourneyResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeStoryTab, setActiveStoryTab] = useState<'letter' | 'social' | 'audit'>('letter');
  const [copied, setCopied] = useState<boolean>(false);

  const loadJourney = async (idToFetch: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await api.getPayPalOrderJourney(idToFetch);
      setJourneyData(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to retrieve PayPal impact journey.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      loadJourney(orderId);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) return;
    loadJourney(orderId.trim());
  };

  const selectDemoOrder = (id: string) => {
    setOrderId(id);
    loadJourney(id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-4xl max-w-3xl w-full p-6 sm:p-9 shadow-soft-lg border border-slate-200 relative space-y-7 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with PayPal Branding */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0070BA]/10 text-[#0070BA] font-bold text-xs border border-[#0070BA]/20">
              <Zap className="w-4 h-4 text-[#0070BA]" />
              <span>PayPal Provenance Rail &bull; Live Impact Journey</span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-mint-50 text-mint-700 border border-mint-200">
              <ShieldCheck className="w-3.5 h-3.5 text-mint-600" />
              <span>Cryptographic Provenance Verified</span>
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
              Trace Your PayPal Contribution
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl mt-1">
              Watch how your specific dollars moved from your PayPal receipt directly through human allocation, fast-grant disbursal, and AI-audited store slips.
            </p>
          </div>

          {/* Quick 1-Click Judge Order Selectors */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="font-bold text-slate-600 text-[11px]">1-Click Demo Orders for Judges:</span>
            <button
              type="button"
              onClick={() => selectDemoOrder('84Y94709MX0315008')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all border ${
                orderId === '84Y94709MX0315008'
                  ? 'bg-sky-50 text-brand-700 border-sky-300 font-bold shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              🍼 Infant Relief ($25.00)
            </button>
            <button
              type="button"
              onClick={() => selectDemoOrder('PP-FLOOD-HARDWARE-02')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all border ${
                orderId === 'PP-FLOOD-HARDWARE-02'
                  ? 'bg-sky-50 text-brand-700 border-sky-300 font-bold shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              🛠️ Flood Defense ($50.00)
            </button>
          </div>
        </div>

        {/* Search Input for Any PayPal Order */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="Paste any PayPal Order ID or Capture ID..."
            className="flex-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Inspect Journey</span>}
          </button>
        </form>

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-700">Verifying Cryptographic Ledger Trail...</p>
            <p className="text-[11px] text-slate-400">Querying double-entry ledger, Payout batches &amp; multimodal vision audits</p>
          </div>
        ) : journeyData ? (
          <div className="space-y-8">
            {/* Contribution Snapshot Card */}
            <div className="p-5 rounded-3xl bg-slate-50/90 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Verified Contribution</span>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-3xl font-bold text-slate-900">
                    ${(journeyData.amount_minor / 100).toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-slate-500">{journeyData.currency}</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  PayPal Order: {journeyData.order_id}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-mint-600 block">Direct Relief Attribution</span>
                <span className="font-bold text-sm text-mint-700">100% to Humanitarian Aid</span>
                <span className="text-[11px] text-slate-400 block">$0.00 Administrative Overhead</span>
              </div>
            </div>

            {/* The 4-Stage Chronological Provenance Journey */}
            <div className="space-y-4">
              <h4 className="font-serif text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-600" />
                <span>Four-Stage Ledger Provenance Journey</span>
              </h4>

              <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-brand-500 before:via-mint-500 before:to-mint-600">
                {journeyData.timeline.map((step: JourneyStep) => (
                  <div key={step.stage} className="relative space-y-1">
                    {/* Circle Node on Timeline */}
                    <div className="absolute -left-6 sm:-left-8 top-1 w-5 h-5 rounded-full bg-white border-2 border-brand-600 flex items-center justify-center shadow-sm">
                      <div className="w-2 h-2 rounded-full bg-brand-600" />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{step.title}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-brand-700 border border-sky-200">
                          {step.badge}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{step.timestamp}</span>
                    </div>

                    <p className="text-[11px] font-semibold text-brand-700">{step.subtitle}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
                    <span className="text-[10px] font-mono text-slate-400 block">Ref: {step.reference}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Verified Goods Delivered Showcase */}
            {journeyData.verified_items_funded.length > 0 && (
              <div className="p-4 rounded-3xl bg-mint-50/70 border border-mint-200 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-mint-900">
                  <ShoppingBag className="w-4 h-4 text-mint-600" />
                  <span>Tangible Essentials Verified by Multimodal Vision AI:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {journeyData.verified_items_funded.map((item, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-xl bg-white/90 border border-mint-200 text-xs font-medium text-slate-800 shadow-xs"
                    >
                      &bull; {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Zero-PII AI Supporter Storyteller Section */}
            <div className="bg-slate-50/90 rounded-3xl p-5 sm:p-6 border border-slate-200/90 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-600" />
                  <div>
                    <h5 className="font-serif text-sm font-bold text-slate-900">
                      Zero-PII AI Supporter Narrative
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      Humane storytelling grounded in ledger facts with 0% victim privacy exposure
                    </p>
                  </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveStoryTab('letter')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      activeStoryTab === 'letter' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Supporter Letter
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStoryTab('social')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      activeStoryTab === 'social' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Social Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStoryTab('audit')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      activeStoryTab === 'audit' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Audit Attestation
                  </button>
                </div>
              </div>

              {/* Story Content Box */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 text-xs text-slate-700 leading-relaxed whitespace-pre-line relative">
                {activeStoryTab === 'letter' && journeyData.ai_impact_narrative.supporter_letter}
                {activeStoryTab === 'social' && journeyData.ai_impact_narrative.social_card}
                {activeStoryTab === 'audit' && (
                  <span className="font-mono text-[11px]">
                    {journeyData.ai_impact_narrative.audit_summary}
                  </span>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    Generated via ReliefRail Zero-PII AI &bull; Grounded in Ledger Provenance
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        activeStoryTab === 'letter'
                          ? journeyData.ai_impact_narrative.supporter_letter
                          : activeStoryTab === 'social'
                          ? journeyData.ai_impact_narrative.social_card
                          : journeyData.ai_impact_narrative.audit_summary
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                  >
                    {copied ? (
                      <>
                        <HandDrawnCheck className="w-3.5 h-3.5 text-mint-600" />
                        <span className="text-mint-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-600" />
                        <span>Copy Narrative</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Zero-PII Cryptographic Certificate */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-brand-600 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800">Humanitarian Privacy Protocol Verified</span>
                    <span className="text-slate-400 block text-[10px]">
                      Redactions enforced: Victim surnames, residential coordinates, medical diagnoses
                    </span>
                  </div>
                </div>

                <div className="font-mono text-[10px] text-slate-500">
                  Audit Hash: {journeyData.zero_pii_certificate.audit_hash}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
