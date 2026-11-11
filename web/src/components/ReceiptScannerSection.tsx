import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { ReceiptAuditResult, HistoricalAuditItem, BoardNeed } from '../types';
import { HandDrawnSparkle, HandDrawnCheck } from './OrganicIllustration';
import {
  ScanLine,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  ShoppingBag,
  Info,
} from 'lucide-react';

interface ReceiptScannerSectionProps {
  campaignId: string;
  onRefreshBoard?: () => void;
}

export const ReceiptScannerSection: React.FC<ReceiptScannerSectionProps> = ({
  campaignId,
  onRefreshBoard,
}) => {
  const [selectedSample, setSelectedSample] = useState<string>('sample_infant_grocery');
  const [customImageBase64, setCustomImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [needs, setNeeds] = useState<BoardNeed[]>([]);
  const [selectedNeedId, setSelectedNeedId] = useState<string>('');
  
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<ReceiptAuditResult | null>(null);
  const [auditHistory, setAuditHistory] = useState<HistoricalAuditItem[]>([]);
  
  const [isApplying, setIsApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{
    ledger_id: string;
    receipt_id: string;
    amount_spent_minor: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load needs and historical audits on mount or campaign change
  const loadInitialData = async () => {
    if (!campaignId) return;
    try {
      const [boardRes, historyRes] = await Promise.all([
        api.getBoard(campaignId).catch(() => null),
        api.getReceiptAudits(campaignId).catch(() => []),
      ]);

      if (boardRes && boardRes.needs && boardRes.needs.length > 0) {
        setNeeds(boardRes.needs);
        setSelectedNeedId(boardRes.needs[0].need_id);
      }
      setAuditHistory(historyRes || []);
    } catch (err: any) {
      console.error('Failed to load receipt audit dependencies:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [campaignId]);

  // Handle file drop or upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCustomImageBase64(result);
      setImagePreview(result);
      setSelectedSample('');
      setAuditResult(null);
      setApplyResult(null);
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSample = (sampleId: string) => {
    setSelectedSample(sampleId);
    setCustomImageBase64(null);
    setImagePreview(null);
    setAuditResult(null);
    setApplyResult(null);
    setErrorMessage(null);

    // Auto-match sensible need for scenario
    if (sampleId === 'sample_infant_grocery' && needs.length > 0) {
      const infantNeed = needs.find((n) => n.description.toLowerCase().includes('infant') || n.description.toLowerCase().includes('formula'));
      if (infantNeed) setSelectedNeedId(infantNeed.need_id);
    } else if (sampleId === 'sample_hardware_flood' && needs.length > 0) {
      const pumpNeed = needs.find((n) => n.description.toLowerCase().includes('pump') || n.description.toLowerCase().includes('tarp'));
      if (pumpNeed) setSelectedNeedId(pumpNeed.need_id);
    }
  };

  // Run the Multimodal AI Scan & Deterministic Audit
  const handleRunAudit = async () => {
    if (!campaignId) return;
    setIsAuditing(true);
    setErrorMessage(null);
    setAuditResult(null);
    setApplyResult(null);

    try {
      const res = await api.scanAndAuditReceipt(
        campaignId,
        selectedNeedId || undefined,
        customImageBase64 || undefined,
        selectedSample || undefined
      );
      setAuditResult(res);
      // Refresh audit history list
      const updatedHistory = await api.getReceiptAudits(campaignId).catch(() => []);
      setAuditHistory(updatedHistory);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to scan and audit receipt.');
    } finally {
      setIsAuditing(false);
    }
  };

  // Apply approved eligible receipt spend directly to the ledger
  const handleApplyToLedger = async () => {
    if (!auditResult) return;
    if (!selectedNeedId && needs.length > 0) {
      setSelectedNeedId(needs[0].need_id);
    }
    const targetNeedId = selectedNeedId || (needs[0] ? needs[0].need_id : '');
    if (!targetNeedId) {
      setErrorMessage('Please select a target need to reconcile against.');
      return;
    }

    setIsApplying(true);
    setErrorMessage(null);
    try {
      const res = await api.applyAuditedReceipt(
        auditResult.audit_id,
        targetNeedId,
        auditResult.receipt_reference,
        `Reconciled via AI Audit (${auditResult.vendor})`
      );
      setApplyResult(res);
      if (onRefreshBoard) {
        onRefreshBoard();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to apply receipt to ledger.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Star Player Feature Header */}
      <div className="bg-gradient-to-br from-sky-50 via-white to-mint-50/40 rounded-4xl p-6 sm:p-9 border border-sky-100 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-100/80 border border-sky-200 text-brand-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-brand-500" />
            <span>Star Player &bull; Multimodal AI Vision &amp; Policy Ledger Validator</span>
          </div>

          <span className="text-[11px] font-semibold tracking-wide px-3 py-1 rounded-full bg-mint-100 text-mint-800 border border-mint-200">
            FEMA &amp; Audit Ready
          </span>
        </div>

        <div className="space-y-2">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Multimodal Receipt Scanner &amp; Policy Audit
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
            Volunteers may buy emergency groceries and hardware locally. Receipt images can be extracted by the configured vision provider or a labelled synthetic sample; deterministic rules flag selected prohibited items and compare totals with the linked approved need. A pass is a review aid, not proof of eligibility or delivery.
          </p>
        </div>

        {/* 1-Click Judge Demo Scenarios */}
        <div className="pt-2 space-y-2.5">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Synthetic Receipt Examples:
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Scenario 1: Clean Essentials */}
            <button
              type="button"
              onClick={() => handleSelectSample('sample_infant_grocery')}
              className={`text-left p-4 rounded-2xl border transition-all ${
                selectedSample === 'sample_infant_grocery'
                  ? 'bg-sky-50/90 border-brand-500 ring-2 ring-brand-500/20 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>🍼 Valley Pharmacy</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-mint-50 text-mint-700 border border-mint-200">
                  Clean Pass
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Infant formula, diapers, Pedialyte &amp; wipes ($69.78). Fictional example; rules show no prohibited-item flag.
              </p>
            </button>

            {/* Scenario 2: Flood Defense Equipment */}
            <button
              type="button"
              onClick={() => handleSelectSample('sample_hardware_flood')}
              className={`text-left p-4 rounded-2xl border transition-all ${
                selectedSample === 'sample_hardware_flood'
                  ? 'bg-sky-50/90 border-brand-500 ring-2 ring-brand-500/20 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>🛠️ Pine Creek Hardware</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-mint-50 text-mint-700 border border-mint-200">
                  Clean Pass
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Sump pump, heavy tarp, discharge hose &amp; sandbags ($157.81). Within equipment budget.
              </p>
            </button>

            {/* Scenario 3: Prohibited Goods Flagged */}
            <button
              type="button"
              onClick={() => handleSelectSample('sample_flagged_anomaly')}
              className={`text-left p-4 rounded-2xl border transition-all ${
                selectedSample === 'sample_flagged_anomaly'
                  ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-400/20 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>⚠️ QuickStop Mart Anomaly</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  Policy Flagged
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Water &amp; food bundled with cigarettes &amp; beer ($70.06). Flags prohibited line items instantly!
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Main Scanner Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Image Drop / Upload & Need Selection */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-soft space-y-5">
            <h3 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-brand-600" />
              <span>Step 1: Ingest Receipt Document</span>
            </h3>

            {/* Drag & Drop File Upload Area */}
            <div className="space-y-3">
              <label
                htmlFor="receipt-file-input"
                className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                  imagePreview
                    ? 'border-brand-400 bg-sky-50/40'
                    : 'border-slate-300 hover:border-brand-400 bg-slate-50/60 hover:bg-sky-50/20'
                }`}
              >
                {imagePreview ? (
                  <div className="space-y-2 text-center">
                    <img
                      src={imagePreview}
                      alt="Uploaded receipt preview"
                      className="max-h-48 rounded-xl mx-auto object-contain border border-slate-200 shadow-sm"
                    />
                    <span className="text-xs font-semibold text-brand-600 block">
                      Custom Receipt Loaded (Click to replace)
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-sky-50 text-brand-600 flex items-center justify-center mx-auto border border-sky-100">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Drag &amp; drop or click to upload receipt
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Supports photo snapshots, JPG, PNG, WebP
                      </p>
                    </div>
                  </div>
                )}
                <input
                  id="receipt-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>

              {imagePreview && (
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setCustomImageBase64(null);
                    setSelectedSample('sample_infant_grocery');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 underline block text-center"
                >
                  Clear uploaded image and switch back to demo scenarios
                </button>
              )}
            </div>

            {/* Target Approved Need Dropdown */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-800">
                Cross-Reference Against Approved Relief Need:
              </label>
              <select
                value={selectedNeedId}
                onChange={(e) => setSelectedNeedId(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-sm"
                aria-label="Select target need"
              >
                {needs.map((n) => (
                  <option key={n.need_id} value={n.need_id}>
                    {n.description} (Approved Budget: ${(n.requested_minor / 100).toFixed(2)})
                  </option>
                ))}
                {needs.length === 0 && (
                  <option value="">No approved needs found (General Relief Pool)</option>
                )}
              </select>
              <p className="text-[11px] text-slate-500">
                The AI will verify that eligible line items match the allocated category and stay within budget.
              </p>
            </div>

            {/* Execute Audit Button */}
            <button
              type="button"
              disabled={isAuditing}
              onClick={handleRunAudit}
              className={`w-full py-3.5 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                isAuditing
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-brand-600 hover:bg-brand-700 text-white shadow-soft-blue'
              }`}
            >
              {isAuditing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Auditing Receipt with Vision AI &amp; Policy Rules...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-sky-200" />
                  <span>Run Multimodal AI Forensic Audit</span>
                </>
              )}
            </button>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Right Column: Forensic Audit Report */}
        <div className="lg:col-span-7 space-y-6">
          {!auditResult ? (
            <div className="bg-white rounded-3xl p-10 border border-slate-200/90 shadow-soft text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-sky-50 text-brand-600 flex items-center justify-center mx-auto border border-sky-100">
                <FileText className="w-7 h-7" />
              </div>
              <h4 className="font-serif text-lg font-bold text-slate-900">
                Awaiting Receipt Document
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Select a 1-click scenario on the left or upload your own store slip, then press &ldquo;Run Multimodal AI Forensic Audit&rdquo; to extract line items and test deterministic compliance checks.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Verdict Header Banner */}
              <div
                className={`p-6 rounded-3xl border shadow-soft space-y-3 ${
                  auditResult.verdict === 'passed'
                    ? 'bg-mint-50/90 border-mint-200 text-mint-950'
                    : auditResult.verdict === 'flagged'
                    ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                    : 'bg-amber-50/90 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {auditResult.verdict === 'passed' ? (
                      <ShieldCheck className="w-6 h-6 text-mint-600" />
                    ) : auditResult.verdict === 'flagged' ? (
                      <ShieldAlert className="w-6 h-6 text-rose-600" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-amber-600" />
                    )}
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider block">
                        Deterministic Policy Check
                      </span>
                      <h3 className="font-serif text-xl font-bold">
                        {auditResult.verdict === 'passed'
                          ? 'No configured policy flags found'
                          : auditResult.verdict === 'flagged'
                          ? 'Policy Violation Detected: Prohibited Items Flagged'
                          : 'Audit Warning: Budget or Math Variance Detected'}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/80 border border-slate-200 text-slate-700">
                      {auditResult.extraction_source === 'synthetic_sample' ? 'Synthetic sample' : 'Extracted by Meta Model API'}
                    </span>
                  </div>
                </div>

                {/* Metadata Pills */}
                <div className="flex flex-wrap gap-2 pt-2 text-xs">
                  <span className="px-3 py-1 rounded-xl bg-white/80 border border-slate-200/80 font-medium">
                    <strong>Vendor:</strong> {auditResult.vendor}
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-white/80 border border-slate-200/80 font-medium font-mono">
                    <strong>Slip Ref:</strong> {auditResult.receipt_reference}
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-white/80 border border-slate-200/80 font-medium">
                    <strong>Date:</strong> {auditResult.occurred_at}
                  </span>
                </div>
              </div>

              {/* Financial Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-soft">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Receipt</span>
                  <span className="text-base font-bold text-slate-900">
                    ${(auditResult.total_minor / 100).toFixed(2)}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-soft">
                  <span className="text-[10px] font-bold text-mint-600 uppercase block">Eligible Aid</span>
                  <span className="text-base font-bold text-mint-700">
                    ${(auditResult.eligible_total_minor / 100).toFixed(2)}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-soft">
                  <span className="text-[10px] font-bold text-rose-600 uppercase block">Ineligible / Flagged</span>
                  <span className="text-base font-bold text-rose-700">
                    ${(auditResult.ineligible_total_minor / 100).toFixed(2)}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-soft">
                  <span className="text-[10px] font-bold text-brand-600 uppercase block">Tax Verified</span>
                  <span className="text-base font-bold text-brand-700">
                    ${(auditResult.tax_minor / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Anomalies Callout (if any) */}
              {auditResult.anomalies.length > 0 && (
                <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Forensic Accounting &amp; Policy Findings ({auditResult.anomalies.length}):</span>
                  </div>
                  <div className="space-y-1.5">
                    {auditResult.anomalies.map((a, idx) => (
                      <div key={idx} className="text-xs bg-white/90 p-2.5 rounded-xl border border-rose-100 flex items-start gap-2">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          a.severity === 'critical' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {a.severity}
                        </span>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800">{a.message}</p>
                          {a.amount_minor && (
                            <span className="text-[11px] text-rose-600 font-mono">
                              Blocked amount: ${(a.amount_minor / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Itemized Line Items Table */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-soft space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="font-serif text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-brand-600" />
                    <span>Itemized Line Extraction &amp; Policy Checks</span>
                  </h4>
                  <span className="text-xs text-slate-500">
                    {auditResult.items.length} items extracted
                  </span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {auditResult.items.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{item.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                            {item.category}
                          </span>
                        </div>
                        {item.flag_reason && (
                          <span className="text-[11px] text-rose-600 font-medium block mt-0.5">
                            &bull; {item.flag_reason}
                          </span>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900 block">
                          ${(item.price_minor / 100).toFixed(2)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                            item.is_eligible
                              ? 'bg-mint-50 text-mint-700 border border-mint-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {item.is_eligible ? '✓ Approved' : '❌ Prohibited'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Bar: Human Authority Reconciliation */}
              <div className="p-5 rounded-3xl bg-slate-100/90 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h5 className="font-serif text-sm font-bold text-slate-900">
                    Reconcile to Relief Ledger
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    {auditResult.ineligible_total_minor > 0
                      ? `Only $${(auditResult.eligible_total_minor / 100).toFixed(2)} in eligible essentials will be debited to the pool; prohibited items are excluded.`
                      : `Debits $${(auditResult.eligible_total_minor / 100).toFixed(2)} to ledger and marks receipt as fully reconciled.`}
                  </p>
                </div>

                {applyResult ? (
                  <div className="px-4 py-2 rounded-xl bg-mint-50 border border-mint-200 text-mint-900 text-xs font-bold flex items-center gap-2">
                    <HandDrawnCheck className="w-4 h-4 text-mint-600" />
                    <span>Reconciled on Ledger (#{applyResult.ledger_id.substring(0, 8)})</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isApplying || auditResult.eligible_total_minor <= 0}
                    onClick={handleApplyToLedger}
                    className="px-5 py-2.5 rounded-xl bg-mint-600 hover:bg-mint-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2"
                  >
                    {isApplying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Reconciling...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Apply ${(auditResult.eligible_total_minor / 100).toFixed(2)} to Ledger</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Historical AI Audits Log */}
      {auditHistory.length > 0 && (
        <div className="bg-white rounded-4xl p-6 sm:p-8 border border-slate-200/90 shadow-soft space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-600" />
              <h3 className="font-serif text-base font-bold text-slate-900">
                Audit Trail &amp; Forensic Log
              </h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {auditHistory.length} Recorded Audits
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[11px] text-slate-400 uppercase border-b border-slate-100">
                <tr>
                  <th className="py-2">Vendor</th>
                  <th className="py-2">Receipt Ref</th>
                  <th className="py-2">Total</th>
                  <th className="py-2">Eligible</th>
                  <th className="py-2">Verdict</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {auditHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 font-bold text-slate-900">{h.vendor}</td>
                    <td className="py-2.5 font-mono text-slate-500">{h.receipt_reference}</td>
                    <td className="py-2.5">${(h.total_minor / 100).toFixed(2)}</td>
                    <td className="py-2.5 text-mint-700">${(h.eligible_total_minor / 100).toFixed(2)}</td>
                    <td className="py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                          h.verdict === 'passed'
                            ? 'bg-mint-50 text-mint-700 border border-mint-200'
                            : h.verdict === 'flagged'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {h.verdict}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-400">{h.occurred_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

