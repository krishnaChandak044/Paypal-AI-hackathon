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

  const navItems: { id: string; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: 'supporter', label: 'Support & Donate', icon: HeartHandshake },
    { id: 'board', label: 'Gap Board', icon: LayoutDashboard },
    { id: 'triage', label: 'AI Review & Plans', icon: Sparkles },
    { id: 'fulfillment', label: 'Receipt Review', icon: ReceiptText },
    { id: 'recipient', label: 'Seek Aid', icon: LifeBuoy },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-soft transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center shadow-sm">
              <HeartInHandsSvg className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-2xl font-bold tracking-tight text-slate-900">
                  ReliefRail
                </span>
                <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-mint-50 text-mint-700 border border-mint-200">
                  Aid Coordination
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Transparent Community Emergency Pool
              </p>
            </div>
          </div>

          {/* Clean Navigation Tabs with No Line Wrapping */}
          <nav className="hidden lg:flex items-center gap-1 p-1 rounded-2xl bg-slate-100/90 border border-slate-200/70 shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-white text-brand-600 shadow-sm border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-500' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-mint-100 text-mint-800 border border-mint-200">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Controls: Campaign Selector & Auth Token */}
          <div className="flex items-center gap-2.5 shrink-0">
            {campaigns.length > 0 && (
              <div className="relative">
                <select
                  value={selectedCampaignId}
                  onChange={(e) => onSelectCampaign(e.target.value)}
                  className="max-w-[190px] sm:max-w-[240px] truncate text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 pr-7 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
              title="Coordinator sign-in · private token"
              aria-label="Coordinator sign-in"
              className={`p-2 rounded-xl border transition-all ${
                authToken
                  ? 'bg-mint-50 border-mint-200 text-mint-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
            >
              <KeyRound className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="lg:hidden flex overflow-x-auto py-2 gap-1.5 scrollbar-none border-t border-slate-100">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 bg-slate-100/80 border border-slate-200/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-mint-100 text-mint-800'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Auth Token Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-soft-lg border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-brand-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-slate-900">
                  Coordinator sign-in
                </h3>
                <p className="text-xs text-slate-500">
                  Enter a private coordinator token to access protected operations.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bearer Token
              </label>
              <input
                type="password"
                value={tempToken}
                onChange={(e) => setTempToken(e.target.value)}
                placeholder="Private coordinator token"
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Stored in browser local storage for API calls.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTokenModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onSaveToken(tempToken);
                  setShowTokenModal(false);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white hover:bg-brand-700 shadow-sm"
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
