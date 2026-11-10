import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HeroDonorSection } from './components/HeroDonorSection';
import { CoordinationBoard } from './components/CoordinationBoard';
import { AiTriageReview } from './components/AiTriageReview';
import { FulfillmentOps } from './components/FulfillmentOps';
import { RecipientPortal } from './components/RecipientPortal';
import { api, getAuthToken, setAuthToken } from './api';
import { BoardData, Campaign, PoolBalance } from './types';
import { HeartInHandsSvg } from './components/OrganicIllustration';
import { ArrowRight, Heart } from 'lucide-react';

export const App: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [pool, setPool] = useState<PoolBalance | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('supporter');
  const [authToken, setLocalAuthToken] = useState<string>(getAuthToken());

  // Load campaigns on initial mount
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const list = await api.getCampaigns();
        setCampaigns(list);
        if (list.length > 0 && !selectedCampaignId) {
          setSelectedCampaignId(list[0].id);
        }
      } catch (err) {
        console.warn('Initial campaign load (using fallback or waiting for token):', err);
        setCampaigns([
          {
            id: 'b253a83d-09ae-4ec7-81f4-055aac27f72a',
            name: 'Pine Creek & Riverbend Flood Response',
            currency: 'USD',
          },
        ]);
        setSelectedCampaignId('b253a83d-09ae-4ec7-81f4-055aac27f72a');
      }
    };
    fetchCampaigns();
  }, []);

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

  useEffect(() => {
    if (selectedCampaignId) {
      refreshBoardAndPool();
    }
  }, [selectedCampaignId, authToken]);

  const handleSaveToken = (token: string) => {
    setAuthToken(token);
    setLocalAuthToken(token);
    refreshBoardAndPool();
  };

  const activeCampaign = campaigns.find((c) => c.id === selectedCampaignId) || {
    id: selectedCampaignId,
    name: 'Pine Creek & Riverbend Flood Response',
    currency: 'USD',
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-brand-100">
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

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        {currentTab === 'supporter' && (
          <div className="space-y-16">
            <HeroDonorSection
              campaignId={selectedCampaignId}
              campaignName={activeCampaign.name}
              currency={activeCampaign.currency}
              pool={pool || (boardData ? boardData.pool : null)}
              onRefreshPool={refreshBoardAndPool}
            />

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
    </div>
  );
};
