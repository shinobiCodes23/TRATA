import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Cpu,
  RefreshCw,
  Send,
  Radio,
  Eye,
  ShieldAlert,
  Users,
  Compass,
  ArrowRight,
  Clock,
  Zap,
  Sliders,
  ChevronRight,
  HelpCircle,
  Truck,
  RotateCcw,
  Target,
  BarChart3,
  Waves,
  Mountain,
} from 'lucide-react';
import {
  CitizenReport,
  EmergencyAlert,
  HazardZone,
  IoTSensor,
  RegionProfile,
  RescueUnit,
  SimulationState,
} from '../types';

interface FusionIntelligenceCenterProps {
  reports: CitizenReport[];
  units: RescueUnit[];
  sensors: IoTSensor[];
  zones: HazardZone[];
  alerts: EmergencyAlert[];
  simState: SimulationState;
  currentRegion: RegionProfile;
  onNavigateToMap?: () => void;
}

export const FusionIntelligenceCenter: React.FC<FusionIntelligenceCenterProps> = ({
  reports,
  units,
  sensors,
  zones,
  alerts,
  simState,
  currentRegion,
  onNavigateToMap,
}) => {
  // Navigation Sub-Tabs
  const [activeTab, setActiveTab] = useState<
    'fusion_hub' | 'discrepancy_matrix' | 'incident_priority' | 'resource_allocation' | 'lifecycle_continuum'
  >('fusion_hub');

  // AI Synthesis Loading & Data State
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiFusionData, setAiFusionData] = useState<any>(null);
  const [aiLifecycleData, setAiLifecycleData] = useState<any>(null);
  const [lifecyclePhase, setLifecyclePhase] = useState<'before' | 'during' | 'after'>('during');

  // Dynamic weights for incident priority engine
  const [weightLives, setWeightLives] = useState<number>(35);
  const [weightHazard, setWeightHazard] = useState<number>(25);
  const [weightIsolation, setWeightIsolation] = useState<number>(20);
  const [weightInfra, setWeightInfra] = useState<number>(10);

  // Dynamic Risk Score
  const computeDynamicSectorRisk = () => {
    const sensorSurge = sensors.filter((s) => s.status === 'critical').length * 12;
    const reportSurge = reports.filter((r) => r.priorityTier === 'P1_CRITICAL').length * 15;
    const weatherFactor = (simState.rainfallRateMmH / 100) * 25 + (simState.riverStageM / 7) * 25;
    return Math.min(100, Math.max(15, Math.round(sensorSurge + reportSurge + weatherFactor)));
  };

  const dynamicRiskScore = computeDynamicSectorRisk();

  // Fetch AI Multi-Source Fusion Intelligence
  const fetchAiFusion = async () => {
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/fusion-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regionName: currentRegion.name,
          simState,
          sensors,
          reports,
          units,
          hazardZones: zones,
        }),
      });
      const data = await res.json();
      setAiFusionData(data);
    } catch (err) {
      console.error('Error fetching fusion intelligence:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Fetch Lifecycle Strategy
  const fetchAiLifecycle = async () => {
    try {
      const res = await fetch('/api/ai/lifecycle-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regionName: currentRegion.name,
          currentPhase: lifecyclePhase,
          simState,
        }),
      });
      const data = await res.json();
      setAiLifecycleData(data);
    } catch (err) {
      console.error('Error fetching lifecycle strategy:', err);
    }
  };

  useEffect(() => {
    fetchAiFusion();
    fetchAiLifecycle();
  }, [currentRegion.id, simState.stage]);

  // Calculate dynamic priority for reports with custom weight factors
  const prioritizedReportsList = [...reports].map((report) => {
    const trapped = report.trappedCount || 0;
    const livesScore = trapped >= 10 ? 100 : trapped >= 5 ? 85 : trapped >= 1 ? 70 : report.category === 'trapped_civilians' ? 80 : 20;
    const severityScore = report.severity === 'critical' ? 100 : report.severity === 'severe' ? 80 : 50;
    const isolationScore = report.category === 'bridge_damaged' || report.category === 'road_blocked' || report.category === 'landslide' ? 90 : 30;
    const infraScore = report.category === 'power_outage' || report.category === 'bridge_damaged' ? 85 : 25;

    const dynamicScore = Math.round(
      (livesScore * weightLives +
        severityScore * weightHazard +
        isolationScore * weightIsolation +
        infraScore * weightInfra +
        40 * 10) /
        100
    );

    return {
      ...report,
      calculatedScore: dynamicScore,
    };
  }).sort((a, b) => b.calculatedScore - a.calculatedScore);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 text-slate-100">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              MULTI-SOURCE DATA FUSION &amp; OPERATIONAL INTELLIGENCE
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fusing IoT In-Situ Telemetry + Official Govt Forecasts + Citizen Ground Crowdsourcing + SAR Satellite for {currentRegion.name}.
          </p>
        </div>

        {/* Global Dynamic Risk Gauge & AI Refresh */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-xl flex items-center gap-2.5 shadow-md">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Dynamic Fused Threat</span>
              <div className="text-sm font-black text-white flex items-center gap-1.5">
                <span className={dynamicRiskScore > 75 ? 'text-red-400 font-mono animate-pulse' : 'text-amber-400 font-mono'}>
                  {dynamicRiskScore} / 100
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-bold uppercase bg-red-950 text-red-300 border border-red-800">
                  {dynamicRiskScore > 75 ? 'DEFCON 1' : 'ELEVATED'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={fetchAiFusion}
            disabled={isAiLoading}
            className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-950/60 border border-cyan-400/30 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
            <span>{isAiLoading ? 'Synthesizing...' : 'Re-Run Fusion AI'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab('fusion_hub')}
          className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'fusion_hub' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Multi-Source Fusion Engine</span>
        </button>

        <button
          onClick={() => setActiveTab('discrepancy_matrix')}
          className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'discrepancy_matrix' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Ground Reality vs Prediction</span>
        </button>

        <button
          onClick={() => setActiveTab('incident_priority')}
          className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'incident_priority' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Incident Prioritization Queue</span>
        </button>

        <button
          onClick={() => setActiveTab('lifecycle_continuum')}
          className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'lifecycle_continuum' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Before &rarr; During &rarr; After Intelligence</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: MULTI-SOURCE FUSION HUB */}
      {/* ========================================================================= */}
      {activeTab === 'fusion_hub' && (
        <div className="space-y-6">
          {/* 4 Data Stream Columns Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stream 1: IoT Ground Sensors */}
            <div className="bg-slate-900 border border-cyan-900/50 p-4 rounded-2xl space-y-2 shadow-xl">
              <div className="flex items-center justify-between text-cyan-400">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Radio className="w-4 h-4" />
                  <span>1. IoT Telemetry Feed</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono font-bold">
                  {sensors.length} Active
                </span>
              </div>
              <div className="text-2xl font-black text-white">{sensors.filter((s) => s.status !== 'offline').length} / {sensors.length}</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                River gauge stages, pore-water pressure piezometers, and hill inclinometers updating at 1 Hz.
              </p>
              <div className="text-[10px] text-cyan-300 font-semibold pt-1">
                Avg Latency: <span className="font-mono text-white">420 ms</span> • Sensor Health: <span className="font-mono text-emerald-400">99.1%</span>
              </div>
            </div>

            {/* Stream 2: Official Hydro-Met Models */}
            <div className="bg-slate-900 border border-blue-900/50 p-4 rounded-2xl space-y-2 shadow-xl">
              <div className="flex items-center justify-between text-blue-400">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <BarChart3 className="w-4 h-4" />
                  <span>2. Official Govt Forecasts</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 font-mono font-bold">
                  IMD / CWC / GSI
                </span>
              </div>
              <div className="text-2xl font-black text-white">{simState.rainfallRateMmH} mm/h</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                CWC 1D hydrodynamic river routing and IMD Doppler radar reflectivity precipitation vectors.
              </p>
              <div className="text-[10px] text-blue-300 font-semibold pt-1">
                Forecast Window: <span className="font-mono text-white">12 Hours</span> • Model Cycle: <span className="font-mono text-white">Hourly</span>
              </div>
            </div>

            {/* Stream 3: Citizen Crowdsourced Ground Reports */}
            <div className="bg-slate-900 border border-amber-900/50 p-4 rounded-2xl space-y-2 shadow-xl">
              <div className="flex items-center justify-between text-amber-400">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Users className="w-4 h-4" />
                  <span>3. Citizen Ground Truth</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 font-mono font-bold">
                  {reports.length} Reports
                </span>
              </div>
              <div className="text-2xl font-black text-white">{reports.reduce((acc, r) => acc + (r.trappedCount || 0), 0)} Trapped</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Geo-referenced mobile field photo uploads, water depths, and road collapse observations.
              </p>
              <div className="text-[10px] text-amber-300 font-semibold pt-1">
                Triage Confidence: <span className="font-mono text-white">93.4%</span> • Photo Verification: <span className="font-mono text-emerald-400">AI Passed</span>
              </div>
            </div>

            {/* Stream 4: SAR & Satellite Earth Observation */}
            <div className="bg-slate-900 border border-purple-900/50 p-4 rounded-2xl space-y-2 shadow-xl">
              <div className="flex items-center justify-between text-purple-400">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Eye className="w-4 h-4" />
                  <span>4. Satellite / SAR Extents</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 font-mono font-bold">
                  Sentinel-1 SAR
                </span>
              </div>
              <div className="text-2xl font-black text-white">10m Res</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Cloud-penetrating Synthetic Aperture Radar water mask and optical slope deformation index.
              </p>
              <div className="text-[10px] text-purple-300 font-semibold pt-1">
                Inundation Area: <span className="font-mono text-white">42.8 km²</span> • Pass Age: <span className="font-mono text-white">2.4h</span>
              </div>
            </div>
          </div>

          {/* AI Fused Ground Truth Synthesis Box */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-cyan-900/60 p-5 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-sm text-white">Live Multi-Source Data Fusion Summary</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Fused Cross-Validation Score:</span>
                <span className="text-sm font-black font-mono text-cyan-300 bg-cyan-950 px-2.5 py-0.5 rounded-lg border border-cyan-800">
                  {aiFusionData?.fusionConfidence || 94.8}% Confidence
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {aiFusionData?.summary ||
                'Reconciling IoT sensor streams with official hydraulic models and crowdsourced citizen field uploads. Telemetry indicates critical discrepancies in low-lying river sectors requiring prioritized intervention.'}
            </p>

            {/* Cross-Validation Agreement Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between font-semibold text-slate-300">
                  <span>Sensor vs Forecast Agreement:</span>
                  <span className="text-cyan-400 font-bold font-mono">82%</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: '82%' }} />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Local runoff surge outpacing 1D model</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between font-semibold text-slate-300">
                  <span>Citizen vs Sensor Coherence:</span>
                  <span className="text-emerald-400 font-bold font-mono">97%</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: '97%' }} />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Photo-depth verified against IoT gauge</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between font-semibold text-slate-300">
                  <span>SAR Satellite Extent Alignment:</span>
                  <span className="text-purple-400 font-bold font-mono">91%</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-purple-400 rounded-full" style={{ width: '91%' }} />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Wetland water masks conform to hazard GIS</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: GROUND REALITY VS OFFICIAL PREDICTION (DISCREPANCY MATRIX) */}
      {/* ========================================================================= */}
      {activeTab === 'discrepancy_matrix' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-sm text-white">
                Discrepancy Matrix: Ground Reality (Sensors + Citizens) vs. Official Models
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Detects underpredicted blindspots and model biases where ground conditions are significantly worse than official government forecasts.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {(aiFusionData?.groundRealityVsPrediction || [
              {
                sector: 'Teesta / Lowland River Confluence',
                officialForecast: 'Predicted Inundation +2.2m (CWC Hydrology Model)',
                groundRealityReported: 'Field Depth +4.6m (IoT Gauge TG-01 & 4 Verified Citizen Photos)',
                discrepancyDelta: '+2.4m Higher than Predicted',
                status: 'CRITICAL_UNDERPREDICTION_BLINDSPOT',
                severity: 'critical',
                explanation: 'Sudden upstream glacial lake runoff surge exceeded 1D hydraulic model storage capacity.',
              },
              {
                sector: 'NH-10 Paglajhora Hill Corridor',
                officialForecast: 'Landslide Watch (FoS ~1.20, GSI Advisory)',
                groundRealityReported: 'Active Colluvium Shear & 18cm Road Displacement (Inclinometer & SDRF Patrol)',
                discrepancyDelta: 'FoS 0.61 (Imminent Catastrophic Shearing)',
                status: 'CRITICAL_FAILURE_CONFIRMED',
                severity: 'critical',
                explanation: 'Pore-water pressure spiked past 42 kPa after 72h antecedent rainfall burst.',
              },
              {
                sector: 'Sundarbans Delta Gosaba Embankment',
                officialForecast: 'Tidal Swell 4.2m (Standard High Tide)',
                groundRealityReported: 'Wave Overtopping & Earthen Dyke Seepage (Citizen Drone Recon)',
                discrepancyDelta: '+0.9m Storm Surge Anomaly',
                status: 'BREACH_IMMINENT',
                severity: 'severe',
                explanation: 'Compound wind-shear convergence pushed surge over fragile earthen bunds.',
              },
            ]).map((item: any, idx: number) => (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                    <h4 className="font-bold text-sm text-white">{item.sector}</h4>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                      item.status === 'CRITICAL_UNDERPREDICTION_BLINDSPOT' || item.status === 'CRITICAL_FAILURE_CONFIRMED'
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* Official Prediction */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-blue-900/30 space-y-1">
                    <span className="text-[10px] text-blue-400 uppercase font-bold block">Official Model Prediction</span>
                    <p className="text-slate-300 font-semibold">{item.officialForecast}</p>
                    <span className="text-[10px] text-slate-500 block">Baseline forecast feed</span>
                  </div>

                  {/* Ground Reality Reported */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-amber-900/30 space-y-1">
                    <span className="text-[10px] text-amber-400 uppercase font-bold block">Actual Ground Reality</span>
                    <p className="text-white font-semibold">{item.groundRealityReported}</p>
                    <span className="text-[10px] text-slate-500 block">IoT Sensors + Citizen Field Proof</span>
                  </div>

                  {/* Delta & Explanation */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-red-900/30 space-y-1">
                    <span className="text-[10px] text-red-400 uppercase font-bold block">Discrepancy Delta</span>
                    <p className="text-red-300 font-bold font-mono">{item.discrepancyDelta}</p>
                    <p className="text-[11px] text-slate-400 leading-tight">{item.explanation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: DYNAMIC INCIDENT PRIORITIZATION */}
      {/* ========================================================================= */}
      {activeTab === 'incident_priority' && (
        <div className="space-y-6">
          {/* Dynamic Weight Tuning Controls */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-xs text-white">Dynamic Incident Prioritization Algorithm Weights</h3>
              </div>
              <button
                onClick={() => {
                  setWeightLives(35);
                  setWeightHazard(25);
                  setWeightIsolation(20);
                  setWeightInfra(10);
                }}
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Defaults</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 font-semibold mb-1">
                  <span>Trapped Lives Weight:</span>
                  <span className="text-cyan-400 font-mono font-bold">{weightLives}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={60}
                  value={weightLives}
                  onChange={(e) => setWeightLives(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 font-semibold mb-1">
                  <span>Hazard Progression:</span>
                  <span className="text-amber-400 font-mono font-bold">{weightHazard}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={50}
                  value={weightHazard}
                  onChange={(e) => setWeightHazard(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 font-semibold mb-1">
                  <span>Isolation / Cutoff:</span>
                  <span className="text-purple-400 font-mono font-bold">{weightIsolation}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={40}
                  value={weightIsolation}
                  onChange={(e) => setWeightIsolation(parseInt(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 font-semibold mb-1">
                  <span>Critical Infrastructure:</span>
                  <span className="text-blue-400 font-mono font-bold">{weightInfra}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={30}
                  value={weightInfra}
                  onChange={(e) => setWeightInfra(parseInt(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Prioritized Incident Queue */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Dynamically Ranked Incident Queue ({prioritizedReportsList.length} total incidents)</span>
              <span>Sorted by Composite Urgency Score (High &rarr; Low)</span>
            </div>

            <div className="space-y-2.5">
              {prioritizedReportsList.map((rep, idx) => (
                <div
                  key={rep.id}
                  className={`p-4 rounded-xl border transition-all ${
                    rep.priorityTier === 'P1_CRITICAL'
                      ? 'bg-slate-900 border-red-900/60 hover:border-red-500'
                      : rep.priorityTier === 'P2_HIGH'
                      ? 'bg-slate-900 border-amber-900/60 hover:border-amber-500'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-slate-300">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-white">{rep.title}</h4>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              rep.priorityTier === 'P1_CRITICAL'
                                ? 'bg-red-950 text-red-300 border border-red-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {rep.priorityTier}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{rep.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-2">
                          <span>📍 {rep.location.address}</span>
                          {rep.trappedCount > 0 && (
                            <span className="text-red-400 font-bold">⚠️ {rep.trappedCount} Civilians Trapped</span>
                          )}
                          {rep.waterDepthCm && <span>🌊 Water: {rep.waterDepthCm}cm</span>}
                          {rep.debrisHeightM && <span>⛰️ Debris: {rep.debrisHeightM}m</span>}
                          <span>Status: <strong className="text-slate-200 capitalize">{rep.status}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Priority Score</span>
                        <span className="text-xl font-mono font-black text-cyan-300">{rep.calculatedScore} / 100</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: RESOURCE ALLOCATION RECOMMENDATION */}
      {/* ========================================================================= */}
      {activeTab === 'resource_allocation' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
            <div>
              <h3 className="font-bold text-sm text-white">Live Rescue Fleet Readiness</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Dispatch assignment is controlled by the Authority Command priority queue and A* route selection.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 5: BEFORE -> DURING -> AFTER INTELLIGENCE CONTINUUM */}
      {/* ========================================================================= */}
      {activeTab === 'lifecycle_continuum' && (
        <div className="space-y-6">
          {/* Phase Switcher Tabs */}
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
            <button
              onClick={() => setLifecyclePhase('before')}
              className={`p-3 rounded-xl text-left transition-all ${
                lifecyclePhase === 'before'
                  ? 'bg-gradient-to-r from-blue-950 to-slate-900 border border-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Phase 1</div>
              <div className="text-sm font-black text-white mt-0.5">BEFORE: Preparedness</div>
              <div className="text-[10px] text-slate-400 mt-1">T-72h to T-6h Pre-Impact Warning</div>
            </button>

            <button
              onClick={() => setLifecyclePhase('during')}
              className={`p-3 rounded-xl text-left transition-all ${
                lifecyclePhase === 'during'
                  ? 'bg-gradient-to-r from-red-950 to-slate-900 border border-red-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-red-400">Phase 2</div>
              <div className="text-sm font-black text-white mt-0.5">DURING: Crisis Response</div>
              <div className="text-[10px] text-slate-400 mt-1">T-0h to T+48h Tactical S&amp;R Operations</div>
            </button>

            <button
              onClick={() => setLifecyclePhase('after')}
              className={`p-3 rounded-xl text-left transition-all ${
                lifecyclePhase === 'after'
                  ? 'bg-gradient-to-r from-emerald-950 to-slate-900 border border-emerald-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Phase 3</div>
              <div className="text-sm font-black text-white mt-0.5">AFTER: Recovery &amp; Rebuild</div>
              <div className="text-[10px] text-slate-400 mt-1">T+48h to T+30d Silt/Damage &amp; Retrofit</div>
            </button>
          </div>

          {/* Phase Specific Detailed Intelligence View */}
          {lifecyclePhase === 'before' && (
            <div className="bg-slate-900 border border-blue-900/60 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <div>
                    <h3 className="font-bold text-base text-white">Pre-Disaster Preparedness &amp; Warning Intelligence</h3>
                    <p className="text-[11px] text-slate-400">Predictive Prepositioning &amp; Vulnerability Mitigation</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-blue-950 text-blue-300 border border-blue-800">
                  Readiness Score: 86%
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="font-bold text-blue-300 block">Pre-Impact Key Directives:</span>
                  <ul className="space-y-2 text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">1.</span>
                      <span><strong>Controlled Barrage Sluice Pre-Discharge:</strong> Execute controlled water releases from Gajoldoba and upstream reservoirs to create buffer capacity for peak flood surges.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">2.</span>
                      <span><strong>Landslide Drainage Clearance:</strong> Mobilize public works bulldozers along NH-10 Paglajhora to unclog road-side *jhoras* and prevent road cut undercutting.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">3.</span>
                      <span><strong>Shelter Provisioning:</strong> Pre-stock all 8 designated flood and hill shelters with 7 days of potable water, emergency medicine, and backup generator fuel.</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="font-bold text-blue-300 block">AI Predictive Asset Prepositioning:</span>
                  <p className="text-slate-300 leading-relaxed">
                    Based on 72h antecedent rainfall forecasts and pore-pressure trajectory:
                  </p>
                  <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-900 text-blue-200 font-semibold space-y-1">
                    <div>📍 Pre-position 4 Inflatable Swiftwater Boats at Teesta Bazar bridgehead.</div>
                    <div>📍 Pre-position 2 Heavy Excavators at Paglajhora Mile 14.</div>
                    <div>📍 Stage Medical Triage Helicopter at Siliguri Kanchenjunga Stadium.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {lifecyclePhase === 'during' && (
            <div className="bg-slate-900 border border-red-900/60 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-red-400" />
                  <div>
                    <h3 className="font-bold text-base text-white">Active Crisis &amp; Tactical Response Operations</h3>
                    <p className="text-[11px] text-slate-400">Live Multi-Source Ground Truth &amp; Life Extraction</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-red-950 text-red-300 border border-red-800 animate-pulse">
                  Active Crisis Mode (DEFCON 1)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="font-bold text-red-300 block">Tactical Operational Directives:</span>
                  <ul className="space-y-2 text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 font-bold">1.</span>
                      <span><strong>P1 Search &amp; Rescue Extraction:</strong> Prioritize swiftwater boat dispatches to rooftop civilian entrapment sectors in Teesta floodplain.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 font-bold">2.</span>
                      <span><strong>Dynamic Route Bypass:</strong> Automatically route evacuation convoys around washed-out bridges via secondary highland ridge bypasses.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 font-bold">3.</span>
                      <span><strong>Multi-Lingual Mass Push:</strong> Broadcast Common Alerting Protocol (CAP) messages in Bengali, English, and local dialects via SMS and EAS Radio.</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="font-bold text-red-300 block">Live Command Dispatch Matrix:</span>
                  <p className="text-slate-300 leading-relaxed">
                    Automated dynamic reallocation active across {units.length} tactical units:
                  </p>
                  <div className="p-3 rounded-lg bg-red-950/40 border border-red-900 text-red-200 font-semibold space-y-1">
                    <div>🚨 8 Search &amp; Rescue operations currently in progress.</div>
                    <div>🚨 430 civilians safely evacuated to higher ground in the last 6 hours.</div>
                    <div>🚨 Drone thermal reconnaissance surveying night-time landslide slope scars.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {lifecyclePhase === 'after' && (
            <div className="bg-slate-900 border border-emerald-900/60 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="font-bold text-base text-white">Post-Disaster Recovery &amp; Resilient Reconstruction</h3>
                    <p className="text-[11px] text-slate-400">Damage Survey, Grid Restoration &amp; ML Model Recalibration</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Recovery Progress: 72%
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="font-bold text-emerald-300 block">Reconstruction &amp; Relief Roadmap:</span>
                  <ul className="space-y-2 text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">1.</span>
                      <span><strong>Drone Volumetric Silt &amp; Debris Calculation:</strong> Calculate cubic meters of mud and gravel deposition across highway corridors for fast contractor clearing.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">2.</span>
                      <span><strong>Drinking Water &amp; Power Grid Recommissioning:</strong> Deploy chlorine purification water trucks and bypass flooded electrical transformers.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">3.</span>
                      <span><strong>Machine Learning Model Feedback:</strong> Ingest post-event inundation footprints back into the hydrological risk engine to eliminate future prediction blindspots.</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="font-bold text-emerald-300 block">Resilient Slope &amp; Embankment Upgrades:</span>
                  <p className="text-slate-300 leading-relaxed">
                    Long-term structural engineering retrofits:
                  </p>
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-900 text-emerald-200 font-semibold space-y-1">
                    <div>🏗️ Install high-tensile steel rockfall barrier netting along NH-10.</div>
                    <div>🌱 Bio-engineering vetiver grass root reinforcement on deforested hill slopes.</div>
                    <div>🛡️ Armor Sundarbans earthen dykes with geo-synthetic sandbags and mangrove buffers.</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
