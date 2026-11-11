import React, { useState, useEffect } from 'react';
import { GeoCluster, GeoClustersResponse } from '../types';
import { api } from '../api';
import {
  ShieldCheck,
  MapPin,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Info,
  Lock,
} from 'lucide-react';

interface GeographicClusterMapProps {
  campaignId: string;
  onSelectSector?: (sectorId: string) => void;
}

export const GeographicClusterMap: React.FC<GeographicClusterMapProps> = ({
  campaignId,
  onSelectSector,
}) => {
  const [data, setData] = useState<GeoClustersResponse | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<string>('sector-1');
  const [hoveredSectorId, setHoveredSectorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!campaignId) return;
    const fetchClusters = async () => {
      try {
        const res = await api.getGeoClusters(campaignId);
        setData(res);
        if (res.clusters.length > 0 && !selectedSectorId) {
          setSelectedSectorId(res.clusters[0].sector_id);
        }
      } catch (err) {
        console.error('Failed to load geographic clusters:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchClusters();
  }, [campaignId]);

  const activeSector = data?.clusters.find((c) => c.sector_id === selectedSectorId) || data?.clusters[0];

  if (isLoading || !data) {
    return (
      <div className="p-12 text-center bg-white rounded-4xl border border-slate-200/80 shadow-soft">
        <div className="w-10 h-10 rounded-2xl bg-sky-50 text-brand-600 flex items-center justify-center mx-auto mb-3 animate-pulse">
          <MapPin className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold text-slate-500">
          Loading illustrative demo map...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-4xl border border-slate-200/90 shadow-soft overflow-hidden space-y-6 p-6 sm:p-8">
      {/* Synthetic example notice */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 text-brand-600 font-semibold text-xs tracking-wider uppercase">
            <Layers className="w-4 h-4 text-brand-500" />
            <span>Spatial Scenario Explorer</span>
          </div>
          <h3 className="font-serif text-2xl font-bold text-slate-900 mt-0.5">
            {data.region_name} Scenario Map
          </h3>
          <p className="text-xs text-slate-500 max-w-xl mt-0.5">
            Illustrative example of how a campaign could summarize needs. This view is not connected to live recipient locations or payment records.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3.5 py-1.5 rounded-2xl bg-mint-50 border border-mint-200 text-mint-800 flex items-center gap-2 text-xs font-bold shadow-sm">
            <Lock className="w-3.5 h-3.5 text-mint-600" />
            <span>Fictional demo data</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Illustrative coverage</span>
            <span className="text-base font-bold text-brand-600">
              {data.overall_valley_funded_pct}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: SVG Map Canvas & Sector Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): Interactive Pastel SVG Map */}
        <div className="lg:col-span-7 bg-slate-50/80 rounded-3xl p-4 border border-slate-200/80 shadow-inner relative overflow-hidden">
          {/* Map Title Overlay */}
          <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-sm text-[11px] font-semibold text-slate-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-ping" />
            <span>Illustrative zones (Click to inspect)</span>
          </div>

          <div className="relative w-full aspect-[4/3] max-h-[460px]">
            <svg
              viewBox="0 0 760 480"
              className="w-full h-full select-none"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.02))' }}
            >
              {/* Topography Contours */}
              <defs>
                <linearGradient id="riverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7CC4FA" stopOpacity="0.85" />
                  <stop offset="50%" stopColor="#38A3F6" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#0F84EA" stopOpacity="0.95" />
                </linearGradient>
                <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E8F0" strokeWidth="0.5" strokeOpacity="0.6" />
                </pattern>
              </defs>

              <rect width="760" height="480" fill="#F8FAFC" rx="24" />
              <rect width="760" height="480" fill="url(#gridPattern)" rx="24" />

              {/* Elevation Contours */}
              <path
                d="M 20 60 Q 200 40 450 70 T 740 50 L 740 0 L 20 0 Z"
                fill="#F1F5F9"
                opacity="0.8"
              />
              <path
                d="M 50 420 Q 300 450 500 410 T 740 430 L 740 480 L 50 480 Z"
                fill="#F1F5F9"
                opacity="0.8"
              />

              {/* Riverbend Creek Main River Channel */}
              <path
                d="M 720 30 C 580 80, 520 180, 420 200 C 320 220, 260 260, 240 330 C 220 400, 150 430, 20 440"
                fill="none"
                stroke="url(#riverGradient)"
                strokeWidth="28"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.4"
              />
              <path
                d="M 720 30 C 580 80, 520 180, 420 200 C 320 220, 260 260, 240 330 C 220 400, 150 430, 20 440"
                fill="none"
                stroke="url(#riverGradient)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.85"
              />

              {/* Pine Creek Tributary */}
              <path
                d="M 420 200 C 500 240, 580 270, 720 280"
                fill="none"
                stroke="#BAE0FD"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.75"
              />

              {/* River Labels */}
              <text x="610" y="85" fill="#0284C7" fontSize="10" fontWeight="600" opacity="0.85">
                Riverbend Waters &rarr;
              </text>
              <text x="590" y="270" fill="#0284C7" fontSize="9" fontWeight="500" opacity="0.7">
                Pine Creek Tributary
              </text>

              {/* Sector Render Loop */}
              {data.clusters.map((sector) => {
                const { cx, cy, radius } = sector.map_coordinates;
                const isSelected = sector.sector_id === selectedSectorId;
                const isHovered = sector.sector_id === hoveredSectorId;

                // Color mapping
                const isMint = sector.color_theme === 'mint';
                const isSky = sector.color_theme === 'sky';
                const isAmber = sector.color_theme === 'amber';

                const auraColor = isMint ? '#BBF7D0' : isSky ? '#BAE0FD' : '#FED7AA';
                const pinColor = isMint ? '#16A34A' : isSky ? '#0284C7' : '#D97706';
                const badgeBg = isMint ? '#DCFCE7' : isSky ? '#E0F2FE' : '#FEF3C7';
                const badgeText = isMint ? '#15803D' : isSky ? '#0369A1' : '#92400E';

                return (
                  <g
                    key={sector.sector_id}
                    onClick={() => {
                      setSelectedSectorId(sector.sector_id);
                      if (onSelectSector) onSelectSector(sector.sector_id);
                    }}
                    onMouseEnter={() => setHoveredSectorId(sector.sector_id)}
                    onMouseLeave={() => setHoveredSectorId(null)}
                    className="cursor-pointer transition-all duration-300"
                  >
                    {/* Semi-transparent Sector Radius Aura */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius + (isSelected ? 10 : isHovered ? 6 : 0)}
                      fill={auraColor}
                      opacity={isSelected ? 0.55 : isHovered ? 0.45 : 0.28}
                      className="transition-all duration-300"
                    />

                    {/* Sector Border Ring */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill="none"
                      stroke={pinColor}
                      strokeWidth={isSelected ? 2.5 : 1.2}
                      strokeDasharray={isSelected ? 'none' : '4 3'}
                      opacity={isSelected ? 1 : 0.6}
                    />

                    {/* Sector Center Pulse Pin */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 14 : 11}
                      fill={pinColor}
                      className="transition-all duration-300 drop-shadow-sm"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 5 : 4}
                      fill="#FFFFFF"
                    />

                    {/* Floating Pill Label */}
                    <g transform={`translate(${cx - 55}, ${cy - radius - 16})`}>
                      <rect
                        width="110"
                        height="24"
                        rx="12"
                        fill="#FFFFFF"
                        stroke={isSelected ? pinColor : '#E2E8F0'}
                        strokeWidth={isSelected ? '2' : '1'}
                        className="drop-shadow-sm"
                      />
                      <text
                        x="55"
                        y="15"
                        textAnchor="middle"
                        fill="#0F172A"
                        fontSize="10"
                        fontWeight={isSelected ? '700' : '600'}
                      >
                        {sector.funding_percentage}% &bull; {sector.name.split(' ')[0]}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Map Legend */}
          <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600 font-medium">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-mint-500" />
                <span>Illustrative full coverage</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                <span>Illustrative partial coverage</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Illustrative gap</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Synthetic values • not a live report</span>
          </div>
        </div>

        {/* Right Column (5 cols): Selected Sector Detail Inspector */}
        <div className="lg:col-span-5 space-y-5">
          {activeSector ? (
            <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-5">
              {/* Sector Title & Badge */}
              <div className="space-y-1.5 border-b border-slate-200/80 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white text-slate-600 border border-slate-200 font-bold">
                    {activeSector.sector_code}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      activeSector.color_theme === 'mint'
                        ? 'bg-mint-100 text-mint-800 border border-mint-200'
                        : activeSector.color_theme === 'sky'
                        ? 'bg-sky-100 text-brand-800 border border-sky-200'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}
                  >
                    {activeSector.badge_label}
                  </span>
                </div>
                <h4 className="font-serif text-xl font-bold text-slate-900">
                  {activeSector.name}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {activeSector.description}
                </p>
              </div>

              {/* Financial Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-600">Funded / Target:</span>
                  <span className="text-slate-900">
                    ${(activeSector.funded_minor / 100).toFixed(2)} of ${(activeSector.total_requested_minor / 100).toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      activeSector.color_theme === 'mint'
                        ? 'bg-mint-500'
                        : activeSector.color_theme === 'sky'
                        ? 'bg-brand-500'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, activeSector.funding_percentage)}%` }}
                  />
                </div>
                {activeSector.unmet_minor > 0 && (
                  <p className="text-[11px] font-bold text-amber-800 text-right">
                    Remaining Unmet Gap: ${(activeSector.unmet_minor / 100).toFixed(2)}
                  </p>
                )}
              </div>

              {/* Example supplies */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Example items (not verified or deployed)
                </span>
                <div className="space-y-1.5">
                  {activeSector.active_items.map((item, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-mint-600 shrink-0" />
                        <span className="truncate max-w-[210px]">{item}</span>
                      </div>
                      <span className="text-[10px] font-bold text-brand-600 bg-sky-50 px-2 py-0.5 rounded-md">
                        Example
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data limitation */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
                    <span>Data and privacy note</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                  </span>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-400">
                  {data.privacy_note}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-slate-400 bg-slate-50 rounded-3xl">
              Select a sector on the map to inspect its relief deployment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
