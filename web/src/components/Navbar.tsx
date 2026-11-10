import React, { useState } from 'react';
import { HeartInHandsSvg } from './OrganicIllustration';
import { KeyRound, ShieldCheck, HeartHandshake, LayoutDashboard, Sparkles, ReceiptText, LifeBuoy } from 'lucide-react';
import { Campaign } from '../types';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  campaigns: Campaign[];
  selectedCampaignId: string;
  onSelectCampaign: (id: string) => void;
  authToken: string;
  onSaveToken: (token: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  authToken,
  onSaveToken,
}) => {
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tempToken, setTempToken] = useState(authToken);

  const navItems = [
    { id: 'supporter', label: 'Support & Donate', icon: HeartHandshake },
    { id: 'board', label: 'Coordination Board', icon: LayoutDashboard },
    { id: 'triage', label: 'AI Review & Plans', icon: Sparkles },
    { id: 'fulfillment', label: 'Fulfillment & Receipts', icon: ReceiptText },
    { id: 'recipient', label: 'Request Assistance', icon: LifeBuoy },
  ];

  return (
    <header className="sticky top-0 z-30 bg-warm-50/90 backdrop-blur-md border-b border-warm-200/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-clay-500/10 border border-clay-500/20 flex items-center justify-center shadow-sm">
              <HeartInHandsSvg className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-2xl font-bold tracking-tight text-warm-900">
                  ReliefRail
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sage-100 text-sage-800 border border-sage-200">
                  Verified Aid
                </span>
              </div>
              <p className="text-xs text-warm-500 font-medium hidden sm:block">
                Transparent Community Emergency Pool
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1.5 p-1.5 rounded-2xl bg-warm-100/80 border border-warm-200/60 shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white text-clay-700 shadow-sm font-semibold'
                      : 'text-warm-600 hover:text-warm-900 hover:bg-white/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-clay-600' : 'text-warm-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Controls: Campaign Selector & Auth Token */}
          <div className="flex items-center gap-3">
            {campaigns.length > 0 && (
              <div className="relative">
                <select
                  value={selectedCampaignId}
                  onChange={(e) => onSelectCampaign(e.target.value)}
                  className="text-xs font-semibold bg-white border border-warm-200 text-warm-800 rounded-xl px-3 py-2 pr-7 shadow-sm focus:outline-none focus:ring-2 focus:ring-clay-500/30"
                  aria-label="Select relief campaign"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.currency})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => {
                setTempToken(authToken);
                setShowTokenModal(true);
              }}
              title="Organizer / Admin Token"
              className={`p-2.5 rounded-xl border transition-all ${
                authToken
                  ? 'bg-sage-50 border-sage-200 text-sage-700'
                  : 'bg-white border-warm-200 text-warm-500 hover:text-warm-800'
              }`}
            >
              <KeyRound className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="lg:hidden flex overflow-x-auto py-2 gap-1 scrollbar-none border-t border-warm-200/50">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                  isActive
                    ? 'bg-clay-600 text-white shadow-sm'
                    : 'text-warm-600 bg-white/60 border border-warm-200/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Auth Token Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 bg-warm-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-warm-lg border border-warm-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-clay-50 border border-clay-200 flex items-center justify-center text-clay-700">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-warm-900">
                  Organizer Access Token
                </h3>
                <p className="text-xs text-warm-500">
                  Used for plan approvals, reserves, and receipts
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-warm-700 mb-1">
                Bearer Token
              </label>
              <input
                type="password"
                value={tempToken}
                onChange={(e) => setTempToken(e.target.value)}
                placeholder="Paste token generated at bootstrap or member creation"
                className="w-full text-xs font-mono bg-warm-50 border border-warm-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-clay-500/30"
              />
              <p className="text-[11px] text-warm-400 mt-1">
                Stored in your browser local storage. Never committed to code.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTokenModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-warm-600 hover:bg-warm-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onSaveToken(tempToken);
                  setShowTokenModal(false);
                }}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-clay-600 text-white hover:bg-clay-700 shadow-sm"
              >
                Save Token
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
