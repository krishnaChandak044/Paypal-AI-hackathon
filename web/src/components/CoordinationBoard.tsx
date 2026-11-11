import React, { useState, useEffect } from 'react';
import { BoardData, BoardNeed, PayoutItem } from '../types';
import { api } from '../api';
import { HandDrawnCheck, CommunityShelterSvg } from './OrganicIllustration';
import { PayPalPayoutModal } from './PayPalPayoutModal';
import { GeographicClusterMap } from './GeographicClusterMap';
import {
  AlertCircle,
  Clock,
  DollarSign,
  ArrowRight,
  CheckCircle,
  FileSpreadsheet,
  PlusCircle,
  Layers,
  Zap,
  CreditCard,
  Send,
  ExternalLink,
  Map,
} from 'lucide-react';

interface CoordinationBoardProps {
  boardData: BoardData | null;
  campaignId: string;
  onRefresh: () => void;
  onRequestTriage: () => void;
}

export const CoordinationBoard: React.FC<CoordinationBoardProps> = ({
  boardData,
  campaignId,
  onRefresh,
  onRequestTriage,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [selectedNeed, setSelectedNeed] = useState<BoardNeed | null>(null);
  const [payoutNeed, setPayoutNeed] = useState<BoardNeed | null>(null);
  const [payoutsList, setPayoutsList] = useState<PayoutItem[]>([]);
  const [reserveAmount, setReserveAmount] = useState<string>('');
  const [reserveRef, setReserveRef] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const loadPayouts = async () => {
    if (!campaignId) return;
    try {
      const data = await api.getCampaignPayouts(campaignId);
      setPayoutsList(data || []);
    } catch (err) {
      console.error('Failed to load payouts list:', err);
    }
  };

  useEffect(() => {
    loadPayouts();
  }, [campaignId]);

  const pool = boardData?.pool;
  const needs = boardData?.needs || [];
  const currency = boardData?.currency || 'USD';

  const totalReserved = needs.reduce((sum, n) => sum + n.reserved_minor, 0);
  const totalSpent = needs.reduce((sum, n) => sum + n.spent_minor, 0);
  const totalUnmet = needs.reduce((sum, n) => sum + n.unmet_minor, 0);
  const totalDisbursedViaPayouts = payoutsList.filter((p) => p.status === 'SUCCESS').reduce((sum, p) => sum + p.amount_minor, 0);

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNeed) return;

    const amountMinor = Math.round(parseFloat(reserveAmount) * 100);
    if (isNaN(amountMinor) || amountMinor <= 0) {
      setActionMessage({ type: 'error', text: 'Enter a valid reservation amount.' });
      return;
    }

    setIsActionLoading(true);
    setActionMessage(null);

    try {
      const refCode = reserveRef.trim() || `res-${Date.now()}`;
      await api.reserveNeed(selectedNeed.need_id, amountMinor, refCode);
      setActionMessage({
        type: 'success',
        text: `Reserved $${(amountMinor / 100).toFixed(2)} from pool for "${selectedNeed.description}"`,
      });
      setSelectedNeed(null);
      setReserveAmount('');
      setReserveRef('');
      onRefresh();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to reserve pool funds.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePayoutSuccess = (payout: PayoutItem) => {
    setActionMessage({
      type: payout.status === 'FAILED' ? 'error' : payout.status === 'SUCCESS' ? 'success' : 'info',
      text: payout.status === 'SUCCESS'
        ? `PayPal confirmed a $${(payout.amount_minor / 100).toFixed(2)} payout (Batch #${payout.payout_batch_id}).`
        : payout.status === 'FAILED'
          ? `PayPal reported the $${(payout.amount_minor / 100).toFixed(2)} payout failed; the pool reservation was released.`
          : `PayPal payout status is ${payout.status}. The amount remains reserved pending reconciliation.`,
    });
    loadPayouts();
    onRefresh();
  };

  const refreshPayoutStatus = async (payout: PayoutItem) => {
    setIsActionLoading(true);
    setActionMessage(null);
    try {
      const updated = payout.payout_batch_id
        ? await api.reconcilePayout(payout.payout_id)
        : await api.retryPayout(payout.payout_id);
      setPayoutsList((items) => items.map((item) => item.payout_id === payout.payout_id ? updated : item));
      setActionMessage({
        type: updated.status === 'SUCCESS' ? 'success' : updated.status === 'FAILED' ? 'error' : 'info',
        text: updated.status === 'SUCCESS'
          ? 'PayPal confirmed this payout. The spend is recorded in the ledger.'
          : updated.status === 'FAILED'
            ? 'PayPal confirmed failure. The reserved amount has been released.'
            : `Provider status: ${updated.status}. The amount remains reserved.`,
      });
      onRefresh();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Could not refresh the PayPal payout status.' });
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-10 py-6">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-brand-600 font-semibold text-xs tracking-wider uppercase">
            <Layers className="w-4 h-4" />
            <span>Central Operations</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mt-1">
            Commitment &amp; Gap Board
          </h2>
          <p className="text-sm text-slate-500 max-w-2xl mt-1">
            Real-time projection of approved relief needs against confirmed emergency pool balances.
            Every row shows what is approved, funded, and still unmet.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRequestTriage}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Review Incoming Requests</span>
          </button>
        </div>
      </div>

      {/* Aggregate Balance Metric Tiles in Soft Pastels */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-soft space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Confirmed Pool Funds
          </span>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
            ${pool ? (pool.confirmed_minor / 100).toFixed(2) : '0.00'}{' '}
            <span className="text-xs font-sans text-slate-400 font-normal">{currency}</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Verified donor contributions via PayPal
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-soft space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-mint-700">
            Available to Allocate
          </span>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-mint-800">
            ${pool ? (pool.available_minor / 100).toFixed(2) : '0.00'}{' '}
            <span className="text-xs font-sans text-slate-400 font-normal">{currency}</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Free cash ready for urgent relief purchase
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-soft space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
            Reserved for Needs
          </span>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-brand-800">
            ${(totalReserved / 100).toFixed(2)}{' '}
            <span className="text-xs font-sans text-slate-400 font-normal">{currency}</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Committed to approved volunteers/items
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-soft space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Remaining Unmet Gap
          </span>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-amber-800">
            ${(totalUnmet / 100).toFixed(2)}{' '}
            <span className="text-xs font-sans text-slate-400 font-normal">{currency}</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Approved aid waiting on additional pool inflow
          </p>
        </div>
      </div>

      {pool && pool.deficit_minor > 0 && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <strong>Pool deficit recorded:</strong> ${(pool.deficit_minor / 100).toFixed(2)} {currency}. A verified refund or reversal exceeded currently unspent funds; new allocations will be blocked until the balance is replenished.
        </div>
      )}

      {actionMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-medium flex items-center gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-mint-50 border border-mint-200 text-mint-900'
              : actionMessage.type === 'info'
                ? 'bg-sky-50 border border-sky-200 text-sky-900'
                : 'bg-red-50 border border-red-200 text-red-900'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <HandDrawnCheck className="w-4 h-4 text-mint-600" />
          ) : actionMessage.type === 'info' ? (
            <Clock className="w-4 h-4 text-sky-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* The Commitment & Gap Table or Sector Map View */}
      <div className="bg-white rounded-4xl border border-slate-200/80 shadow-soft overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CommunityShelterSvg className="w-5 h-5 text-brand-600" />
            <h3 className="font-serif text-lg font-bold text-slate-900">
              Approved Relief Needs ({needs.length})
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-brand-700 shadow-xs border border-slate-200/60 font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Table View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'map'
                    ? 'bg-white text-brand-700 shadow-xs border border-slate-200/60 font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Map className="w-3.5 h-3.5 text-brand-500" />
                <span>Synthetic scenario map</span>
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'map' ? (
          <div className="p-6">
            <GeographicClusterMap campaignId={campaignId} />
          </div>
        ) : needs.length === 0 ? (
          <div className="text-center py-16 px-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h4 className="font-serif text-base font-bold text-slate-800">
              No Approved Needs on the Board Yet
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Incoming requests must be drafted and approved by human coordinators before appearing on the commitment board.
            </p>
            <button
              onClick={onRequestTriage}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors mt-2"
            >
              <span>Go to Request Triage &amp; AI Assistant</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/60 text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-6 font-semibold">Need / Essential Item</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Requested</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Reserved</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Spent</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Unmet Gap</th>
                  <th className="py-3.5 px-6 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {needs.map((item) => {
                  const isFullyFunded = item.unmet_minor === 0;
                  return (
                    <tr key={item.need_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          {isFullyFunded ? (
                            <CheckCircle className="w-4 h-4 text-mint-600 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-brand-500 shrink-0" />
                          )}
                          <span className="font-semibold text-sm">{item.description}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-slate-700">
                        ${(item.requested_minor / 100).toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-slate-800">
                        ${(item.reserved_minor / 100).toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-mint-700">
                        ${(item.spent_minor / 100).toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-amber-700">
                        ${(item.unmet_minor / 100).toFixed(2)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {item.unmet_minor > 0 ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPayoutNeed(item)}
                              className="px-3 py-1.5 rounded-xl bg-[#0070BA] hover:bg-[#005ea6] text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
                              title="Instant emergency fast-grant disbursal via PayPal Payouts"
                            >
                              <Zap className="w-3.5 h-3.5 text-sky-200" />
                              <span>PayPal Payout</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedNeed(item);
                                setReserveAmount((item.unmet_minor / 100).toFixed(2));
                                setReserveRef(`res-${item.need_id.substring(0, 6)}`);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                              title="Reserve funds internally on ledger"
                            >
                              Reserve
                            </button>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-mint-50 text-mint-700 border border-mint-200 text-[10px] font-bold">
                            Fully Covered
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fund Reservation Modal */}
      {selectedNeed && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-soft-lg border border-slate-200 space-y-4">
            <div>
              <div className="flex items-center gap-2 text-brand-600 text-xs font-bold uppercase tracking-wider">
                <DollarSign className="w-4 h-4" />
                <span>Emergency Pool Reservation</span>
              </div>
              <h3 className="font-serif text-xl font-bold text-slate-900 mt-1">
                Allocate for "{selectedNeed.description}"
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Locks pool balance for this approved need so coordinators can make the purchase.
              </p>
            </div>

            <form onSubmit={handleReserve} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount to Reserve (in {currency})
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={(selectedNeed.unmet_minor / 100).toFixed(2)}
                    value={reserveAmount}
                    onChange={(e) => setReserveAmount(e.target.value)}
                    required
                    className="w-full text-sm font-semibold pl-7 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Max unmet for this need: ${(selectedNeed.unmet_minor / 100).toFixed(2)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ledger Reference Code
                </label>
                <input
                  type="text"
                  value={reserveRef}
                  onChange={(e) => setReserveRef(e.target.value)}
                  required
                  placeholder="e.g. res-flood-groceries-01"
                  className="w-full text-xs font-mono p-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedNeed(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:opacity-50"
                >
                  {isActionLoading ? 'Reserving...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Two-Way PayPal Money Flow: Inflow vs Outflow Transparency */}
      <div className="bg-white rounded-4xl p-6 sm:p-8 border border-slate-200/80 shadow-soft space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0070BA]/10 text-[#0070BA] font-bold text-xs border border-[#0070BA]/20 mb-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>Two-Way Closed Loop &bull; PayPal Orders v2 (Inflow) + PayPal Payouts v1 (Outflow)</span>
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-slate-900">
              Direct Emergency Grants Disbursal Log
            </h3>
            <p className="text-xs text-slate-500 max-w-2xl mt-1">
              Sandbox payout requests are tracked by provider status. Only a PayPal-confirmed payout item is counted as disbursed.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Disbursed</span>
              <span className="font-serif text-lg font-bold text-brand-700">
                ${(totalDisbursedViaPayouts / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Payouts Table */}
        {payoutsList.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 space-y-2">
            <Send className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">No PayPal payout requests yet</p>
            <p className="max-w-md mx-auto">
              Create a sandbox payout request from an approved need. Pending requests remain reserved until provider confirmation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-100">
                  <th className="py-2.5 font-bold">Recipient / Lead</th>
                  <th className="py-2.5 font-bold">Category</th>
                  <th className="py-2.5 font-bold">PayPal Batch ID</th>
                  <th className="py-2.5 font-bold">Relief Purpose</th>
                  <th className="py-2.5 text-right font-bold">Amount</th>
                  <th className="py-2.5 text-center font-bold">Status</th>
                  <th className="py-2.5 text-center font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {payoutsList.map((p) => (
                  <tr key={p.payout_id} className="hover:bg-slate-50/60">
                    <td className="py-3 font-bold text-slate-900">
                      <div>
                        <span>{p.recipient_name}</span>
                        <span className="block text-[11px] font-mono text-slate-400 font-normal">
                          {p.recipient_email}
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold capitalize">
                        {p.recipient_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-600 text-[11px]">
                      {p.payout_batch_id || 'Awaiting PayPal batch'}
                    </td>
                    <td className="py-3 text-slate-600 max-w-xs truncate" title={p.purpose_note}>
                      {p.purpose_note}
                    </td>
                    <td className="py-3 text-right font-bold text-slate-900">
                      ${(p.amount_minor / 100).toFixed(2)}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'SUCCESS' ? 'bg-mint-50 text-mint-700 border border-mint-200' : p.status === 'FAILED' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      {['PENDING', 'RECONCILIATION_REQUIRED', 'LEGACY_UNVERIFIED'].includes(p.status) && (
                        <button type="button" disabled={isActionLoading} onClick={() => refreshPayoutStatus(p)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-brand-700 hover:bg-sky-50 disabled:opacity-50">
                          {p.payout_batch_id ? 'Check PayPal' : 'Retry safely'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PayPal Payout Fast-Grant Modal */}
      {payoutNeed && (
        <PayPalPayoutModal
          need={payoutNeed}
          campaignCurrency={currency}
          onClose={() => setPayoutNeed(null)}
          onSuccess={handlePayoutSuccess}
        />
      )}
    </div>
  );
};
