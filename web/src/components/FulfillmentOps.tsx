import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { ExceptionCaseItem, ResourceItem, UnreconciledItem } from '../types';
import { HandDrawnCheck } from './OrganicIllustration';
import { ReceiptScannerSection } from './ReceiptScannerSection';
import {
  ReceiptText,
  AlertOctagon,
  Boxes,
  Plus,
  CheckCircle,
  FileCheck,
  AlertTriangle,
} from 'lucide-react';

interface FulfillmentOpsProps {
  campaignId: string;
  onRefreshBoard: () => void;
}

export const FulfillmentOps: React.FC<FulfillmentOpsProps> = ({
  campaignId,
  onRefreshBoard,
}) => {
  const [unreconciled, setUnreconciled] = useState<UnreconciledItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionCaseItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [selectedSpendId, setSelectedSpendId] = useState<string | null>(null);
  const [vendor, setVendor] = useState('');
  const [receiptRef, setReceiptRef] = useState('');
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().substring(0, 10));

  const [resDesc, setResDesc] = useState('');
  const [resQty, setResQty] = useState('');
  const [resSource, setResSource] = useState('');

  const [excReason, setExcReason] = useState('');
  const [excOwner, setExcOwner] = useState('');

  const loadOpsData = async () => {
    if (!campaignId) return;
    try {
      const [u, r, e] = await Promise.all([
        api.getUnreconciled(campaignId).catch(() => []),
        api.getResources(campaignId).catch(() => []),
        api.getExceptions(campaignId).catch(() => []),
      ]);
      setUnreconciled(u);
      setResources(r);
      setExceptions(e);
    } catch (err: any) {
      console.error('Failed to load ops data:', err);
    }
  };

  useEffect(() => {
    loadOpsData();
  }, [campaignId]);

  const handleAttachReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpendId || !vendor.trim() || !receiptRef.trim()) return;

    try {
      const res = await api.attachReceipt(
        selectedSpendId,
        vendor.trim(),
        receiptRef.trim(),
        occurredAt
      );
      await api.reconcileReceipt(res.id);
      setStatusMessage({
        type: 'success',
        text: `Receipt attached and reconciled for vendor "${vendor}".`,
      });
      setSelectedSpendId(null);
      setVendor('');
      setReceiptRef('');
      await loadOpsData();
      onRefreshBoard();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to attach receipt' });
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resDesc.trim() || !resSource.trim() || !campaignId) return;

    const qty = parseInt(resQty, 10) || 1;
    try {
      await api.addResource(campaignId, resDesc.trim(), qty, resSource.trim());
      setStatusMessage({ type: 'success', text: `Added resource: ${resDesc}` });
      setResDesc('');
      setResQty('');
      setResSource('');
      await loadOpsData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to add resource' });
    }
  };

  const handleAddException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excReason.trim() || !campaignId) return;

    try {
      await api.addException(campaignId, excReason.trim(), excOwner.trim() || 'coordinator-01');
      setStatusMessage({ type: 'success', text: `Exception logged: ${excReason}` });
      setExcReason('');
      setExcOwner('');
      await loadOpsData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to add exception' });
    }
  };

  return (
    <div className="space-y-10 py-6">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-6">
        <div className="flex items-center gap-2 text-brand-600 font-semibold text-xs tracking-wider uppercase">
          <ReceiptText className="w-4 h-4" />
          <span>Offline Reality &amp; Reconciliation</span>
        </div>
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mt-1">
          Fulfillment, Receipts &amp; In-Kind Inventory
        </h2>
        <p className="text-sm text-slate-500 max-w-2xl mt-1">
          Disasters happen offline. Track cash purchases made at local hardware stores and pharmacies,
          attach receipts for finance reconciliation, and log in-kind supplies alongside cash.
        </p>
      </div>

      {/* Star Player Feature: Multimodal AI Receipt Scanner & Policy Audit */}
      <ReceiptScannerSection
        campaignId={campaignId}
        onRefreshBoard={() => {
          loadOpsData();
          if (onRefreshBoard) onRefreshBoard();
        }}
      />

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-medium flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-mint-50 border border-mint-200 text-mint-900'
              : 'bg-red-50 border border-red-200 text-red-900'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <HandDrawnCheck className="w-4 h-4 text-mint-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Grid: Left = Receipts & Spending Reconciliation; Right = Resources & Exceptions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Unreconciled Spending Queue */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-4xl p-6 sm:p-7 border border-slate-200/80 shadow-soft space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-brand-600" />
                <h3 className="font-serif text-lg font-bold text-slate-900">
                  Spending &amp; Receipt Audit Queue
                </h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {unreconciled.length} Pending
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Every spend event on the ledger must have an itemized receipt attached and approved by a finance member before final audit sign-off.
            </p>

            <div className="divide-y divide-slate-100">
              {unreconciled.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-1">
                  <CheckCircle className="w-8 h-8 text-mint-600 mx-auto" />
                  <p className="font-semibold text-slate-700">All spending records reconciled</p>
                  <p>No missing or pending receipts in this campaign.</p>
                </div>
              ) : (
                unreconciled.map((item) => (
                  <div key={item.ledger_id} className="py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-mono text-slate-400 block">
                        Ledger: #{item.ledger_id.substring(0, 8)}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        ${(item.amount_minor / 100).toFixed(2)}
                      </span>
                      <span className="text-[10px] ml-2 px-2 py-0.5 rounded-full bg-sky-50 text-brand-700 border border-sky-200 font-semibold uppercase">
                        {item.receipt_status}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedSpendId(item.ledger_id)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-brand-600 hover:text-white text-slate-800 text-xs font-bold transition-colors shadow-sm"
                    >
                      Attach Receipt
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Receipt Modal */}
          {selectedSpendId && (
            <div className="p-6 rounded-3xl bg-sky-50/70 border border-sky-200 space-y-4">
              <h4 className="font-serif text-base font-bold text-slate-900">
                Attach Itemized Receipt for Ledger #{selectedSpendId.substring(0, 8)}
              </h4>
              <form onSubmit={handleAttachReceipt} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Merchant / Vendor Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Pine Creek Hardware"
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      required
                      className="w-full text-xs p-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Receipt Ref / Slip #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. RCPT-9842"
                      value={receiptRef}
                      onChange={(e) => setReceiptRef(e.target.value)}
                      required
                      className="w-full text-xs p-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Date of Purchase
                  </label>
                  <input
                    type="date"
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                    required
                    className="w-full text-xs p-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSpendId(null)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl text-xs font-bold bg-brand-600 text-white hover:bg-brand-700 shadow-sm"
                  >
                    Submit &amp; Reconcile
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right: In-Kind Resources & Exception Log */}
        <div className="lg:col-span-6 space-y-6">
          {/* In-Kind Resources */}
          <div className="bg-white rounded-4xl p-6 sm:p-7 border border-slate-200/80 shadow-soft space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-mint-700" />
                <h3 className="font-serif text-lg font-bold text-slate-900">
                  In-Kind Stock &amp; Volunteer Capacity
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {resources.length} Registered
              </span>
            </div>

            <form onSubmit={handleAddResource} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Description (e.g. 50 Fleece Blankets)"
                value={resDesc}
                onChange={(e) => setResDesc(e.target.value)}
                required
                className="flex-1 text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <input
                type="number"
                min="1"
                placeholder="Qty"
                value={resQty}
                onChange={(e) => setResQty(e.target.value)}
                required
                className="w-16 text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <input
                type="text"
                placeholder="Source / Donor"
                value={resSource}
                onChange={(e) => setResSource(e.target.value)}
                required
                className="w-32 text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <button
                type="submit"
                className="px-3.5 py-2.5 rounded-xl bg-mint-700 hover:bg-mint-800 text-white text-xs font-bold shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <div className="space-y-2 max-h-52 overflow-y-auto">
              {resources.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No in-kind supplies recorded yet.
                </p>
              ) : (
                resources.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 block">{r.description}</span>
                      <span className="text-[10px] text-slate-500">Source: {r.source}</span>
                    </div>
                    <span className="font-bold text-mint-800 px-2.5 py-1 rounded-lg bg-mint-100 text-xs">
                      Qty: {r.quantity}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Exceptions Queue */}
          <div className="bg-white rounded-4xl p-6 sm:p-7 border border-slate-200/80 shadow-soft space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-amber-600" />
                <h3 className="font-serif text-lg font-bold text-slate-900">
                  Exception Desk ({exceptions.length})
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">Accountable Owners</span>
            </div>

            <form onSubmit={handleAddException} className="space-y-2">
              <input
                type="text"
                placeholder="Log exception (e.g. Generator price spiked +$40 at hardware store)"
                value={excReason}
                onChange={(e) => setExcReason(e.target.value)}
                required
                className="w-full text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition-colors"
                >
                  Log Exception
                </button>
              </div>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {exceptions.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No active exceptions. All fulfillment paths proceeding normally.
                </p>
              ) : (
                exceptions.map((exc) => (
                  <div
                    key={exc.id}
                    className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200/70 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-slate-900 block">{exc.reason}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Owner: {exc.owner_id}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase">
                      {exc.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
