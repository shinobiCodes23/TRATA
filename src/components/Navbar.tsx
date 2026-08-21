import React, { useState } from 'react';
import {
  ShieldAlert,
  Map as MapIcon,
  LayoutDashboard,
  Smartphone,
  Cpu,
  Boxes,
  Home,
  History,
  Sparkles,
  AlertTriangle,
  Volume2,
  VolumeX,
  X,
  Radio,
  Clock,
  Send,
  CheckCircle,
  MapPin,
  Menu,
} from 'lucide-react';
import { EmergencyAlert, SimulationState } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab?: (tab: string) => void;
  onTabChange?: (tab: string) => void;
  alerts?: EmergencyAlert[];
  activeAlerts?: EmergencyAlert[];
  simState: SimulationState;
  currentStageIndex?: number;
  onStageChange?: (newStage: number) => void;
  unresolvedReportsCount?: number;
  onOpenAIBriefing?: () => void;
  isSirenPlaying?: boolean;
  onToggleSiren?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onTabChange,
  alerts,
  activeAlerts,
  simState,
  currentStageIndex = 0,
  onStageChange,
  unresolvedReportsCount = 0,
  onOpenAIBriefing,
  isSirenPlaying,
  onToggleSiren,
}) => {
  const [showBriefingModal, setShowBriefingModal] = useState<boolean>(false);
  const [briefingLoading, setBriefingLoading] = useState<boolean>(false);
  const [briefingData, setBriefingData] = useState<any>(null);
  const [internalSirenPlaying, setInternalSirenPlaying] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const effectiveAlerts = alerts || activeAlerts || [];
  const handleTabSelect = (tab: string) => {
    if (onTabChange) onTabChange(tab);
    if (setActiveTab) setActiveTab(tab);
  };

  const tabs = [
    { id: 'map', label: 'Disaster Map', icon: MapIcon, badge: null },
    { id: 'fusion', label: 'Fusion Intelligence', icon: Sparkles, badge: 'Multi-Source' },
    { id: 'authority', label: 'Authority Command', icon: LayoutDashboard, badge: unresolvedReportsCount > 0 ? `${unresolvedReportsCount} P1` : 'DEFCON 1' },
    { id: 'citizen', label: 'Citizen Portal', icon: Smartphone, badge: 'Live Triage' },
    { id: 'risk-engine', label: 'Risk Engines', icon: Cpu, badge: 'Physics' },
    { id: 'digital-twin', label: 'Digital Twin & Story', icon: Boxes, badge: '8-Step Flow' },
    { id: 'iot', label: 'IoT Telemetry', icon: Radio, badge: 'Active' },
    { id: 'shelters', label: 'Shelters', icon: Home, badge: null },
    { id: 'historical', label: 'Historical Benchmarks', icon: History, badge: 'WB' },
  ];

  // Play synthetic emergency alert tone via Web Audio API
  const handleToggleSirenAudio = () => {
    if (onToggleSiren) {
      onToggleSiren();
      return;
    }
    try {
      if (internalSirenPlaying) {
        setInternalSirenPlaying(false);
      } else {
        setInternalSirenPlaying(true);
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.2);
        setTimeout(() => setInternalSirenPlaying(false), 1500);
      }
    } catch (e) {
      console.warn('Audio context unavailable', e);
    }
  };

  // Fetch AI Briefing from Gemini Backend
  const handleTriggerAIBriefing = async () => {
    setShowBriefingModal(true);
    if (onOpenAIBriefing) {
      onOpenAIBriefing();
    }
    setBriefingLoading(true);
    try {
      const res = await fetch('/api/ai/situation-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: 'Sundarbans — West Bengal (South)',
          simState,
          activeIncidentCount: unresolvedReportsCount || 5,
        }),
      });
      const data = await res.json();
      setBriefingData(data);
    } catch (err) {
      console.warn('AI Briefing fallback', err);
      setBriefingData({
        executiveSummary: `CRITICAL MULTI-HAZARD INUNDATION IN SUNDARBANS — WEST BENGAL (SOUTH): Catchment precipitation rate is ${simState.rainfallRateMmH}mm/hr with river stage cresting at ${simState.riverStageM}m. Fragile riverbanks and embankments are under pressure. Immediate evacuation of lower river basins is mandatory.`,
        criticalThreats: [
          'River/tidal stage exceeding danger mark across the Sundarbans delta',
          'Steep slope shear failure (Factor of Safety < 0.85) along critical transport corridors',
          'Flash flood inundation overtopping earthen embankments and culverts',
        ],
        prioritizedDirectives: [
          'Deploy NDRF & SDRF Swiftwater Rescue boats to high-priority P1 distress clusters',
          'Issue automated CAP Siren Broadcast across vulnerable riverine wards',
          `Direct evacuees to nearest flood-safe shelters with medical and power support`,
        ],
        estimatedPeakImpactWindow: 'Next 60 to 90 minutes',
      });
    } finally {
      setBriefingLoading(false);
    }
  };

  const sirenActive = isSirenPlaying ?? internalSirenPlaying;

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-900/15 bg-[linear-gradient(90deg,rgba(217,132,56,0.92)_0%,rgba(246,211,174,0.78)_25%,rgba(255,255,255,0.98)_40%,rgba(255,255,255,0.98)_60%,rgba(218,240,222,0.82)_78%,rgba(86,151,97,0.88)_100%)] text-slate-800 shadow-[0_2px_14px_rgba(51,65,85,0.12)]">
      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setIsSidebarOpen((open) => !open)}
                className="p-2 rounded-full border border-cyan-400/60 bg-white text-cyan-300 hover:bg-violet-950/90 hover:text-cyan-100 hover:shadow-[0_0_12px_rgba(34,211,238,0.55)] transition-all"
                aria-label={isSidebarOpen ? 'Close sidebar navigation' : 'Open sidebar navigation'}
                aria-expanded={isSidebarOpen}
              >
                <Menu className="w-4 h-4 text-black" />
              </button>
              {isSidebarOpen && (
                <nav className="absolute left-0 top-full z-50 mt-2 w-52 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl">
                  <div className="grid gap-1">
                    {[
                      { id: 'map', label: 'Home' },
                      { id: 'about', label: 'About Us' },
                      { id: 'how-it-works', label: 'How It Works' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          handleTabSelect(item.id);
                          setIsSidebarOpen(false);
                        }}
                        className={`rounded-md px-3 py-2 text-left text-xs font-medium transition-all ${
                          activeTab === item.id
                            ? 'bg-slate-800 text-white border border-slate-700 font-semibold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </nav>
              )}
            </div>
            <div className="w-9 h-9 shrink-0 flex items-center justify-center">
              <div className="w-full h-full flex items-center justify-center overflow-visible">
                <img src="/trata-globe.png" alt="TRATA globe logo" className="w-full h-full object-contain" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-black leading-none tracking-[0.07em] text-transparent bg-clip-text bg-gradient-to-r from-violet-700 via-fuchsia-600 to-cyan-600 text-base">TRATA</span>
              </div>
              <p className="mt-0.5 text-[10px] leading-none text-slate-600 hidden sm:block truncate max-w-md">
                Global Solutions in Motion
              </p>
            </div>
          </div>

          {/* Sundarbans context, seasonal timeline & AI briefing */}
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-1.5 rounded-lg border border-emerald-800/20 bg-white/35 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
              <MapPin className="h-3.5 w-3.5 text-emerald-700" />
              <span>Sundarbans — West Bengal (South)</span>
            </div>

            {/* Stage Selector */}
            {onStageChange && (
              <div className="hidden xl:flex items-center gap-1.5 bg-white/40 px-2 py-1 rounded-lg border border-slate-700/20 text-xs">
                <span className="text-[10px] text-slate-600">Timeline:</span>
                <select
                  value={currentStageIndex}
                  onChange={(e) => onStageChange(parseInt(e.target.value))}
                  className="bg-transparent text-amber-800 font-bold focus:outline-none cursor-pointer text-xs"
                >
                  <option value={0} className="bg-slate-900 text-white">Winter</option>
                  <option value={1} className="bg-slate-900 text-white">Pre-Monsoon</option>
                  <option value={3} className="bg-slate-900 text-white">Monsoon</option>
                  <option value={5} className="bg-slate-900 text-white">Post-Monsoon</option>
                </select>
              </div>
            )}

          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-2 pt-1 border-t border-slate-700/15">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabSelect(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-white/65 text-slate-900 shadow-sm ring-1 ring-slate-700/15 font-semibold'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/35'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-700' : 'text-slate-600'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-semibold ${
                      tab.badge.includes('P1')
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : tab.badge.includes('Live')
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-white/45 text-slate-600 border border-slate-700/15'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* AI Commander Strategic Briefing Modal */}
      {showBriefingModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-800/80 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-base text-white">
                  AI Incident Commander Strategic Briefing (Sundarbans — West Bengal (South))
                </h3>
              </div>
              <button
                onClick={() => setShowBriefingModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {briefingLoading ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-cyan-300 animate-pulse">
                  Gemini AI is analyzing real-time hydrological telemetry, embankment sensors, and active distress signals for Sundarbans — West Bengal (South)...
                </p>
              </div>
            ) : briefingData ? (
              <div className="space-y-4 text-xs">
                {/* Executive Summary */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-cyan-950 space-y-1">
                  <span className="text-[10px] text-cyan-400 uppercase font-bold tracking-wider">Executive Situation Overview</span>
                  <p className="text-slate-200 leading-relaxed">{briefingData.executiveSummary}</p>
                </div>

                {/* Critical Threats */}
                {briefingData.criticalThreats && briefingData.criticalThreats.length > 0 && (
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-red-950 space-y-2">
                    <span className="text-[10px] text-red-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Immediate Critical Threats</span>
                    </span>
                    <div className="space-y-1.5">
                      {briefingData.criticalThreats.map((threat: string, i: number) => (
                        <div key={i} className="text-slate-300 flex items-start gap-2">
                          <span className="text-red-500 font-bold">⚠️</span>
                          <span>{threat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prioritized Directives */}
                {briefingData.prioritizedDirectives && briefingData.prioritizedDirectives.length > 0 && (
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-950 space-y-2">
                    <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Prioritized Incident Directives</span>
                    </span>
                    <div className="space-y-1.5">
                      {briefingData.prioritizedDirectives.map((dir: string, i: number) => (
                        <div key={i} className="text-slate-300 flex items-start gap-2">
                          <span className="text-amber-400 font-bold">▶</span>
                          <span>{dir}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Peak Window */}
                {briefingData.estimatedPeakImpactWindow && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/80 text-slate-300 text-xs">
                    <span className="text-slate-400">Estimated Peak Inundation Window:</span>
                    <strong className="text-cyan-300">{briefingData.estimatedPeakImpactWindow}</strong>
                  </div>
                )}

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Emergency Helpline: <strong className="text-slate-200">1070 (WB Disaster Control) · 112</strong></span>
                  <span>Jurisdiction: <strong className="text-slate-200">West Bengal (South)</strong></span>
                </div>

                <button
                  onClick={() => setShowBriefingModal(false)}
                  className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-all shadow-md"
                >
                  Acknowledge & Close Briefing
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </header>
  );
};
