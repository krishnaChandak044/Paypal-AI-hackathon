import React, { useState } from 'react';
import { BoardData, BoardNeed } from '../types';
import { api } from '../api';
import { HandDrawnCheck, CommunityShelterSvg } from './OrganicIllustration';
import {
  AlertCircle,
  Clock,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  CheckCircle,
  FileSpreadsheet,
  PlusCircle,
  Layers,
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
  const [selectedNeed, setSelectedNeed] = useState<BoardNeed | null>(null);
  const [reserveAmount, setReserveAmount] = useState<string>('');
  const [reserveRef, setReserveRef] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const pool = boardData?.pool;
  const needs = boardData?.needs || [];
  const currency = boardData?.currency || 'USD';

  const totalRequested = needs.reduce((sum, n) => sum + n.requested_minor, 0);
  const totalReserved = needs.reduce((sum, n) => sum + n.reserved_minor, 0);
  const totalSpent = needs.reduce((sum, n) => sum + n.spent_minor, 0);
  const totalUnmet = needs.reduce((sum, n) => sum + n.unmet_minor, 0);

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

  return (
    <div className="space-y-10 py-6">
      {/* Section Header with Warm Minimalism */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-warm-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-clay-600 font-semibold text-xs tracking-wider uppercase">
            <Layers className="w-4 h-4" />
            <span>Central Operations</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-warm-900 mt-1">
            Commitment &amp; Gap Board
          </h2>
          <p className="text-sm text-warm-500 max-w-2xl mt-1">
            Real-time projection of approved relief needs against confirmed emergency pool balances.
            Every row shows what is approved, funded, and still unmet.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRequestTriage}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-clay-600 text-white text-xs font-bold hover:bg-clay-700 shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Review Incoming Requests</span>
          </button>
        </div>
      </div>

      {/* Aggregate Balance Metric Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="p-5 rounded-3xl bg-white border border-warm-200/80 shadow-warm space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-warm-500">
            Confirmed Pool Funds
          </span>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-warm-900">
            ${pool ? (pool.confirmed_minor / 100).toFixed(2) : '0.00'}{' '}
            <span className="text-xs font-sans text-warm-400 font-normal">{currency}</span>
          </div>
          <p className="text-[11px] text-warm-400">
            Verified donor contributions via PayPal
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-warm-200/80 shadow-warm space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-sage-700">
            Available to Allocate
          </span>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-sage-800">
            ${pool ? (pool.available_minor / 100).toFixed(2) : '0.00'}{' '}
            <span className="text-xs font-sans text-warm-400 font-normal">{currency}</span>
          </div>
          <p className="text-[11px] text-warm-400">
            Free cash ready for urgent relief purchase
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-warm-200/80 shadow-warm space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-warm-600">
            Reserved for Needs
          </span>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-warm-800">
            ${(totalReserved / 100).toFixed(2)}{' '}
            <span className="text-xs font-sans text-warm-400 font-normal">{currency}</span>
          </div>
          <p className="text-[11px] text-warm-400">
            Committed to approved volunteers/items
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-warm-200/80 shadow-warm space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-clay-700">
            Remaining Unmet Gap
          </span>
          <div className="font-serif text-2xl sm:text-3xl font-bold text-clay-800">
            ${(totalUnmet / 100).toFixed(2)}{' '}
            <span className="text-xs font-sans text-warm-400 font-normal">{currency}</span>
          </div>
          <p className="text-[11px] text-warm-400">
            Approved aid waiting on additional pool inflow
          </p>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-medium flex items-center gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-sage-50 border border-sage-200 text-sage-900'
              : 'bg-red-50 border border-red-200 text-red-900'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <HandDrawnCheck className="w-4 h-4 text-sage-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* The Commitment & Gap Table / Card List */}
      <div className="bg-white rounded-4xl border border-warm-200/80 shadow-warm overflow-hidden">
        <div className="p-6 border-b border-warm-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CommunityShelterSvg className="w-5 h-5 text-clay-600" />
            <h3 className="font-serif text-lg font-bold text-warm-900">
              Approved Relief Needs ({needs.length})
            </h3>
          </div>
          <span className="text-xs text-warm-400 font-medium">
            Human approved &bull; Traceable to ledger
          </span>
        </div>

        {needs.length === 0 ? (
          <div className="text-center py-16 px-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-warm-100 text-warm-400 mx-auto flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h4 className="font-serif text-base font-bold text-warm-800">
              No Approved Needs on the Board Yet
            </h4>
            <p className="text-xs text-warm-500 max-w-md mx-auto">
              Incoming requests must be drafted and approved by human organizers before appearing on the commitment board.
            </p>
            <button
              onClick={onRequestTriage}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-warm-100 hover:bg-warm-200 text-warm-800 text-xs font-semibold transition-colors mt-2"
            >
              <span>Go to Request Triage &amp; AI Assistant</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-warm-50/70 border-b border-warm-200/60 text-warm-500 uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-6 font-semibold">Need / Essential Item</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Requested</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Reserved</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Spent</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Unmet Gap</th>
                  <th className="py-3.5 px-6 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {needs.map((item) => {
                  const isFullyFunded = item.unmet_minor === 0;
                  return (
                    <tr key={item.need_id} className="hover:bg-warm-50/50 transition-colors">
                      <td className="py-4 px-6 font-medium text-warm-900">
                        <div className="flex items-center gap-2">
                          {isFullyFunded ? (
                            <CheckCircle className="w-4 h-4 text-sage-600 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-clay-500 shrink-0" />
                          )}
                          <span className="font-semibold text-sm">{item.description}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-warm-700">
                        ${(item.requested_minor / 100).toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-warm-800">
                        ${(item.reserved_minor / 100).toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-sage-700">
                        ${(item.spent_minor / 100).toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-clay-700">
                        ${(item.unmet_minor / 100).toFixed(2)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {item.unmet_minor > 0 ? (
                          <button
                            onClick={() => {
                              setSelectedNeed(item);
                              setReserveAmount((item.unmet_minor / 100).toFixed(2));
                              setReserveRef(`res-${item.need_id.substring(0, 6)}`);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-warm-100 hover:bg-clay-50 hover:text-clay-700 text-warm-700 font-bold text-xs border border-warm-200 transition-colors"
                          >
                            Reserve Pool
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-sage-50 text-sage-700 border border-sage-200 text-[10px] font-bold">
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
        <div className="fixed inset-0 z-50 bg-warm-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-warm-lg border border-warm-200 space-y-5">
            <div>
              <div className="flex items-center gap-2 text-clay-600 text-xs font-bold uppercase tracking-wider">
                <DollarSign className="w-4 h-4" />
                <span>Emergency Pool Reservation</span>
              </div>
              <h3 className="font-serif text-xl font-bold text-warm-900 mt-1">
                Allocate for "{selectedNeed.description}"
              </h3>
              <p className="text-xs text-warm-500 mt-1">
                Locks pool balance for this approved need so case workers can make the purchase.
              </p>
            </div>

            <form onSubmit={handleReserve} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-warm-700 mb-1">
                  Amount to Reserve (in {currency})
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-warm-400">
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
                    className="w-full text-sm font-semibold pl-7 pr-3 py-2.5 rounded-xl bg-warm-50 border border-warm-200 focus:outline-none focus:ring-2 focus:ring-clay-500/30"
                  />
                </div>
                <p className="text-[10px] text-warm-400 mt-1">
                  Max unmet for this need: ${(selectedNeed.unmet_minor / 100).toFixed(2)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-warm-700 mb-1">
                  Ledger Reference Code
                </label>
                <input
                  type="text"
                  value={reserveRef}
                  onChange={(e) => setReserveRef(e.target.value)}
                  required
                  placeholder="e.g. res-flood-groceries-01"
                  className="w-full text-xs font-mono p-2.5 rounded-xl bg-warm-50 border border-warm-200 focus:outline-none focus:ring-2 focus:ring-clay-500/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedNeed(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-warm-600 hover:bg-warm-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-clay-600 text-white hover:bg-clay-700 shadow-sm disabled:opacity-50"
                >
                  {isActionLoading ? 'Reserving...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
