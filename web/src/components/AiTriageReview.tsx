import React, { useState, useEffect } from 'react';
import { AidRequest, AiDraftResult } from '../types';
import { api } from '../api';
import { HandDrawnSparkle, HandDrawnCheck } from './OrganicIllustration';
import {
  Sparkles,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Plus,
  Send,
  UserCheck,
  FileText,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface AiTriageReviewProps {
  campaignId: string;
  onRefreshBoard: () => void;
}

export const AiTriageReview: React.FC<AiTriageReviewProps> = ({
  campaignId,
  onRefreshBoard,
}) => {
  const [requests, setRequests] = useState<AidRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiDrafts, setAiDrafts] = useState<Record<string, AiDraftResult>>({});
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New manual need fields
  const [manualDescription, setManualDescription] = useState('');
  const [manualAmount, setManualAmount] = useState('');

  const loadRequests = async () => {
    if (!campaignId) return;
    try {
      const data = await api.getRequests(campaignId);
      setRequests(data);
      if (data.length > 0 && !selectedRequestId) {
        setSelectedRequestId(data[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load requests:', err);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [campaignId]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !campaignId) return;

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await api.createRequest(campaignId, newMessage.trim());
      setNewMessage('');
      setStatusMessage({ type: 'success', text: 'Aid request recorded.' });
      await loadRequests();
      setSelectedRequestId(res.id);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to record request.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunAiDraft = async (reqId: string) => {
    setIsLoadingDraft(true);
    setStatusMessage(null);
    try {
      const res = await api.aiDraft(reqId);
      setAiDrafts((prev) => ({ ...prev, [reqId]: res.draft }));
      setStatusMessage({
        type: 'success',
        text: 'AI draft generated with citations and uncertainty analysis.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'AI drafting service unavailable or API key not set.',
      });
    } finally {
      setIsLoadingDraft(false);
    }
  };

  const handleApproveDraftNeed = async (reqId: string, description: string, amountMinor: number) => {
    setStatusMessage(null);
    try {
      // 1. Create the need on the request
      const needRes = await api.createNeed(reqId, description, amountMinor);
      // 2. Human explicitly approves the need
      await api.approveNeed(needRes.id);
      setStatusMessage({
        type: 'success',
        text: `Approved need "${description}" ($${(amountMinor / 100).toFixed(2)}). It is now on the Coordination Board.`,
      });
      await loadRequests();
      onRefreshBoard();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to approve need.',
      });
    }
  };

  const handleAddManualNeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestId || !manualDescription.trim()) return;

    const amountMinor = Math.round((parseFloat(manualAmount) || 0) * 100);
    try {
      const needRes = await api.createNeed(selectedRequestId, manualDescription.trim(), amountMinor);
      await api.approveNeed(needRes.id);
      setManualDescription('');
      setManualAmount('');
      setStatusMessage({
        type: 'success',
        text: `Added and approved need "${manualDescription}"`,
      });
      await loadRequests();
      onRefreshBoard();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to add need' });
    }
  };

  const selectedRequest = requests.find((r) => r.id === selectedRequestId);
  const activeDraft = selectedRequestId ? aiDrafts[selectedRequestId] : null;

  return (
    <div className="space-y-10 py-6">
      {/* Header */}
      <div className="border-b border-warm-200/80 pb-6">
        <div className="flex items-center gap-2 text-clay-600 font-semibold text-xs tracking-wider uppercase">
          <Sparkles className="w-4 h-4" />
          <span>Responsible AI Coordination</span>
        </div>
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-warm-900 mt-1">
          Request Triage &amp; Human-in-the-Loop Review
        </h2>
        <p className="text-sm text-warm-500 max-w-2xl mt-1">
          Turn scattered, emotional intake messages into structured, auditable aid plans.
          AI extracts needs and surfaces ambiguities; human coordinators make all final decisions.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-medium flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-sage-50 border border-sage-200 text-sage-900'
              : 'bg-red-50 border border-red-200 text-red-900'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <HandDrawnCheck className="w-4 h-4 text-sage-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Two-Column Layout: Incoming Inbox on Left, Review Workbench on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Request Inbox & New Request Form */}
        <div className="lg:col-span-5 space-y-6">
          {/* Record Incoming Request Box */}
          <div className="bg-white rounded-3xl p-6 border border-warm-200/80 shadow-warm space-y-4">
            <h3 className="font-serif text-base font-bold text-warm-900">
              Record Incoming Aid Request
            </h3>
            <form onSubmit={handleCreateRequest} className="space-y-3">
              <textarea
                rows={3}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Paste message from SMS, phone log, or community intake (e.g. 'Elderly couple on Mill St with flooded basement need drinking water and battery pack...')"
                required
                className="w-full text-xs p-3 rounded-2xl bg-warm-50 border border-warm-200 focus:outline-none focus:ring-2 focus:ring-clay-500/30 text-warm-800 placeholder:text-warm-400"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-clay-600 hover:bg-clay-700 text-white shadow-sm transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Recording...' : 'Add to Triage Queue'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* List of Requests */}
          <div className="bg-white rounded-3xl border border-warm-200/80 shadow-warm overflow-hidden">
            <div className="p-4 border-b border-warm-100 flex items-center justify-between">
              <span className="font-serif text-sm font-bold text-warm-900">
                Triage Queue ({requests.length})
              </span>
              <span className="text-[10px] text-warm-400 font-semibold uppercase">
                Select to Review
              </span>
            </div>

            <div className="divide-y divide-warm-100 max-h-[460px] overflow-y-auto">
              {requests.length === 0 ? (
                <div className="p-8 text-center text-xs text-warm-400">
                  No requests in the queue. Add one above to begin.
                </div>
              ) : (
                requests.map((r) => {
                  const isSelected = r.id === selectedRequestId;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRequestId(r.id)}
                      className={`w-full text-left p-4 transition-colors space-y-1.5 ${
                        isSelected
                          ? 'bg-clay-50/70 border-l-4 border-l-clay-600'
                          : 'hover:bg-warm-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-warm-400">
                          ID: {r.id.substring(0, 8)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            r.status === 'approved'
                              ? 'bg-sage-100 text-sage-800'
                              : 'bg-warm-100 text-warm-700'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <p className="text-xs text-warm-700 line-clamp-2 leading-relaxed font-normal">
                        {r.message}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Active Request Review Workbench */}
        <div className="lg:col-span-7">
          {selectedRequest ? (
            <div className="bg-white rounded-4xl p-6 sm:p-8 border border-warm-200/90 shadow-warm space-y-7">
              {/* Request Header */}
              <div className="space-y-3 pb-4 border-b border-warm-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-warm-100 text-warm-600">
                      Request #{selectedRequest.id.substring(0, 8)}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sage-50 text-sage-800 border border-sage-200">
                      Status: {selectedRequest.status}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isLoadingDraft}
                    onClick={() => handleRunAiDraft(selectedRequest.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-clay-50 hover:bg-clay-100 text-clay-700 border border-clay-200 shadow-sm transition-all disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4 text-clay-600" />
                    <span>{isLoadingDraft ? 'Drafting...' : 'Draft Plan with AI'}</span>
                  </button>
                </div>

                {/* Raw Intake Message Display */}
                <div className="p-4 rounded-2xl bg-warm-50/80 border border-warm-200/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-warm-400">
                    Original Recipient Narrative
                  </span>
                  <p className="text-sm text-warm-900 leading-relaxed font-normal italic">
                    "{selectedRequest.message}"
                  </p>
                </div>
              </div>

              {/* AI Draft Results Section */}
              {activeDraft ? (
                <div className="space-y-6">
                  {/* Extracted Needs & Approval Buttons */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-serif text-base font-bold text-warm-900 flex items-center gap-2">
                        <HandDrawnSparkle className="w-4 h-4 text-clay-600" />
                        <span>AI-Proposed Structured Needs</span>
                      </h4>
                      <span className="text-[11px] text-warm-400 font-medium">
                        Click "Approve" to post to board
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {activeDraft.needs.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl bg-white border border-warm-200/90 hover:border-clay-300 shadow-sm flex items-center justify-between gap-4 transition-colors"
                        >
                          <div>
                            <span className="font-semibold text-xs text-warm-900 block">
                              {item.description}
                            </span>
                            <span className="text-xs text-clay-700 font-bold">
                              ${(item.amount_minor / 100).toFixed(2)}{' '}
                              <span className="text-[10px] text-warm-400 font-normal">
                                (estimated minor units)
                              </span>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleApproveDraftNeed(
                                selectedRequest.id,
                                item.description,
                                item.amount_minor
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-sage-700 hover:bg-sage-800 text-white shadow-sm transition-colors"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Approve Need</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Clarifying Questions */}
                  {activeDraft.questions && activeDraft.questions.length > 0 && (
                    <div className="p-4 rounded-3xl bg-warm-50 border border-warm-200/80 space-y-2">
                      <span className="text-xs font-bold text-warm-800 flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-clay-600" />
                        <span>Recommended Clarifying Questions for Coordinator</span>
                      </span>
                      <ul className="list-disc list-inside text-xs text-warm-600 space-y-1 pl-1">
                        {activeDraft.questions.map((q, idx) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Uncertainties & Ambiguities */}
                  {activeDraft.uncertainties && activeDraft.uncertainties.length > 0 && (
                    <div className="p-4 rounded-3xl bg-warm-50 border border-warm-200/80 space-y-2">
                      <span className="text-xs font-bold text-warm-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-honey-500 text-amber-600" />
                        <span>Highlighted Uncertainties (No Hallucinations)</span>
                      </span>
                      <ul className="list-disc list-inside text-xs text-warm-600 space-y-1 pl-1">
                        {activeDraft.uncertainties.map((u, idx) => (
                          <li key={idx}>{u}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center rounded-3xl bg-warm-50/50 border border-dashed border-warm-200 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-warm-100 text-clay-600 mx-auto flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h4 className="font-serif text-sm font-bold text-warm-800">
                    AI Aid Assistant Ready
                  </h4>
                  <p className="text-xs text-warm-500 max-w-sm mx-auto">
                    Click "Draft Plan with AI" above to extract items, estimated amounts, and check for missing details.
                  </p>
                </div>
              )}

              {/* Manual Need Entry Form */}
              <div className="pt-4 border-t border-warm-100 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-warm-500 block">
                  Or Add a Custom Need Manually
                </span>
                <form onSubmit={handleAddManualNeed} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    placeholder="e.g. 20L clean drinking water jerrycan"
                    required
                    className="flex-1 text-xs p-2.5 rounded-xl bg-warm-50 border border-warm-200 focus:outline-none focus:ring-2 focus:ring-clay-500/30"
                  />
                  <div className="relative w-28">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-xs font-bold text-warm-400">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      placeholder="Amount"
                      required
                      className="w-full text-xs font-semibold pl-6 pr-2 py-2.5 rounded-xl bg-warm-50 border border-warm-200 focus:outline-none focus:ring-2 focus:ring-clay-500/30"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-warm-800 hover:bg-warm-900 text-white shadow-sm transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add &amp; Approve</span>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="p-16 text-center bg-white rounded-4xl border border-warm-200/80 shadow-warm text-xs text-warm-400">
              Select a request from the left queue to review or draft aid plans.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
