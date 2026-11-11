import React, { useState, useEffect } from 'react';
import {
  AidRequest,
  AiDraftResult,
  DuplicateMatch,
  RadarSummaryItem,
  RequestDuplicatesResult,
} from '../types';
import { api } from '../api';
import { HandDrawnSparkle, HandDrawnCheck } from './OrganicIllustration';
import {
  Sparkles,
  HelpCircle,
  AlertTriangle,
  Plus,
  Send,
  UserCheck,
  Radio,
  GitMerge,
  ShieldAlert,
  CheckCircle2,
  Zap,
  MapPin,
  DollarSign,
  Copy,
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
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Anti-Fraud Radar & Semantic Deduplication state
  const [radarSummary, setRadarSummary] = useState<Record<string, RadarSummaryItem>>({});
  const [duplicatesResult, setDuplicatesResult] = useState<RequestDuplicatesResult | null>(null);
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isSimulatingDuplicate, setIsSimulatingDuplicate] = useState(false);

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

  const loadRadarSummary = async () => {
    if (!campaignId) return;
    try {
      const summary = await api.getRadarSummary(campaignId);
      setRadarSummary(summary);
    } catch (err: any) {
      console.warn('Failed to load radar summary:', err);
    }
  };

  const loadDuplicatesForSelected = async (reqId: string) => {
    if (!campaignId || !reqId) return;
    setIsLoadingDuplicates(true);
    try {
      const res = await api.getRequestDuplicates(campaignId, reqId);
      setDuplicatesResult(res);
    } catch (err: any) {
      console.warn('Failed to fetch duplicates for request:', err);
      setDuplicatesResult(null);
    } finally {
      setIsLoadingDuplicates(false);
    }
  };

  useEffect(() => {
    loadRequests();
    loadRadarSummary();
  }, [campaignId]);

  useEffect(() => {
    if (selectedRequestId) {
      loadDuplicatesForSelected(selectedRequestId);
    } else {
      setDuplicatesResult(null);
    }
  }, [selectedRequestId, campaignId]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !campaignId) return;

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await api.createRequest(campaignId, newMessage.trim());
      setNewMessage('');
      setStatusMessage({ type: 'success', text: 'Aid request recorded in triage inbox.' });
      await loadRequests();
      await loadRadarSummary();
      setSelectedRequestId(res.id);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to record request.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateDuplicate = async () => {
    if (!campaignId) return;
    setIsSimulatingDuplicate(true);
    setStatusMessage(null);
    try {
      const res = await api.simulateDuplicate(campaignId);
      await loadRequests();
      await loadRadarSummary();
      setSelectedRequestId(res.duplicate_request_id);
      setStatusMessage({
        type: 'warning',
        text: res.reused
          ? 'Reopened the existing fictional pair. Similarity is shown for coordinator review.'
          : 'Added a fictional request pair. Similarity is shown for coordinator review.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to simulate duplicate request.',
      });
    } finally {
      setIsSimulatingDuplicate(false);
    }
  };

  const handleMergeRequests = async (primaryId: string, duplicateId: string, match: DuplicateMatch) => {
    if (!campaignId) return;
    setIsMerging(true);
    setStatusMessage(null);
    try {
      const res = await api.mergeRequests(
        campaignId,
        primaryId,
        duplicateId,
        `Consolidated duplicate intake from same household (${match.detected_address || 'shared location'}). Prevented $${(match.potential_savings_minor / 100).toFixed(2)} duplicate disbursement.`
      );
      setStatusMessage({
        type: 'success',
        text: `🎉 ${res.message}`,
      });
      await loadRequests();
      await loadRadarSummary();
      if (selectedRequestId) {
        await loadDuplicatesForSelected(selectedRequestId);
      }
      onRefreshBoard();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to merge duplicate requests.',
      });
    } finally {
      setIsMerging(false);
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
        text: 'AI draft generated with itemized recommendations and uncertainty analysis.',
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
      const needRes = await api.createNeed(reqId, description, amountMinor);
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
  const topMatch = duplicatesResult && duplicatesResult.matches.length > 0 ? duplicatesResult.matches[0] : null;
  const isSelectedMerged = selectedRequest?.status === 'merged';

  return (
    <div className="space-y-10 py-6">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-600 font-semibold text-xs tracking-wider uppercase">
            <Radio className="w-4 h-4 text-brand-500 animate-pulse" />
            <span>AI Triage &amp; Anti-Fraud Radar</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mt-1">
            Request Triage &amp; Semantic Deduplication
          </h2>
          <p className="text-sm text-slate-500 max-w-2xl mt-1">
            AI drafts suggested needs for human review. Similarity signals can surface overlapping
            requests; they do not determine fraud or eligibility.
          </p>
        </div>

        {/* 1-Click Simulation Button for Judges / Coordinators */}
        <button
          type="button"
          onClick={handleSimulateDuplicate}
          disabled={isSimulatingDuplicate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 shadow-sm transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 shrink-0"
          title="Simulate a duplicate crisis intake from 104 Riverside Dr to test the Anti-Fraud Radar"
        >
          <Zap className="w-4 h-4 text-amber-600" />
          <span>{isSimulatingDuplicate ? 'Adding fictional pair...' : '⚡ Test Synthetic Duplicate Pair'}</span>
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-medium flex items-center gap-2.5 transition-all ${
            statusMessage.type === 'success'
              ? 'bg-mint-50 border border-mint-200 text-mint-900'
              : statusMessage.type === 'warning'
              ? 'bg-amber-50 border border-amber-200 text-amber-900'
              : 'bg-red-50 border border-red-200 text-red-900'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <HandDrawnCheck className="w-4 h-4 text-mint-600 shrink-0" />
          ) : statusMessage.type === 'warning' ? (
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Request Inbox */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-soft space-y-4">
            <h3 className="font-serif text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Record Incoming Aid Request</span>
            </h3>
            <form onSubmit={handleCreateRequest} className="space-y-3">
              <textarea
                rows={3}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Paste message from SMS, phone log, or community intake (e.g. 'Elderly couple on Mill St with flooded basement need drinking water and battery pack...')"
                required
                className="w-full text-xs p-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-slate-800 placeholder:text-slate-400"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Recording...' : 'Add to Triage Queue'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* List of Requests */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-soft overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-serif text-sm font-bold text-slate-900">
                  Triage Queue ({requests.length})
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-brand-700 border border-sky-200">
                  <Radio className="w-3 h-3 text-brand-500" />
                  Radar Active
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">
                Select to Review
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
              {requests.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No requests in the queue. Add one above to begin.
                </div>
              ) : (
                requests.map((r) => {
                  const isSelected = r.id === selectedRequestId;
                  const radar = radarSummary[r.id];
                  const hasDuplicate = radar?.has_duplicate;
                  const isMerged = r.status === 'merged';

                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRequestId(r.id)}
                      className={`w-full text-left p-4 transition-colors space-y-2 relative ${
                        isSelected
                          ? 'bg-sky-50/80 border-l-4 border-l-brand-600'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-slate-400">
                          ID: {r.id.substring(0, 8)}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {r.is_synthetic && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                              Synthetic demo
                            </span>
                          )}
                          {/* Radar duplicate warning badge */}
                          {hasDuplicate && !isMerged && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                              <ShieldAlert className="w-3 h-3 text-amber-600" />
                              <span>{radar.similarity_percentage}% Duplicate Match</span>
                            </span>
                          )}

                          {isMerged ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 line-through">
                              Merged
                            </span>
                          ) : (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                r.status === 'approved'
                                  ? 'bg-mint-100 text-mint-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {r.status}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className={`text-xs text-slate-700 line-clamp-2 leading-relaxed font-normal ${isMerged ? 'text-slate-400 italic' : ''}`}>
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
        <div className="lg:col-span-7 space-y-6">
          {selectedRequest ? (
            <div className="space-y-6">
              {/* ANTI-FRAUD RADAR: DUPLICATE ALERT CARD */}
              {topMatch && !isSelectedMerged && (
                <div className="bg-gradient-to-br from-amber-50/90 via-amber-50/50 to-orange-50/40 rounded-4xl p-6 border-2 border-amber-300 shadow-soft space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0">
                        <ShieldAlert className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                            Anti-Fraud Radar Alert
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                            {topMatch.similarity_percentage}% High Similarity
                          </span>
                        </div>
                        <h4 className="font-serif text-lg font-bold text-amber-950">
                          Possible Duplicate Requests Detected
                        </h4>
                      </div>
                    </div>

                    <div className="text-right sm:text-right shrink-0">
                      <span className="text-[10px] font-bold uppercase text-amber-700 block">
                        Duplicate Exposure Risk
                      </span>
                      <span className="text-base font-bold text-amber-950">
                        ${(topMatch.potential_savings_minor / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Warning Narrative */}
                  <div className="p-3.5 rounded-2xl bg-white/80 border border-amber-200/90 text-xs text-amber-950 leading-relaxed">
                    <span className="font-bold">⚠️ {topMatch.reason}</span>
                  </div>

                  {/* Side-by-Side Comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Current Request Card */}
                    <div className="p-4 rounded-2xl bg-white/90 border border-amber-200/90 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-500">
                          Current Incoming Claim
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          #{selectedRequest.id.substring(0, 8)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 line-clamp-4 leading-relaxed font-normal italic">
                        "{selectedRequest.message}"
                      </p>
                      <span className="inline-block text-[10px] font-semibold text-slate-500">
                        Status: <span className="uppercase text-slate-800">{selectedRequest.status}</span>
                      </span>
                    </div>

                    {/* Matched Existing Request Card */}
                    <div className="p-4 rounded-2xl bg-white/90 border border-amber-200/90 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-amber-700">
                          Existing Matched Claim
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          #{topMatch.matched_request_id.substring(0, 8)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 line-clamp-4 leading-relaxed font-normal italic">
                        "{topMatch.matched_message}"
                      </p>
                      <div className="flex items-center justify-between text-[10px] font-semibold text-amber-800">
                        <span>Status: <span className="uppercase font-bold">{topMatch.matched_status}</span></span>
                        <span className="font-bold text-mint-700">${(topMatch.potential_savings_minor / 100).toFixed(2)} active</span>
                      </div>
                    </div>
                  </div>

                  {/* Detection Signals Row */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    {topMatch.detected_address && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/80 border border-amber-200 text-amber-900 font-semibold text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-amber-600" />
                        <span>Address Match: <strong>{topMatch.detected_address}</strong></span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/80 border border-amber-200 text-amber-900 font-semibold text-[11px]">
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      <span>Overlapping: {topMatch.overlapping_keywords.join(', ')}</span>
                    </span>
                  </div>

                  {/* 1-Click Merge Action Button */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-amber-900/80 font-medium">
                      Review both claims. Merge only after confirming they concern the same household or incident.
                    </p>
                    <button
                      type="button"
                      disabled={isMerging}
                      onClick={() => handleMergeRequests(topMatch.matched_request_id, selectedRequest.id, topMatch)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all transform active:scale-95 disabled:opacity-50 whitespace-nowrap"
                    >
                      <GitMerge className="w-4 h-4" />
                      <span>{isMerging ? 'Merging...' : 'Merge Requests'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Merged Status Confirmation Card */}
              {isSelectedMerged && (
                <div className="bg-mint-50/90 rounded-3xl p-5 border border-mint-200 shadow-sm flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-mint-100 text-mint-700 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-mint-600" />
                    </div>
                    <div>
                      <h4 className="font-serif text-sm font-bold text-mint-950">
                        Duplicate Claim Safely Merged
                      </h4>
                      <p className="text-xs text-mint-800">
                        This request was merged into an existing approved need. Duplicate disbursement was averted and recorded in the audit trail.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-mint-700 uppercase px-2.5 py-1 rounded-xl bg-white border border-mint-200 shrink-0">
                    Audit Logged
                  </span>
                </div>
              )}

              {/* Clean Anti-Fraud State if No Duplicates */}
              {!topMatch && !isLoadingDuplicates && !isSelectedMerged && (
                <div className="bg-sky-50/60 rounded-2xl px-4 py-3 border border-sky-200/80 flex items-center justify-between text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-600" />
                    <span><strong>Anti-Fraud Radar Clean:</strong> No overlapping household claims or identical equipment detected across active intake.</span>
                  </div>
                  <span className="text-[10px] font-bold text-brand-700 bg-white px-2 py-0.5 rounded-lg border border-sky-200">
                    0% Overlap
                  </span>
                </div>
              )}

              {/* Active Request Review Workbench */}
              <div className="bg-white rounded-4xl p-6 sm:p-8 border border-slate-200/90 shadow-soft space-y-7">
                {/* Request Header */}
                <div className="space-y-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        Request #{selectedRequest.id.substring(0, 8)}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          isSelectedMerged
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : selectedRequest.status === 'approved'
                            ? 'bg-mint-50 text-mint-800 border-mint-200'
                            : 'bg-sky-50 text-brand-800 border-sky-200'
                        }`}
                      >
                        Status: {selectedRequest.status}
                      </span>
                    </div>

                    {!isSelectedMerged && (
                      <button
                        type="button"
                        disabled={isLoadingDraft}
                        onClick={() => handleRunAiDraft(selectedRequest.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-sky-50 hover:bg-sky-100 text-brand-700 border border-sky-200 shadow-sm transition-all disabled:opacity-50"
                      >
                        <Sparkles className="w-4 h-4 text-brand-500" />
                        <span>{isLoadingDraft ? 'Drafting...' : 'Draft Plan with AI'}</span>
                      </button>
                    )}
                  </div>

                  {/* Raw Intake Message Display */}
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Original Recipient Narrative
                    </span>
                    <p className="text-sm text-slate-900 leading-relaxed font-normal italic">
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
                        <h4 className="font-serif text-base font-bold text-slate-900 flex items-center gap-2">
                          <HandDrawnSparkle className="w-4 h-4 text-brand-500" />
                          <span>AI-Proposed Structured Needs</span>
                        </h4>
                        <span className="text-[11px] text-slate-400 font-medium">
                          Click "Approve" to post to board
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {activeDraft.needs.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-brand-300 shadow-sm flex items-center justify-between gap-4 transition-colors"
                          >
                            <div>
                              <span className="font-semibold text-xs text-slate-900 block">
                                {item.description}
                              </span>
                              <span className="text-xs text-brand-700 font-bold">
                                ${(item.amount_minor / 100).toFixed(2)}{' '}
                                <span className="text-[10px] text-slate-400 font-normal">
                                  (estimated minor units)
                                </span>
                              </span>
                            </div>
                            {!isSelectedMerged && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleApproveDraftNeed(
                                    selectedRequest.id,
                                    item.description,
                                    item.amount_minor
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-mint-600 hover:bg-mint-700 text-white shadow-sm transition-colors"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Approve Need</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Clarifying Questions */}
                    {activeDraft.questions && activeDraft.questions.length > 0 && (
                      <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <HelpCircle className="w-4 h-4 text-brand-500" />
                          <span>Recommended Clarifying Questions for Coordinator</span>
                        </span>
                        <ul className="list-disc list-inside text-xs text-slate-600 space-y-1 pl-1">
                          {activeDraft.questions.map((q, idx) => (
                            <li key={idx}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Uncertainties */}
                    {activeDraft.uncertainties && activeDraft.uncertainties.length > 0 && (
                      <div className="p-4 rounded-3xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                        <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>Uncertainties to verify</span>
                        </span>
                        <ul className="list-disc list-inside text-xs text-amber-800/80 space-y-1 pl-1">
                          {activeDraft.uncertainties.map((u, idx) => (
                            <li key={idx}>{u}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center rounded-3xl bg-slate-50/60 border border-dashed border-slate-200 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 text-brand-600 mx-auto flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h4 className="font-serif text-sm font-bold text-slate-800">
                      AI Aid Assistant Ready
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Click "Draft Plan with AI" above to extract items, estimated amounts, and check for missing details.
                    </p>
                  </div>
                )}

                {/* Manual Need Entry Form */}
                {!isSelectedMerged && (
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                      Or Add a Custom Need Manually
                    </span>
                    <form onSubmit={handleAddManualNeed} className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={manualDescription}
                        onChange={(e) => setManualDescription(e.target.value)}
                        placeholder="e.g. 20L clean drinking water jerrycan"
                        required
                        className="flex-1 text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      />
                      <div className="relative w-28">
                        <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-xs font-bold text-slate-400">
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
                          className="w-full text-xs font-semibold pl-6 pr-2 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        />
                      </div>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add &amp; Approve</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-16 text-center bg-white rounded-4xl border border-slate-200/80 shadow-soft text-xs text-slate-400">
              Select a request from the left queue to review or draft aid plans.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
