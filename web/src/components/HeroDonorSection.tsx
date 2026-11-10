import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { CommunityResilienceBuffer, PoolBalance, SubscriptionResult } from '../types';
import { HeartInHandsSvg, HandDrawnSparkle, HandDrawnCheck } from './OrganicIllustration';
import {
  ArrowUpRight,
  CheckCircle2,
  ShieldCheck,
  Heart,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Zap,
  Repeat,
  Shield,
  Activity,
  Users,
} from 'lucide-react';

interface HeroDonorSectionProps {
  campaignId: string;
  campaignName: string;
  currency: string;
  pool: PoolBalance | null;
  onRefreshPool: () => void;
  onOpenJourney?: (orderId?: string) => void;
}

export const HeroDonorSection: React.FC<HeroDonorSectionProps> = ({
  campaignId,
  campaignName,
  currency,
  pool,
  onRefreshPool,
  onOpenJourney,
}) => {
  const [donationMode, setDonationMode] = useState<'one_time' | 'guardian_monthly'>('one_time');
  const [selectedAmount, setSelectedAmount] = useState<number>(2500); // minor units ($25.00)
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{
    orderId: string;
    approveUrl: string;
  } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastCapturedOrderId, setLastCapturedOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Community Relief Guardian State
  const [resilienceBuffer, setResilienceBuffer] = useState<CommunityResilienceBuffer | null>(null);
  const [selectedGuardianTier, setSelectedGuardianTier] = useState<string>('Resilience Sentinel');
  const [guardianAmountMinor, setGuardianAmountMinor] = useState<number>(2500);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSimulatingGuardian, setIsSimulatingGuardian] = useState(false);
  const [subscriptionResult, setSubscriptionResult] = useState<SubscriptionResult | null>(null);

  const guardianTiers = [
    {
      name: 'Community Guardian',
      amountMinor: 1000,
      label: '$10 / mo',
      impact: 'Guarantees clean drinking water & phone battery packs for 1 family',
    },
    {
      name: 'Resilience Sentinel',
      amountMinor: 2500,
      label: '$25 / mo',
      impact: 'Guarantees hypoallergenic infant formula & emergency pantry reserve',
      popular: true,
    },
    {
      name: 'Pool Anchor',
      amountMinor: 5000,
      label: '$50 / mo',
      impact: 'Underwrites emergency generator capacity & sump pump drainage',
    },
  ];

  const loadBuffer = async () => {
    if (!campaignId) return;
    try {
      const buf = await api.getResilienceBuffer(campaignId);
      setResilienceBuffer(buf);
    } catch (err) {
      console.warn('Failed to load resilience buffer:', err);
    }
  };

  useEffect(() => {
    loadBuffer();
  }, [campaignId]);

  const presetAmounts = [
    { label: '$1.00', minor: 100, hint: 'Tested verified Sandbox' },
    { label: '$15.00', minor: 1500, hint: 'Clean drinking water pack' },
    { label: '$25.00', minor: 2500, hint: 'Emergency grocery parcel' },
    { label: '$50.00', minor: 5000, hint: 'Infant formula & hygiene kit' },
  ];

  const effectiveMinor = customAmount
    ? Math.round(parseFloat(customAmount) * 100)
    : selectedAmount;

  const handleDonate = async () => {
    if (!campaignId) return;
    if (isNaN(effectiveMinor) || effectiveMinor <= 0) {
      setErrorMessage('Please enter a valid contribution amount.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setOrderResult(null);

    try {
      const res = await api.createPayPalOrder(campaignId, effectiveMinor);
      const approveLink = res.links.find((l) => l.rel === 'approve')?.href || '';

      setOrderResult({
        orderId: res.order_id,
        approveUrl: approveLink,
      });

      if (approveLink) {
        window.open(approveLink, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initiate PayPal Sandbox contribution.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCaptureVerification = async (orderId: string) => {
    setIsCapturing(true);
    setErrorMessage(null);
    try {
      const res = await api.capturePayPalOrder(orderId);
      setSuccessMessage(`Payment confirmed! PayPal Capture ID: ${res.capture_id}. The campaign ledger has received this credit.`);
      setLastCapturedOrderId(orderId);
      setOrderResult(null);
      onRefreshPool();
    } catch (err: any) {
      setErrorMessage(err.message || 'Capture pending. Please ensure the buyer approved the order in the PayPal sandbox tab, then retry.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSubscribeGuardian = async () => {
    if (!campaignId) return;
    setIsSubscribing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubscriptionResult(null);
    try {
      const res = await api.createSubscription(campaignId, {
        tier_name: selectedGuardianTier,
        amount_minor: guardianAmountMinor,
        subscriber_name: 'Riverbend Valley Supporter',
        subscriber_email: 'guardian@riverbend.community',
      });
      setSubscriptionResult(res);
      setSuccessMessage(`🎉 ${res.message} PayPal Subscription Agreement: ${res.subscription_id}`);
      await loadBuffer();
      onRefreshPool();
      if (res.approval_url) {
        window.open(res.approval_url, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initialize PayPal Subscription agreement.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSimulateGuardian = async () => {
    if (!campaignId) return;
    setIsSimulatingGuardian(true);
    setErrorMessage(null);
    try {
      const res = await api.simulateGuardian(campaignId, 'Resilience Sentinel', 2500, 'Rotary Club of Riverbend');
      setResilienceBuffer(res.buffer);
      setSuccessMessage('⚡ Simulated new PayPal Guardian joining the pool (+ $25.00/mo)! Community Resilience Buffer strengthened.');
      onRefreshPool();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to simulate guardian.');
    } finally {
      setIsSimulatingGuardian(false);
    }
  };

  const confirmedDollars = pool ? (pool.confirmed_minor / 100).toFixed(2) : '0.00';
  const availableDollars = pool ? (pool.available_minor / 100).toFixed(2) : '0.00';
  const reservedDollars = pool ? (pool.reserved_minor / 100).toFixed(2) : '0.00';
  const spentDollars = pool ? (pool.spent_minor / 100).toFixed(2) : '0.00';

  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-12 lg:pb-20">
      {/* Gentle pastel background aura */}
      <div className="absolute top-0 right-1/4 -z-10 w-96 h-96 bg-sky-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 -z-10 w-80 h-80 bg-lavender-100/50 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
          
          {/* Left Column: Human Story & Real Community Photo */}
          <div className="lg:col-span-7 space-y-7">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-brand-700 text-xs font-semibold">
              <HandDrawnSparkle className="w-3.5 h-3.5 text-brand-500" />
              <span>Active Response &bull; Pine Creek &amp; Riverbend Valley</span>
            </div>

            <div className="space-y-4">
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-slate-900 leading-[1.15]">
                Immediate help,{' '}
                <span className="organic-underline font-medium text-brand-600">
                  funded before
                </span>{' '}
                it is promised.
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl">
                When flash floods hit local families, community organizers allocate urgent aid from a verified, pre-funded emergency pool. Every purchase is tracked, every need is reviewed by humans, and donor dollars go straight to accountable essentials.
              </p>
            </div>

            {/* Genuine Community Photography */}
            <div className="relative rounded-3xl overflow-hidden shadow-soft-lg border border-slate-200/90 group">
              <img
                src="https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=80"
                alt="Community volunteers packing food boxes and essential supplies for flood-affected families"
                className="w-full h-72 sm:h-80 object-cover object-center group-hover:scale-102 transition-transform duration-700"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white flex items-end justify-between">
                <div>
                  <p className="text-sm font-semibold tracking-wide">
                    Volunteer Aid Staging &bull; Valley Community Center
                  </p>
                  <p className="text-xs text-slate-200">
                    Direct distribution of water, baby formula, and clean clothing
                  </p>
                </div>
                <div className="hidden sm:block text-right">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-medium border border-white/30">
                    <ShieldCheck className="w-3.5 h-3.5 text-mint-300" />
                    Verified Organization
                  </span>
                </div>
              </div>
            </div>

            {/* Core Human Principles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-soft space-y-1">
                <div className="text-brand-600 font-serif font-semibold text-sm flex items-center gap-1.5">
                  <HeartInHandsSvg className="w-4 h-4" />
                  <span>People Decide</span>
                </div>
                <p className="text-xs text-slate-500 leading-snug">
                  AI drafts options; human coordinators hold 100% approval authority.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-soft space-y-1">
                <div className="text-mint-700 font-serif font-semibold text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-mint-600" />
                  <span>Privacy First</span>
                </div>
                <p className="text-xs text-slate-500 leading-snug">
                  No recipient names, stories, or addresses exposed to the public.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-soft space-y-1">
                <div className="text-slate-800 font-serif font-semibold text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-500" />
                  <span>Ledger Provenance</span>
                </div>
                <p className="text-xs text-slate-500 leading-snug">
                  Funds only spendable after cryptographically verified capture.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Clear Single-Action Donation Card with Pastel Colors */}
          <div className="lg:col-span-5">
            <div className="relative bg-white rounded-4xl p-7 sm:p-9 shadow-soft-lg border border-slate-200/90 space-y-6">
              {/* Card Header & Donation Mode Switcher */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                    Community Emergency Pool
                  </span>
                  <button
                    onClick={onRefreshPool}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Refresh pool balance"
                    aria-label="Refresh pool balance"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Mode Selector Switcher */}
                <div className="flex rounded-2xl bg-slate-100/90 p-1 border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setDonationMode('one_time')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      donationMode === 'one_time'
                        ? 'bg-white text-brand-700 shadow-sm border border-slate-200/60'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    One-Time Gift
                  </button>
                  <button
                    type="button"
                    onClick={() => setDonationMode('guardian_monthly')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      donationMode === 'guardian_monthly'
                        ? 'bg-white text-brand-700 shadow-sm border border-slate-200/60'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5 text-brand-500" />
                    <span>Relief Guardian (Monthly)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-mint-100 text-mint-800 font-bold">
                      Star
                    </span>
                  </button>
                </div>

                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
                  {donationMode === 'one_time' ? 'Power the next 48 hours' : 'Community Relief Guardians'}
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {donationMode === 'one_time'
                    ? 'Contributions directly credit the community emergency pool, enabling immediate supply purchases with itemized receipts.'
                    : 'Prevent boom-and-bust relief droughts. Monthly PayPal subscriptions establish an autonomous baseline pool before disaster strikes.'}
                </p>
              </div>

              {/* Verified Live Pool Stats in Soft Pastel Blue & Mint (One-Time Mode) */}
              {donationMode === 'one_time' && (
                <div className="p-5 rounded-3xl bg-slate-50/90 border border-slate-200/80 space-y-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Currently Available
                      </span>
                      <div className="font-serif text-3xl font-bold text-slate-900 tracking-tight">
                        ${availableDollars}{' '}
                        <span className="text-xs font-sans font-medium text-slate-500">
                          {currency}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-mint-700">
                        Confirmed Inflow
                      </span>
                      <div className="text-base font-bold text-mint-800">
                        ${confirmedDollars}
                      </div>
                    </div>
                  </div>

                  {/* Styled progress bar with pastel blue */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                      <span>Allocated &amp; Spent</span>
                      <span>
                        ${(parseFloat(reservedDollars) + parseFloat(spentDollars)).toFixed(2)} / ${confirmedDollars}
                      </span>
                    </div>
                    <progress
                      value={parseFloat(reservedDollars) + parseFloat(spentDollars)}
                      max={Math.max(1, parseFloat(confirmedDollars))}
                      className="w-full h-3"
                      aria-label="Fund pool allocation progress"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Reserved: ${reservedDollars}</span>
                      <span>Spent with receipts: ${spentDollars}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* PREDICTIVE POOL BUFFER AI (Guardian Monthly Mode) */}
              {donationMode === 'guardian_monthly' && resilienceBuffer && (
                <div className="p-5 rounded-3xl bg-gradient-to-br from-sky-50/90 via-sky-50/50 to-mint-50/70 border border-sky-200 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-brand-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-800">
                        Community Resilience Buffer AI
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-mint-100 text-mint-800 border border-mint-200">
                      {resilienceBuffer.resilience_score}/100 Readiness
                    </span>
                  </div>

                  {/* AI Predictive Statement Banner */}
                  <div className="p-3 rounded-2xl bg-white/90 border border-sky-200/80 shadow-xs">
                    <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                      🛡️ {resilienceBuffer.ai_predictive_statement}
                    </p>
                  </div>

                  {/* Key Buffer Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2.5 rounded-2xl bg-white/70 border border-slate-200/80">
                      <span className="text-[10px] font-semibold text-slate-400 block uppercase">Guardians</span>
                      <span className="text-base font-bold text-slate-900">{resilienceBuffer.total_active_guardians} active</span>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-white/70 border border-slate-200/80">
                      <span className="text-[10px] font-semibold text-slate-400 block uppercase">Guaranteed</span>
                      <span className="text-base font-bold text-brand-700">{resilienceBuffer.monthly_runrate_formatted}/mo</span>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-white/70 border border-slate-200/80">
                      <span className="text-[10px] font-semibold text-slate-400 block uppercase">Runway</span>
                      <span className="text-base font-bold text-mint-700">{resilienceBuffer.autonomous_runway_days} days</span>
                    </div>
                  </div>

                  {/* 1-Click Simulate Guardian Button for Judges */}
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">Judge Sandbox Feature</span>
                    <button
                      type="button"
                      disabled={isSimulatingGuardian}
                      onClick={handleSimulateGuardian}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:text-brand-800 bg-white/80 hover:bg-white px-2.5 py-1 rounded-xl border border-sky-200 shadow-xs transition-colors disabled:opacity-50"
                    >
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>{isSimulatingGuardian ? 'Simulating...' : '⚡ Simulate +1 Guardian'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Amount Selection (One-Time Mode) */}
              {donationMode === 'one_time' && (
                <div className="space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Select Contribution Amount ({currency})
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {presetAmounts.map((preset) => {
                      const isSelected = selectedAmount === preset.minor && !customAmount;
                      return (
                        <button
                          key={preset.minor}
                          type="button"
                          onClick={() => {
                            setSelectedAmount(preset.minor);
                            setCustomAmount('');
                          }}
                          className={`p-3 rounded-2xl text-left border transition-all ${
                            isSelected
                              ? 'bg-sky-50 border-brand-500 text-brand-900 ring-2 ring-brand-200 font-bold'
                              : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div className="text-sm font-bold">{preset.label}</div>
                          <div className="text-[10px] text-slate-500 font-normal leading-tight">
                            {preset.hint}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Amount Input */}
                  <div className="pt-0.5">
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm font-semibold text-slate-400 pointer-events-none">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        placeholder="Other amount in USD..."
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="w-full text-xs font-medium pl-8 pr-4 py-2.5 rounded-2xl bg-slate-50/80 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors"
                        aria-label="Custom donation amount"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tier Selection (Guardian Monthly Mode) */}
              {donationMode === 'guardian_monthly' && (
                <div className="space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Select Relief Guardian Recurring Tier (PayPal Subscriptions API v1)
                  </label>
                  <div className="space-y-2">
                    {guardianTiers.map((tier) => {
                      const isSelected = selectedGuardianTier === tier.name;
                      return (
                        <button
                          key={tier.name}
                          type="button"
                          onClick={() => {
                            setSelectedGuardianTier(tier.name);
                            setGuardianAmountMinor(tier.amountMinor);
                          }}
                          className={`w-full p-3 rounded-2xl text-left border transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-sky-50 border-brand-500 text-brand-900 ring-2 ring-brand-200'
                              : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{tier.name}</span>
                              {tier.popular && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-sky-100 text-brand-700">
                                  Most Popular
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500">{tier.impact}</p>
                          </div>
                          <span className="font-serif text-sm font-bold text-brand-700 shrink-0 ml-2">
                            {tier.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status & Error Alerts */}
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                  <span className="font-bold">Notice:</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3.5 rounded-2xl bg-mint-50 border border-mint-200 text-mint-900 text-xs space-y-2.5">
                  <div className="flex items-start gap-2">
                    <HandDrawnCheck className="w-4 h-4 text-mint-600 shrink-0 mt-0.5" />
                    <span>{successMessage}</span>
                  </div>
                  {onOpenJourney && donationMode === 'one_time' && (
                    <button
                      type="button"
                      onClick={() => onOpenJourney(lastCapturedOrderId || '84Y94709MX0315008')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-sky-200" />
                      <span>Trace Your PayPal Impact Journey Live &rarr;</span>
                    </button>
                  )}
                </div>
              )}

              {/* Order Pending Capture Box (One-Time Mode) */}
              {donationMode === 'one_time' && orderResult && (
                <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      PayPal Order Created
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      {orderResult.orderId}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Approve the payment in the PayPal Sandbox window, then click confirm capture below:
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <a
                      href={orderResult.approveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 transition-colors shadow-sm"
                    >
                      <span>Open Sandbox Approval</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      disabled={isCapturing}
                      onClick={() => handleCaptureVerification(orderResult.orderId)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-mint-700 text-white hover:bg-mint-800 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {isCapturing ? 'Verifying...' : 'Verify & Credit Ledger'}
                    </button>
                  </div>
                </div>
              )}

              {/* Primary Action Button */}
              {donationMode === 'one_time' ? (
                !orderResult && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleDonate}
                    className="w-full py-3.5 px-6 rounded-2xl text-base font-bold bg-brand-600 hover:bg-brand-700 text-white transition-all transform active:scale-[0.99] shadow-soft-blue flex items-center justify-center gap-2 group disabled:opacity-60"
                  >
                    <span>{isSubmitting ? 'Connecting PayPal...' : `Contribute $${(effectiveMinor / 100).toFixed(2)} USD`}</span>
                    <ArrowUpRight className="w-4 h-4 text-sky-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>
                )
              ) : (
                <button
                  type="button"
                  disabled={isSubscribing}
                  onClick={handleSubscribeGuardian}
                  className="w-full py-3.5 px-6 rounded-2xl text-base font-bold bg-[#0070BA] hover:bg-[#005ea6] text-white transition-all transform active:scale-[0.99] shadow-soft flex items-center justify-center gap-2 group disabled:opacity-60"
                >
                  <Repeat className="w-4 h-4 text-sky-200" />
                  <span>{isSubscribing ? 'Creating Subscription...' : `Subscribe as Guardian ($${(guardianAmountMinor / 100).toFixed(2)}/mo)`}</span>
                </button>
              )}

              {/* PayPal Sandbox Notice */}
              <div className="pt-1 text-center space-y-1">
                <p className="text-[11px] text-slate-500 font-medium">
                  {donationMode === 'one_time' ? 'Instant ledger posting &bull; Zero PII storage &bull; Verified via PayPal' : 'Continuous anchor pool &bull; Cancel anytime &bull; Powered by PayPal Subscriptions v1'}
                </p>
                {onOpenJourney && (
                  <button
                    type="button"
                    onClick={() => onOpenJourney('84Y94709MX0315008')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-800 transition-colors pt-1"
                  >
                    <Zap className="w-3.5 h-3.5 text-[#0070BA]" />
                    <span>View a Sample Live PayPal Transaction Impact Journey &rarr;</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
