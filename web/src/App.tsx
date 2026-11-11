import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { HeroDonorSection } from './components/HeroDonorSection';
import { CoordinationBoard } from './components/CoordinationBoard';
import { AiTriageReview } from './components/AiTriageReview';
import { FulfillmentOps } from './components/FulfillmentOps';
import { RecipientPortal } from './components/RecipientPortal';
import { CrisisSimulatorBar } from './components/CrisisSimulatorBar';
import { PayPalImpactJourneyModal } from './components/PayPalImpactJourneyModal';
import { GeographicClusterMap } from './components/GeographicClusterMap';
import { api, getAuthToken, setAuthToken } from './api';
import { BoardData, Campaign, PoolBalance } from './types';
import { HeartInHandsSvg } from './components/OrganicIllustration';
import { ArrowRight, Heart } from 'lucide-react';
import { PublicDemo } from './components/PublicDemo';

export const App: React.FC = () => {
  const [showPublicDemo, setShowPublicDemo] = useState<boolean>(
    () => new URLSearchParams(window.location.search).get('demo') === '1',
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [pool, setPool] = useState<PoolBalance | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('supporter');
  const [authToken, setLocalAuthToken] = useState<string>(getAuthToken());
  const [showJourneyModal, setShowJourneyModal] = useState<boolean>(false);
  const [journeyOrderId, setJourneyOrderId] = useState<string>('');
  const [campaignLoadError, setCampaignLoadError] = useState<string | null>(null);
  const [paypalReturnNotice, setPaypalReturnNotice] = useState<string | null>(null);
  const paypalReturnStarted = useRef(false);

  // Load campaigns only from the authenticated API; never disguise setup failures as demo data.
  useEffect(() => {
    if (showPublicDemo) return;
    let cancelled = false;
    setCampaigns([]);
    setSelectedCampaignId('');
    setBoardData(null);
    setPool(null);
    const fetchCampaigns = async () => {
      try {
        const list = await api.getCampaigns();
        if (cancelled) return;
        setCampaigns(list);
        setCampaignLoadError(null);
        setSelectedCampaignId((current) => list.some((item) => item.id === current) ? current : (list[0]?.id || ''));
      } catch (err) {
        if (cancelled) return;
        setCampaigns([]);
        setSelectedCampaignId('');
        setCampaignLoadError(err instanceof Error ? err.message : 'Unable to load campaigns.');
      }
    };
    fetchCampaigns();
    return () => { cancelled = true; };
  }, [authToken, showPublicDemo]);

  const refreshBoardAndPool = async () => {
    if (!selectedCampaignId) return;
    try {
      const [b, p] = await Promise.all([
        api.getBoard(selectedCampaignId).catch(() => null),
        api.getPool(selectedCampaignId).catch(() => null),
      ]);
      if (b) setBoardData(b);
      if (p) setPool(p);
    } catch (err) {
      console.error('Failed to refresh board/pool:', err);
    }
  };

  // PayPal redirects back to this page after buyer approval. Capture on the
  // server, where the order and authenticated campaign are checked, then notify
  // the original donor tab so its pending-order panel can close truthfully.
  useEffect(() => {
    if (showPublicDemo) return;
    if (paypalReturnStarted.current) return;
    const url = new URL(window.location.href);
    const returnState = url.searchParams.get('paypal');
    if (!returnState) return;

    paypalReturnStarted.current = true;
    const orderId = url.searchParams.get('token') || '';
    for (const key of ['paypal', 'token', 'PayerID', 'paymentId', 'paymentToken']) {
      url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);

    const sendToDonorTab = (status: string, extra: Record<string, string> = {}) => {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { source: 'reliefrail:paypal', status, orderId, ...extra },
          window.location.origin,
        );
      }
    };

    if (returnState === 'cancel') {
      setPaypalReturnNotice('PayPal checkout was cancelled. No contribution was captured.');
      sendToDonorTab('cancelled');
      return;
    }
    if (returnState !== 'return') return;
    if (!orderId) {
      const message = 'PayPal returned without an order reference. Check the order status before retrying.';
      setPaypalReturnNotice(message);
      sendToDonorTab('failed', { message });
      return;
    }

    setPaypalReturnNotice('PayPal approved the contribution. Confirming the capture…');
    api.capturePayPalOrder(orderId).then((result) => {
      const message = 'Payment confirmed by PayPal and credited to the campaign pool.';
      setPaypalReturnNotice(message);
      setJourneyOrderId(orderId);
      sendToDonorTab('confirmed', { captureId: result.capture_id });
      void refreshBoardAndPool();
    }).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : 'Capture confirmation is pending.';
      const message = `PayPal returned to ReliefRail, but capture confirmation failed: ${detail}. Use the order status panel to retry safely.`;
      setPaypalReturnNotice(message);
      sendToDonorTab('failed', { message });
    });
  }, [showPublicDemo]);

  useEffect(() => {
    if (showPublicDemo) return;
    if (selectedCampaignId) {
      refreshBoardAndPool();
    }
  }, [selectedCampaignId, authToken, showPublicDemo]);

  const handleSaveToken = (token: string) => {
    setAuthToken(token);
    setLocalAuthToken(token);
  };

  const activeCampaign = campaigns.find((c) => c.id === selectedCampaignId) || {
    id: selectedCampaignId,
    name: '',
    currency: '',
  };

  if (showPublicDemo) {
    return <PublicDemo onExit={() => {
      const url = new URL(window.location.href);
      url.searchParams.delete('demo');
      window.history.replaceState({}, '', url);
      setShowPublicDemo(false);
    }} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-brand-100">
      {/* Top Interactive Crisis Demo Bar for Judges */}
      {selectedCampaignId && <CrisisSimulatorBar
        campaignId={selectedCampaignId}
        onCrisisInjected={refreshBoardAndPool}
        onNavigateTab={(tab) => setCurrentTab(tab)}
        onOpenJourney={(orderId) => {
          setJourneyOrderId(orderId || '');
          setShowJourneyModal(true);
        }}
      />}

      {/* Top Banner & Header */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        campaigns={campaigns}
        selectedCampaignId={selectedCampaignId}
        onSelectCampaign={setSelectedCampaignId}
        authToken={authToken}
        onSaveToken={handleSaveToken}
      />

      {paypalReturnNotice && (
        <div
          role="status"
          aria-live="polite"
          className={`mx-auto mt-4 max-w-7xl rounded-2xl border px-4 py-3 text-sm ${
            paypalReturnNotice.includes('failed') || paypalReturnNotice.includes('cancelled')
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          {paypalReturnNotice}
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        {!selectedCampaignId ? (
          <section className="my-16 mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-soft">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Welcome to ReliefRail</p>
            <h1 className="mt-3 font-serif text-2xl font-bold text-slate-900">Explore the public demo</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Browse a read-only walkthrough built from fictional cases. It needs no account and cannot change records or move money.
            </p>
            <button
              type="button"
              onClick={() => setShowPublicDemo(true)}
              className="mt-6 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
            >
              Enter synthetic demo
            </button>
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-sm font-semibold text-slate-800">Coordinator access</p>
              <p className="mt-1 text-xs text-slate-500">
                Use the key icon above with a private coordinator token. Never share that token on this public page.
              </p>
              {campaignLoadError && <p role="status" className="mt-3 text-xs text-amber-800">{campaignLoadError}</p>}
            </div>
          </section>
        ) : <>
        {currentTab === 'supporter' && (
          <div className="space-y-16">
            <HeroDonorSection
              campaignId={selectedCampaignId}
              campaignName={activeCampaign.name}
              currency={activeCampaign.currency}
              pool={pool || (boardData ? boardData.pool : null)}
              onRefreshPool={refreshBoardAndPool}
              onOpenJourney={(orderId) => {
                setJourneyOrderId(orderId || '');
                setShowJourneyModal(true);
              }}
            />

            {/* Synthetic geographic scenario map */}
            <section className="space-y-4">
              <GeographicClusterMap campaignId={selectedCampaignId} />
            </section>

            {/* Donor Transparency & Live Gap Preview */}
            <section className="pb-16 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200/80 pb-4">
                <div>
                  <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
                    Community Accountability
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                    Where the emergency pool is directed right now
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentTab('board')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors"
                >
                  <span>Inspect Full Coordination Board</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Board Snapshot */}
              <div className="bg-white rounded-4xl p-6 sm:p-8 border border-slate-200/80 shadow-soft">
                <CoordinationBoard
                  boardData={boardData}
                  campaignId={selectedCampaignId}
                  onRefresh={refreshBoardAndPool}
                  onRequestTriage={() => setCurrentTab('triage')}
                />
              </div>
            </section>
          </div>
        )}

        {currentTab === 'board' && (
          <CoordinationBoard
            boardData={boardData}
            campaignId={selectedCampaignId}
            onRefresh={refreshBoardAndPool}
            onRequestTriage={() => setCurrentTab('triage')}
          />
        )}

        {currentTab === 'triage' && (
          <AiTriageReview
            campaignId={selectedCampaignId}
            onRefreshBoard={refreshBoardAndPool}
          />
        )}

        {currentTab === 'fulfillment' && (
          <FulfillmentOps
            campaignId={selectedCampaignId}
            onRefreshBoard={refreshBoardAndPool}
          />
        )}

        {currentTab === 'recipient' && (
          <RecipientPortal campaignId={selectedCampaignId} />
        )}
        </>}
      </main>

      {/* Clean Pastel Minimalist Footer */}
      <footer className="mt-20 border-t border-slate-200/80 bg-slate-100/60 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <HeartInHandsSvg className="w-5 h-5 text-brand-600" />
                <span className="font-serif text-lg font-bold text-slate-900">
                  ReliefRail
                </span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-sky-100 text-brand-800">
                  Prototype
                </span>
              </div>
              <p className="text-xs text-slate-500 max-w-md">
                AI-assisted aid coordination and pooled fund accounting for community disaster response.
                Built for the PayPal AI Hackathon.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600 font-medium">
              <button
                type="button"
                onClick={() => setCurrentTab('supporter')}
                className="hover:text-slate-900"
              >
                Donate
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('board')}
                className="hover:text-slate-900"
              >
                Gap Board
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('triage')}
                className="hover:text-slate-900"
              >
                AI Triage
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('recipient')}
                className="hover:text-slate-900"
              >
                Seek Aid
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
            <p>
              &bull; Fictional flood response demonstration with real PayPal Sandbox integration.
              AI assists with drafting; authorized humans make all allocation and spending decisions.
            </p>
            <p className="flex items-center gap-1 font-semibold text-slate-500">
              <span>Made with care</span>
              <Heart className="w-3 h-3 text-brand-600 fill-brand-600" />
              <span>for communities</span>
            </p>
          </div>
        </div>
      </footer>

      {/* PayPal order and pool journey */}
      {showJourneyModal && (
        <PayPalImpactJourneyModal
          initialOrderId={journeyOrderId}
          onClose={() => setShowJourneyModal(false)}
        />
      )}
    </div>
  );
};
