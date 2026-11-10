import React, { useState } from 'react';
import { api } from '../api';
import { HeartInHandsSvg, HandDrawnCheck } from './OrganicIllustration';
import { LifeBuoy, Send, KeyRound, Search, AlertCircle, Clock, ShieldCheck } from 'lucide-react';

interface RecipientPortalProps {
  campaignId: string;
}

export const RecipientPortal: React.FC<RecipientPortalProps> = ({ campaignId }) => {
  const [activeTab, setActiveTab] = useState<'request' | 'check'>('request');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [intakeResult, setIntakeResult] = useState<{
    requestId: string;
    accessToken: string;
    status: string;
  } | null>(null);

  // Check status state
  const [checkId, setCheckId] = useState('');
  const [checkToken, setCheckToken] = useState('');
  const [requestStatus, setRequestStatus] = useState<{
    id: string;
    status: string;
    created_at: string;
  } | null>(null);
  const [clarifyMessage, setClarifyMessage] = useState('');
  const [isClarifying, setIsClarifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !campaignId) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await api.publicIntake(campaignId, message.trim());
      setIntakeResult({
        requestId: res.request_id,
        accessToken: res.access_token,
        status: res.status,
      });
      setMessage('');
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Public intake is currently disabled or rate limited by the relief organization.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkId.trim() || !checkToken.trim()) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const data = await api.getRecipientStatus(checkId.trim(), checkToken.trim());
      setRequestStatus(data);
    } catch (err: any) {
      setErrorMessage('Could not find request. Please verify the Request ID and Access Token.');
    }
  };

  const handleSendClarification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkId.trim() || !checkToken.trim() || !clarifyMessage.trim()) return;

    setIsClarifying(true);
    setErrorMessage(null);
    try {
      const res = await api.clarifyRecipientRequest(checkId.trim(), checkToken.trim(), clarifyMessage.trim());
      setSuccessMessage('Your updated details have been forwarded to the relief coordination team.');
      setRequestStatus((prev) => (prev ? { ...prev, status: res.status } : null));
      setClarifyMessage('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit clarification.');
    } finally {
      setIsClarifying(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      {/* Gentle Header */}
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-3xl bg-clay-50 border border-clay-200 text-clay-700 flex items-center justify-center mx-auto shadow-sm">
          <HeartInHandsSvg className="w-8 h-8" />
        </div>
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-warm-900">
          Community Aid Portal
        </h2>
        <p className="text-sm text-warm-600 max-w-lg mx-auto">
          If you or your household have been affected by the disaster, our volunteer coordinators
          are ready to review your needs and allocate emergency supplies.
        </p>

        {/* Tab Switcher */}
        <div className="inline-flex p-1 rounded-2xl bg-warm-100 border border-warm-200/80 shadow-inner mt-2">
          <button
            type="button"
            onClick={() => setActiveTab('request')}
            className={`px-5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'request'
                ? 'bg-white text-clay-700 shadow-sm'
                : 'text-warm-600 hover:text-warm-900'
            }`}
          >
            Submit a Request
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('check')}
            className={`px-5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'check'
                ? 'bg-white text-clay-700 shadow-sm'
                : 'text-warm-600 hover:text-warm-900'
            }`}
          >
            Check Status of Request
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-sage-50 border border-sage-200 text-sage-900 text-xs flex items-start gap-2">
          <HandDrawnCheck className="w-4 h-4 text-sage-600 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tab 1: Submit Intake */}
      {activeTab === 'request' && (
        <div className="bg-white rounded-4xl p-7 sm:p-9 border border-warm-200/80 shadow-warm space-y-6">
          {!intakeResult ? (
            <form onSubmit={handleIntakeSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block font-serif text-base font-bold text-warm-900">
                  What does your household need most right now?
                </label>
                <p className="text-xs text-warm-500 leading-relaxed">
                  Please describe your urgent situation (e.g. number of family members, infant supplies,
                  potable water, dietary restrictions, emergency shelter, or urgent prescription needs).
                </p>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what happened and what supplies or help are needed..."
                  required
                  className="w-full text-xs p-4 rounded-2xl bg-warm-50 border border-warm-200 focus:outline-none focus:ring-2 focus:ring-clay-500/30 text-warm-800 placeholder:text-warm-400"
                />
              </div>

              <div className="p-4 rounded-2xl bg-sage-50/70 border border-sage-200 text-[11px] text-sage-800 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-sage-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Privacy Guaranteed</span>
                  Your personal details are never published to donors. Only authorized relief
                  case workers receive this information to coordinate delivery.
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 rounded-2xl text-sm font-bold bg-clay-600 hover:bg-clay-700 text-white shadow-warm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Sending to Dispatch...' : 'Submit Request to Relief Team'}</span>
              </button>
            </form>
          ) : (
            <div className="p-6 rounded-3xl bg-warm-50 border border-warm-200 space-y-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-sage-100 text-sage-700 mx-auto flex items-center justify-center">
                <HandDrawnCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif text-xl font-bold text-warm-900">
                  Your Request Has Been Received
                </h3>
                <p className="text-xs text-warm-500 max-w-md mx-auto">
                  A community coordinator will review your needs and match them against available emergency pool funds and supplies.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-warm-200 text-left space-y-2 max-w-md mx-auto">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-warm-400">
                    Request Reference ID
                  </span>
                  <div className="font-mono text-xs font-bold text-warm-800 select-all">
                    {intakeResult.requestId}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-warm-400">
                    Private Access Token (Save this!)
                  </span>
                  <div className="font-mono text-xs font-bold text-clay-700 break-all select-all">
                    {intakeResult.accessToken}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCheckId(intakeResult.requestId);
                  setCheckToken(intakeResult.accessToken);
                  setActiveTab('check');
                  setIntakeResult(null);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-warm-800 text-white text-xs font-bold hover:bg-warm-900 transition-colors"
              >
                <span>Track Request Status</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Check Status */}
      {activeTab === 'check' && (
        <div className="bg-white rounded-4xl p-7 sm:p-9 border border-warm-200/80 shadow-warm space-y-6">
          <form onSubmit={handleCheckStatus} className="space-y-4">
            <h3 className="font-serif text-base font-bold text-warm-900">
              Check Status of an Existing Request
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-warm-700 mb-1">
                  Request ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5f4e3d2c-..."
                  value={checkId}
                  onChange={(e) => setCheckId(e.target.value)}
                  required
                  className="w-full text-xs font-mono p-2.5 rounded-xl bg-warm-50 border border-warm-200 focus:outline-none focus:ring-2 focus:ring-clay-500/30"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-warm-700 mb-1">
                  Access Token
                </label>
                <input
                  type="password"
                  placeholder="Secret access token given at submission"
                  value={checkToken}
                  onChange={(e) => setCheckToken(e.target.value)}
                  required
                  className="w-full text-xs font-mono p-2.5 rounded-xl bg-warm-50 border border-warm-200 focus:outline-none focus:ring-2 focus:ring-clay-500/30"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-clay-600 hover:bg-clay-700 text-white shadow-sm transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Lookup Request</span>
              </button>
            </div>
          </form>

          {requestStatus && (
            <div className="p-6 rounded-3xl bg-warm-50/80 border border-warm-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-warm-200/70">
                <span className="text-xs font-mono text-warm-500">
                  ID: #{requestStatus.id.substring(0, 8)}
                </span>
                <span className="text-xs font-bold px-3 py-1 rounded-full uppercase bg-sage-100 text-sage-800 border border-sage-200">
                  {requestStatus.status}
                </span>
              </div>

              <div className="text-xs text-warm-600 space-y-1">
                <p>
                  <span className="font-semibold text-warm-800">Date recorded:</span>{' '}
                  {new Date(requestStatus.created_at).toLocaleString()}
                </p>
                <p>
                  <span className="font-semibold text-warm-800">Current progress:</span>{' '}
                  {requestStatus.status === 'received' && 'Pending organizer review & AI drafting.'}
                  {requestStatus.status === 'approved' && 'Aid plan approved! Listed on the Coordination Board.'}
                  {requestStatus.status === 'partially_fulfilled' && 'Supplies are en route or purchased.'}
                  {requestStatus.status === 'fulfilled' && 'Delivered and confirmed.'}
                  {requestStatus.status === 'needs_clarification' && 'The coordinator requested additional details below.'}
                </p>
              </div>

              {/* Provide clarification form */}
              <form onSubmit={handleSendClarification} className="pt-3 border-t border-warm-200/70 space-y-2">
                <label className="block text-[11px] font-semibold text-warm-700">
                  Provide Updated Information or Clarification:
                </label>
                <textarea
                  rows={2}
                  value={clarifyMessage}
                  onChange={(e) => setClarifyMessage(e.target.value)}
                  placeholder="e.g. 'Power was restored, but clean water is still urgently needed for 4 people.'"
                  required
                  className="w-full text-xs p-2.5 rounded-xl bg-white border border-warm-200 focus:outline-none focus:ring-2 focus:ring-clay-500/30"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isClarifying}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold bg-warm-800 hover:bg-warm-900 text-white shadow-sm disabled:opacity-50"
                  >
                    {isClarifying ? 'Submitting...' : 'Send Update'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
