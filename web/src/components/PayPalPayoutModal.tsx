import React, { useState } from 'react';
import { api } from '../api';
import { BoardNeed, PayoutItem } from '../types';
import {
  CreditCard,
  Send,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  User,
  Mail,
  DollarSign,
  FileText,
  X,
  Zap,
} from 'lucide-react';

interface PayPalPayoutModalProps {
  need: BoardNeed;
  campaignCurrency: string;
  onClose: () => void;
  onSuccess: (payout: PayoutItem) => void;
}

export const PayPalPayoutModal: React.FC<PayPalPayoutModalProps> = ({
  need,
  campaignCurrency,
  onClose,
  onSuccess,
}) => {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientType, setRecipientType] = useState<'volunteer_lead' | 'certified_supplier' | 'displaced_family'>('volunteer_lead');
  
  // Default to remaining unmet amount
  const defaultAmount = (need.unmet_minor / 100).toFixed(2);
  const [amountStr, setAmountStr] = useState(defaultAmount === '0.00' ? (need.requested_minor / 100).toFixed(2) : defaultAmount);
  const [purposeNote, setPurposeNote] = useState(`Direct emergency grant for: ${need.description}`);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payoutResult, setPayoutResult] = useState<PayoutItem | null>(null);
  const [payoutExplanation, setPayoutExplanation] = useState<{ explanation: string; suggested_next_step: string; disclaimer: string } | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const handleDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountMinor = Math.round(parseFloat(amountStr) * 100);
    if (isNaN(amountMinor) || amountMinor <= 0) {
      setErrorMessage('Please enter a valid disbursement amount.');
      return;
    }

    if (!recipientEmail || !recipientEmail.includes('@')) {
      setErrorMessage('Please provide a valid PayPal recipient email.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await api.disbursePayPalPayout(need.need_id, {
        recipient_email: recipientEmail.trim(),
        recipient_name: recipientName.trim(),
        recipient_type: recipientType,
        amount_minor: amountMinor,
        purpose_note: purposeNote.trim(),
      });

      setPayoutResult(res);
      onSuccess(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to disburse payout via PayPal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const explainPayout = async () => {
    if (!payoutResult) return;
    setIsExplaining(true);
    setErrorMessage(null);
    try {
      const explanation = await api.explainPayout(payoutResult.payout_id);
      setPayoutExplanation(explanation);
    } catch (err: any) {
      setErrorMessage(err.message || 'AI explanation is unavailable for this case.');
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-4xl max-w-lg w-full p-6 sm:p-8 shadow-soft-lg border border-slate-200 relative space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#0070BA]/10 text-[#0070BA] flex items-center justify-center font-bold text-lg border border-[#0070BA]/20">
            <Zap className="w-6 h-6 text-[#0070BA]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0070BA]">
                PayPal Payouts v1 &bull; Outflow Rail
              </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Sandbox • provider status pending
              </span>
            </div>
            <h3 className="font-serif text-xl font-bold text-slate-900">
              Disburse Emergency Fast-Grant
            </h3>
          </div>
        </div>

        {/* Need Target Card */}
        <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-100 space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Target Relief Need:</span>
          <p className="text-xs font-bold text-slate-900">{need.description}</p>
          <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1">
            <span>Approved Budget: <strong>${(need.requested_minor / 100).toFixed(2)}</strong></span>
            <span>Remaining Unmet: <strong>${(need.unmet_minor / 100).toFixed(2)}</strong></span>
          </div>
        </div>

        {payoutResult ? (
          /* Provider result screen */
          <div className="space-y-5 text-center py-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto border ${payoutResult.status === 'SUCCESS' ? 'bg-mint-100 text-mint-600 border-mint-200' : payoutResult.status === 'FAILED' ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-amber-100 text-amber-600 border-amber-200'}`}>
              {payoutResult.status === 'SUCCESS' ? <CheckCircle2 className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
            </div>

            <div className="space-y-1">
              <h4 className="font-serif text-lg font-bold text-slate-900">
                {payoutResult.status === 'SUCCESS' ? 'PayPal confirmed the payout' : payoutResult.status === 'FAILED' ? 'PayPal reported the payout failed' : 'Payout is awaiting confirmation'}
              </h4>
              <p className="text-xs text-slate-500">
                {payoutResult.status === 'SUCCESS' ? 'PayPal confirmed the payout item. The pool ledger records the spend.' : payoutResult.status === 'FAILED' ? 'The reserved pool amount was released after PayPal reported failure.' : 'The pool amount remains reserved while ReliefRail checks PayPal. Do not retry until its status is reconciled.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">PayPal Batch ID:</span>
                <span className="font-bold text-slate-800">{payoutResult.payout_batch_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Recipient:</span>
                <span className="text-slate-800">{payoutResult.recipient_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="font-bold text-mint-700">${(payoutResult.amount_minor / 100).toFixed(2)} {payoutResult.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">PayPal Payout Fee:</span>
                <span className="text-slate-600">${(payoutResult.fee_minor / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ledger Entry:</span>
                <span className="text-slate-600">{payoutResult.ledger_id ? `#${payoutResult.ledger_id.substring(0, 10)}` : 'Reserved pending provider confirmation'}</span>
              </div>
            </div>

            <div className="space-y-3 text-left">
              {payoutExplanation ? (
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-xs text-violet-950 space-y-2">
                  <strong>AI status explanation (advisory)</strong>
                  <p>{payoutExplanation.explanation}</p>
                  <p><strong>Next step:</strong> {payoutExplanation.suggested_next_step}</p>
                  <p className="text-[10px] text-violet-700">{payoutExplanation.disclaimer}</p>
                </div>
              ) : (
                <button type="button" onClick={explainPayout} disabled={isExplaining} className="w-full rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 disabled:opacity-50">
                  {isExplaining ? 'Explaining synthetic payout facts…' : 'Explain this synthetic payout with AI'}
                </button>
              )}
              {errorMessage && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">{errorMessage}</p>}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
            >
              Done &amp; Return to Gap Board
            </button>
          </div>
        ) : (
          /* Disbursal Form */
          <form onSubmit={handleDisburse} className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-950">
              This sends a PayPal Sandbox payout to the entered PayPal email. It is not direct merchant checkout or a supplier marketplace.
            </div>
            {/* Recipient Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Recipient Name / Entity
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  required
                  placeholder="e.g. Capt. Michael Daniels"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  PayPal Email / ID
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  required
                  placeholder="responder@riverbend-relief.org"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>

            {/* Amount & Purpose */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Amount ({campaignCurrency})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1.00"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    required
                    className="w-full text-xs font-bold pl-7 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Recipient Category
                </label>
                <select
                  value={recipientType}
                  onChange={(e: any) => setRecipientType(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="volunteer_lead">Volunteer Responder / Field Captain</option>
                  <option value="certified_supplier">Supplier / test payee (PayPal email)</option>
                  <option value="displaced_family">Displaced Household / Direct Aid</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Purpose note (basic keyword screen)
              </label>
              <textarea
                rows={2}
                value={purposeNote}
                onChange={(e) => setPurposeNote(e.target.value)}
                required
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder="Specific humanitarian reason for payout..."
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-[11px] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
              <span>A simple keyword screen can flag selected terms; it does not verify compliance. A human must review the payment.</span>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#0070BA] hover:bg-[#005ea6] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 disabled:bg-slate-300"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Disbursing via PayPal...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Sandbox payout (${amountStr})</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
