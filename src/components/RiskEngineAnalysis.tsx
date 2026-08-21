import React, { useEffect, useMemo, useState } from 'react';
import {
  Cpu, Droplets, Mountain, Sliders, TrendingUp, ShieldAlert, Info, Layers,
  Calculator, RefreshCw, Gauge, Activity, Trees, AlertTriangle, Compass,
  ArrowDownRight, Zap, HelpCircle, Waves, Dam, Wind, Sparkles,
} from 'lucide-react';
import { GeoLocation, HazardZone, RiskSummary, SimulationState } from '../types';
import { calculateFloodRisk, calculateLandslideRisk } from '../utils/riskCalculators';

interface RiskEngineAnalysisProps {
  simState: SimulationState;
  zones: HazardZone[];
  onRiskSummaryChange?: (summary: RiskSummary) => void;
}

interface GeminiRiskIntelligence {
  source: string;
  confidence: number;
  forecastHorizon: string;
  analysisSummary: string;
  floodOutlook: { trend: string; detail: string };
  landslideOutlook: { trend: string; detail: string };
  priorityActions: string[];
  dataLimitations: string;
}

function isGeminiRiskIntelligence(value: unknown): value is GeminiRiskIntelligence {
  if (!value || typeof value !== 'object') return false;
  const intelligence = value as GeminiRiskIntelligence;
  return typeof intelligence.source === 'string'
    && typeof intelligence.confidence === 'number'
    && typeof intelligence.forecastHorizon === 'string'
    && typeof intelligence.analysisSummary === 'string'
    && typeof intelligence.floodOutlook?.trend === 'string'
    && typeof intelligence.floodOutlook?.detail === 'string'
    && typeof intelligence.landslideOutlook?.trend === 'string'
    && typeof intelligence.landslideOutlook?.detail === 'string'
    && Array.isArray(intelligence.priorityActions)
    && intelligence.priorityActions.every((action) => typeof action === 'string')
    && typeof intelligence.dataLimitations === 'string';
}

export const RiskEngineAnalysis: React.FC<RiskEngineAnalysisProps> = ({ simState, zones, onRiskSummaryChange }) => {
  // Navigation Sub-tab within Risk Engine
  const [activeEngineTab, setActiveEngineTab] = useState<'both' | 'landslide_deep' | 'flood_deep'>('both');

  // Hydrological & Hydraulic Inputs
  const [rainfallRate, setRainfallRate] = useState<number>(simState.rainfallRateMmH);
  const [accumulatedRainfall, setAccumulatedRainfall] = useState<number>(simState.accumulatedRainfallMm);
  const [riverStage, setRiverStage] = useState<number>(simState.riverStageM);
  const [soilMoisture, setSoilMoisture] = useState<number>(simState.soilSaturationPercent);
  const [distToRiver, setDistToRiver] = useState<number>(180);
  const [elevation, setElevation] = useState<number>(145);
  const [drainageObstruction, setDrainageObstruction] = useState<number>(65); // %
  const [upstreamDischarge, setUpstreamDischarge] = useState<number>(5400); // m3/s
  const [stormSurgeCrest, setStormSurgeCrest] = useState<number>(2.4); // m
  const [manningsN, setManningsN] = useState<number>(0.035);

  // Geotechnical & Topographic Inputs
  const [porePressure, setPorePressure] = useState<number>(simState.groundPorePressureKPa);
  const [slopeAngle, setSlopeAngle] = useState<number>(34);
  const [soilCohesion, setSoilCohesion] = useState<number>(14); // kPa (effective cohesion c')
  const [frictionAngle, setFrictionAngle] = useState<number>(30); // degrees (internal friction phi')
  const [vegCoverage, setVegCoverage] = useState<number>(35); // % (canopy & root reinforcement)
  const [slopeCurvature, setSlopeCurvature] = useState<'concave' | 'planar' | 'convex'>('concave');
  const [toeExcavation, setToeExcavation] = useState<number>(60); // % (road benching / NH-10 cut slope)
  const [jhoraDistance, setJhoraDistance] = useState<number>(40); // m (proximity to mountain ravine)
  const [seismicPGA, setSeismicPGA] = useState<number>(0.08); // g (Peak Ground Acceleration)

  // Preset Geotechnical Profiles (Landslide Lab)
  const applyLandslidePreset = (preset: 'nh10_paglajhora' | 'teesta_cliff' | 'deforested_colluvium' | 'stable_bedrock') => {
    if (preset === 'nh10_paglajhora') {
      setSlopeAngle(42);
      setElevation(980);
      setSoilCohesion(10);
      setFrictionAngle(28);
      setVegCoverage(25);
      setSlopeCurvature('concave');
      setToeExcavation(85);
      setJhoraDistance(25);
      setPorePressure(44);
      setSeismicPGA(0.09);
    } else if (preset === 'teesta_cliff') {
      setSlopeAngle(48);
      setElevation(240);
      setSoilCohesion(16);
      setFrictionAngle(34);
      setVegCoverage(40);
      setSlopeCurvature('planar');
      setToeExcavation(40);
      setJhoraDistance(15);
      setPorePressure(32);
      setSeismicPGA(0.04);
    } else if (preset === 'deforested_colluvium') {
      setSlopeAngle(31);
      setElevation(450);
      setSoilCohesion(8);
      setFrictionAngle(26);
      setVegCoverage(10);
      setSlopeCurvature('concave');
      setToeExcavation(50);
      setJhoraDistance(65);
      setPorePressure(38);
      setSeismicPGA(0.05);
    } else {
      // stable bedrock
      setSlopeAngle(14);
      setElevation(320);
      setSoilCohesion(38);
      setFrictionAngle(38);
      setVegCoverage(90);
      setSlopeCurvature('convex');
      setToeExcavation(0);
      setJhoraDistance(300);
      setPorePressure(12);
      setSeismicPGA(0.02);
    }
  };

  // Preset Hydraulic Profiles (Flood Lab)
  const applyFloodPreset = (preset: 'teesta_confluence' | 'gajoldoba_spillway' | 'sundarbans_estuary' | 'highland_safe') => {
    if (preset === 'teesta_confluence') {
      setElevation(75);
      setDistToRiver(45);
      setSlopeAngle(3);
      setRiverStage(7.6);
      setRainfallRate(75);
      setAccumulatedRainfall(220);
      setSoilMoisture(96);
      setDrainageObstruction(80);
      setUpstreamDischarge(7800);
      setStormSurgeCrest(0.5);
      setManningsN(0.045);
    } else if (preset === 'gajoldoba_spillway') {
      setElevation(110);
      setDistToRiver(20);
      setSlopeAngle(4);
      setRiverStage(8.8);
      setRainfallRate(95);
      setAccumulatedRainfall(280);
      setSoilMoisture(98);
      setDrainageObstruction(60);
      setUpstreamDischarge(12500);
      setStormSurgeCrest(0.0);
      setManningsN(0.035);
    } else if (preset === 'sundarbans_estuary') {
      setElevation(2.5);
      setDistToRiver(30);
      setSlopeAngle(1);
      setRiverStage(5.2);
      setRainfallRate(60);
      setAccumulatedRainfall(180);
      setSoilMoisture(92);
      setDrainageObstruction(85);
      setUpstreamDischarge(3200);
      setStormSurgeCrest(4.4);
      setManningsN(0.055);
    } else {
      // highland safe
      setElevation(450);
      setDistToRiver(750);
      setSlopeAngle(12);
      setRiverStage(2.4);
      setRainfallRate(15);
      setAccumulatedRainfall(40);
      setSoilMoisture(45);
      setDrainageObstruction(10);
      setUpstreamDischarge(800);
      setStormSurgeCrest(0.0);
      setManningsN(0.025);
    }
  };

  // Dynamic Sim State built from sliders
  const activeCustomSim: SimulationState = {
    ...simState,
    rainfallRateMmH: rainfallRate,
    accumulatedRainfallMm: accumulatedRainfall,
    riverStageM: riverStage,
    soilSaturationPercent: soilMoisture,
    groundPorePressureKPa: porePressure,
  };

  const customLoc: GeoLocation = {
    lat: 26.864,
    lng: 88.342,
    elevation,
    slopeAngle,
    distanceToRiver: distToRiver,
    slopeCurvature,
    soilCohesionKPa: soilCohesion,
    frictionAngleDeg: frictionAngle,
    vegetationCoveragePercent: vegCoverage,
    toeExcavationSeverityPercent: toeExcavation,
    distanceToJhoraM: jhoraDistance,
    seismicPGAG: seismicPGA,
    urbanDrainageObstructionPercent: drainageObstruction,
    upstreamDischargeCumecs: upstreamDischarge,
    stormSurgeTidalCrestM: stormSurgeCrest,
    manningsRoughnessCoeff: manningsN,
  };

  const floodResult = calculateFloodRisk(customLoc, activeCustomSim);
  const landslideResult = calculateLandslideRisk(customLoc, activeCustomSim);
  const riskSummary = useMemo(() => zones.reduce((summary: RiskSummary, zone) => {
    const risk = zone.type === 'flood'
      ? floodResult
      : zone.type === 'landslide'
        ? landslideResult
        : floodResult.score >= landslideResult.score ? floodResult : landslideResult;

    if (risk.tier === 'low') return summary;

    summary.areasUnderThreat += 1;
    summary.citizensUnderWarning += zone.populationAtRisk;
    if (risk.tier === 'critical') summary.criticallyAffected += 1;
    return summary;
  }, { areasUnderThreat: 0, criticallyAffected: 0, citizensUnderWarning: 0 }), [zones, floodResult.score, floodResult.tier, landslideResult.score, landslideResult.tier]);

  useEffect(() => {
    onRiskSummaryChange?.(riskSummary);
  }, [onRiskSummaryChange, riskSummary]);
  const [geminiIntelligence, setGeminiIntelligence] = useState<GeminiRiskIntelligence | null>(null);
  const [isLoadingIntelligence, setIsLoadingIntelligence] = useState(false);
  const [intelligenceError, setIntelligenceError] = useState<string | null>(null);

  const handleRefreshGeminiIntelligence = async () => {
    setIsLoadingIntelligence(true);
    setIntelligenceError(null);
    try {
      const response = await fetch('/api/ai/risk-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: customLoc,
          simulation: activeCustomSim,
          floodRisk: floodResult,
          landslideRisk: landslideResult,
        }),
      });
      if (!response.ok) throw new Error('Gemini intelligence is currently unavailable.');
      const intelligence: unknown = await response.json();
      if (!isGeminiRiskIntelligence(intelligence)) throw new Error('Gemini intelligence is currently unavailable.');
      setGeminiIntelligence(intelligence);
    } catch (error) {
      setIntelligenceError('Gemini intelligence is currently unavailable. Physics-based risk assessment remains available.');
    } finally {
      setIsLoadingIntelligence(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 text-slate-100">
      {/* Header */}
      <div className="pb-3 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl sm:text-2xl font-black text-white">PHYSICS-BASED MULTI-HAZARD RISK ENGINES</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic mathematical modeling for infinite slope stability, Mohr-Coulomb geotechnical failure, and 2D hydro-dynamic flood inundation.
          </p>
        </div>

        {/* Engine Filter Tabs */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
          <button
            onClick={() => setActiveEngineTab('both')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeEngineTab === 'both' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Dual Engine View
          </button>
          <button
            onClick={() => setActiveEngineTab('landslide_deep')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeEngineTab === 'landslide_deep' ? 'bg-amber-950 text-amber-300 border border-amber-800/80 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>Landslide Geotechnical Lab</span>
          </button>
          <button
            onClick={() => setActiveEngineTab('flood_deep')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
              activeEngineTab === 'flood_deep' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/80 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>Hydraulic Flood Lab</span>
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-violet-800/70 bg-gradient-to-br from-violet-950/35 via-slate-900 to-slate-950 p-4 shadow-xl">
        <div className="flex flex-col gap-3 border-b border-violet-900/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-violet-200">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-black">Gemini Risk Intelligence</h2>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">AI advisory based on the current physics-model inputs and available public context. It does not replace sensor data or command approval.</p>
          </div>
          <button
            onClick={handleRefreshGeminiIntelligence}
            disabled={isLoadingIntelligence}
            className="rounded-lg border border-violet-500/70 bg-violet-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-violet-500 disabled:cursor-wait disabled:opacity-60"
          >
            {isLoadingIntelligence ? 'Analysing current conditions…' : 'Refresh AI analysis'}
          </button>
        </div>

        {intelligenceError && <p className="mt-3 rounded-lg border border-red-800 bg-red-950/40 p-2 text-xs text-red-200">{intelligenceError}</p>}
        {!geminiIntelligence && !intelligenceError && <p className="mt-3 text-xs text-slate-400">Request an analysis to view a detailed flood and landslide outlook for the currently configured site.</p>}
        {geminiIntelligence && (
          <div className="mt-3 space-y-3 text-xs">
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border border-violet-900/70 bg-slate-950/70 p-3 lg:col-span-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-violet-300">Operational summary · {geminiIntelligence.forecastHorizon}</div>
                <p className="mt-1 leading-relaxed text-slate-200">{geminiIntelligence.analysisSummary}</p>
                <p className="mt-2 text-[10px] text-slate-500">Source: {geminiIntelligence.source} · Confidence: {Math.round(geminiIntelligence.confidence * 100)}%</p>
              </div>
              <div className="rounded-xl border border-amber-900/70 bg-amber-950/20 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Data limitation</div>
                <p className="mt-1 leading-relaxed text-slate-300">{geminiIntelligence.dataLimitations}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                ['Flood outlook', geminiIntelligence.floodOutlook, 'text-cyan-300'],
                ['Landslide outlook', geminiIntelligence.landslideOutlook, 'text-amber-300'],
              ].map(([title, outlook, color]) => (
                <div key={title as string} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${color as string}`}>{title as string} · {(outlook as GeminiRiskIntelligence['floodOutlook']).trend}</div>
                  <p className="mt-1 leading-relaxed text-slate-300">{(outlook as GeminiRiskIntelligence['floodOutlook']).detail}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Recommended command actions</div>
              <ol className="mt-2 grid gap-1 text-slate-300 sm:grid-cols-3">{geminiIntelligence.priorityActions.map((action, index) => <li key={action} className="flex gap-2"><span className="font-bold text-emerald-400">{index + 1}.</span>{action}</li>)}</ol>
            </div>
          </div>
        )}
      </section>

      {/* Preset Geological / Hydrological Profiles Strip */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/70">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200">
              {activeEngineTab === 'flood_deep'
                ? 'Load Hydraulic Flood Field Benchmarks:'
                : activeEngineTab === 'landslide_deep'
                ? 'Load Geotechnical Landslide Field Benchmarks:'
                : 'Load Physics Benchmark Profiles:'}
            </span>
          </div>
          <button
            onClick={() => {
              setRainfallRate(simState.rainfallRateMmH);
              setAccumulatedRainfall(simState.accumulatedRainfallMm);
              setRiverStage(simState.riverStageM);
              setSoilMoisture(simState.soilSaturationPercent);
              setPorePressure(simState.groundPorePressureKPa);
            }}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync to Active Simulation Stage</span>
          </button>
        </div>

        {/* FLOOD PRESETS (when in Hydraulic Flood Lab or Dual View) */}
        {activeEngineTab === 'flood_deep' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs animate-fadeIn">
            <button
              onClick={() => applyFloodPreset('teesta_confluence')}
              className="p-2.5 rounded-xl bg-slate-950/80 border border-cyan-900/50 hover:border-cyan-500 hover:bg-cyan-950/20 text-left transition-all group"
            >
              <div className="font-bold text-cyan-400 flex items-center justify-between">
                <span>Teesta Confluence (WB)</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-red-950 text-red-300 rounded border border-red-800">Critical</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                Elev: 75m, 45m from river, 7.6m stage, 96% saturation, heavy 80% culvert silt obstruction.
              </p>
            </button>

            <button
              onClick={() => applyFloodPreset('gajoldoba_spillway')}
              className="p-2.5 rounded-xl bg-slate-950/80 border border-blue-900/50 hover:border-blue-500 hover:bg-blue-950/20 text-left transition-all group"
            >
              <div className="font-bold text-blue-400 flex items-center justify-between">
                <span>Gajoldoba Barrage Spillway</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-red-950 text-red-300 rounded border border-red-800">Emergency</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                12,500 m³/s sluice release discharge, 8.8m river stage, extreme overland torrent velocity.
              </p>
            </button>

            <button
              onClick={() => applyFloodPreset('sundarbans_estuary')}
              className="p-2.5 rounded-xl bg-slate-950/80 border border-amber-900/50 hover:border-amber-500 hover:bg-amber-950/20 text-left transition-all group"
            >
              <div className="font-bold text-amber-400 flex items-center justify-between">
                <span>Sundarbans Delta Dyke Overtopping</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-950 text-amber-300 rounded border border-amber-800">Severe</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                Elev: 2.5m, 4.4m storm surge tidal anomaly, saline earthen bund saturation &amp; dyke breach.
              </p>
            </button>

            <button
              onClick={() => applyFloodPreset('highland_safe')}
              className="p-2.5 rounded-xl bg-slate-950/80 border border-emerald-900/50 hover:border-emerald-500 hover:bg-emerald-950/20 text-left transition-all group"
            >
              <div className="font-bold text-emerald-400 flex items-center justify-between">
                <span>Highland Drainage Terrace</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950 text-emerald-300 rounded border border-emerald-800">Stable</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                Elev: 450m, 750m buffer from channel, rapid natural stormwater runoff drainage.
              </p>
            </button>
          </div>
        )}

        {/* LANDSLIDE PRESETS (when in Landslide Lab or Dual View) */}
        {activeEngineTab !== 'flood_deep' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs animate-fadeIn">
            <button
              onClick={() => applyLandslidePreset('nh10_paglajhora')}
              className="p-2.5 rounded-xl bg-slate-950/80 border border-red-900/50 hover:border-red-500 hover:bg-red-950/20 text-left transition-all group"
            >
              <div className="font-bold text-red-400 flex items-center justify-between">
                <span>NH-10 Paglajhora (WB)</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-red-950 text-red-300 rounded border border-red-800">Critical</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                42° slope, fractured phyllite, high toe cut, concave hollow, active shear deformation.
              </p>
            </button>

            <button
              onClick={() => applyLandslidePreset('teesta_cliff')}
              className="p-2.5 rounded-xl bg-slate-950/80 border border-amber-900/50 hover:border-amber-500 hover:bg-amber-950/20 text-left transition-all group"
            >
              <div className="font-bold text-amber-400 flex items-center justify-between">
                <span>Teesta Gorge Escarpment</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-950 text-amber-300 rounded border border-amber-800">Severe</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                48° steep rock cliff face, stream undercutting, high planar friction, toppling risk.
              </p>
            </button>

            <button
              onClick={() => applyLandslidePreset('deforested_colluvium')}
              className="p-2.5 rounded-xl bg-slate-950/80 border border-amber-900/50 hover:border-amber-500 hover:bg-amber-950/20 text-left transition-all group"
            >
              <div className="font-bold text-amber-300 flex items-center justify-between">
                <span>Deforested Tea Ridge Slope</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-950 text-amber-300 rounded border border-amber-800">High</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                31° slope, minimal root cohesion (10%), loose saturated topsoil layer prone to mudflow.
              </p>
            </button>

            <button
              onClick={() => applyLandslidePreset('stable_bedrock')}
              className="p-2.5 rounded-xl bg-slate-950/80 border border-emerald-900/50 hover:border-emerald-500 hover:bg-emerald-950/20 text-left transition-all group"
            >
              <div className="font-bold text-emerald-400 flex items-center justify-between">
                <span>Intact Bedrock Forest</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950 text-emerald-300 rounded border border-emerald-800">Stable</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                14° gentle convex ridge, dense tree canopy (90%), c&apos;=38 kPa, zero toe disturbance.
              </p>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PARAMETER ADJUSTERS SECTION */}
      {/* ========================================================================= */}

      {/* 1. HYDRAULIC FLOOD PARAMETER ADJUSTERS (Visible in Flood Lab or Dual View) */}
      {(activeEngineTab === 'flood_deep' || activeEngineTab === 'both') && (
        <div className="bg-slate-900 border border-cyan-900/50 rounded-2xl p-5 shadow-xl space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-cyan-400" />
              <h2 className="font-bold text-sm text-white">Hydraulic &amp; Hydro-Dynamic Flood Parameter Adjusters</h2>
            </div>
            <span className="text-[10px] text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 font-mono font-bold">
              2D St. Venant &amp; Manning Equations
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {/* Factor 1: River Stage Height (H) */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                  1. River Channel Stage (H):
                </span>
                <span className={`font-mono font-bold ${riverStage > 6.0 ? 'text-red-400' : 'text-cyan-300'}`}>
                  {riverStage.toFixed(1)} m
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={12.0}
                step={0.1}
                value={riverStage}
                onChange={(e) => setRiverStage(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Danger Level: 6.0m | Bankfull Capacity Exceeded</span>
            </div>

            {/* Factor 2: Proximity to River Channel (D_river) */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  2. Distance to River (D_river):
                </span>
                <span className="font-mono font-bold text-cyan-300">{distToRiver} m</span>
              </div>
              <input
                type="range"
                min={10}
                max={1200}
                step={10}
                value={distToRiver}
                onChange={(e) => setDistToRiver(parseInt(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Floodplain inundation envelope &lt; 300m</span>
            </div>

            {/* Factor 3: Topographic Elevation (Z) */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <Mountain className="w-3.5 h-3.5 text-cyan-400" />
                  3. Elevation Datum (Z):
                </span>
                <span className={`font-mono font-bold ${elevation < 20 ? 'text-red-400' : 'text-cyan-300'}`}>
                  {elevation} m
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={600}
                step={1}
                value={elevation}
                onChange={(e) => setElevation(parseInt(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Topographic sink &lt; 30m above datum</span>
            </div>

            {/* Factor 4: Rainfall Rate & Cumulative Influx */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  4. Rainfall Intensity:
                </span>
                <span className="font-mono font-bold text-cyan-400">{rainfallRate} mm/h</span>
              </div>
              <input
                type="range"
                min={0}
                max={150}
                value={rainfallRate}
                onChange={(e) => setRainfallRate(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Accumulated 72h: {accumulatedRainfall} mm</span>
            </div>

            {/* Factor 5: Soil Saturation & Infiltration */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  5. Soil Saturation Index:
                </span>
                <span className={`font-mono font-bold ${soilMoisture > 85 ? 'text-red-400' : 'text-cyan-300'}`}>
                  {soilMoisture}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={soilMoisture}
                onChange={(e) => setSoilMoisture(parseInt(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Zero infiltration capacity at 100% (100% overland runoff)</span>
            </div>

            {/* Factor 6: Urban Drainage Obstruction / Silt Blockage */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                  6. Silt &amp; Culvert Clogging:
                </span>
                <span className={`font-mono font-bold ${drainageObstruction > 60 ? 'text-red-400' : 'text-cyan-300'}`}>
                  {drainageObstruction}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={drainageObstruction}
                onChange={(e) => setDrainageObstruction(parseInt(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Reduces stormwater evacuation discharge rate</span>
            </div>

            {/* Factor 7: Upstream Barrage / Dam Discharge (Q) */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <Dam className="w-3.5 h-3.5 text-cyan-400" />
                  7. Barrage Sluice Inflow (Q):
                </span>
                <span className="font-mono font-bold text-cyan-300">{upstreamDischarge} m³/s</span>
              </div>
              <input
                type="range"
                min={500}
                max={15000}
                step={250}
                value={upstreamDischarge}
                onChange={(e) => setUpstreamDischarge(parseInt(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Upstream reservoir spillway hydrograph</span>
            </div>

            {/* Factor 8: Coastal Tidal Surge Crest (H_surge) */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <Waves className="w-3.5 h-3.5 text-cyan-400" />
                  8. Storm Surge Anomaly:
                </span>
                <span className="font-mono font-bold text-cyan-300">{stormSurgeCrest.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min={0.0}
                max={6.0}
                step={0.2}
                value={stormSurgeCrest}
                onChange={(e) => setStormSurgeCrest(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Sundarbans / Coastal astronomical high tide crest</span>
            </div>

            {/* Factor 9: Manning's Roughness Coefficient (n) */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                  9. Manning Roughness (n):
                </span>
                <span className="font-mono font-bold text-cyan-300">{manningsN.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min={0.015}
                max={0.075}
                step={0.005}
                value={manningsN}
                onChange={(e) => setManningsN(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Concrete (0.015) vs. Floodplain Silt &amp; Shrubs (0.055)</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. GEOTECHNICAL LANDSLIDE PARAMETER ADJUSTERS (Visible in Landslide Lab or Dual View) */}
      {(activeEngineTab === 'landslide_deep' || activeEngineTab === 'both') && (
        <div className="bg-slate-900 border border-amber-900/50 rounded-2xl p-5 shadow-xl space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Mountain className="w-4 h-4 text-amber-400" />
              <h2 className="font-bold text-sm text-white">Geotechnical &amp; Slope Stability Parameter Adjusters</h2>
            </div>
            <span className="text-[10px] text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800 font-mono font-bold">
              Mohr-Coulomb &amp; Infinite Slope FoS
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {/* Factor 1: Slope Gradient (beta) */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <Mountain className="w-3.5 h-3.5 text-amber-400" />
                  1. Slope Angle (&beta;):
                </span>
                <span className={`font-mono font-bold ${slopeAngle > 35 ? 'text-red-400' : 'text-amber-300'}`}>
                  {slopeAngle}°
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={65}
                value={slopeAngle}
                onChange={(e) => setSlopeAngle(parseInt(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Critical shear angle &gt; 28° | Angle of repose</span>
            </div>

            {/* Factor 2: 72h Rainfall & Burst Intensity */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  2. Rainfall Intensity (I-D):
                </span>
                <span className="font-mono font-bold text-cyan-400">{rainfallRate} mm/h</span>
              </div>
              <input
                type="range"
                min={0}
                max={120}
                value={rainfallRate}
                onChange={(e) => setRainfallRate(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">
                72h Total: {accumulatedRainfall} mm | Trigger: {landslideResult.rainfallIntensityTriggerMmH} mm/h
              </span>
            </div>

            {/* Factor 3: Pore Water Pressure (u) */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  3. Pore-Water Pressure (u):
                </span>
                <span className={`font-mono font-bold ${porePressure > 35 ? 'text-red-400' : 'text-amber-300'}`}>
                  {porePressure} kPa
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={75}
                value={porePressure}
                onChange={(e) => setPorePressure(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Reduces effective stress &sigma;&apos; = &sigma; - u</span>
            </div>

            {/* Factor 4: Soil Cohesion (c') & Friction Angle */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  4. Rock / Soil Cohesion (c&apos;):
                </span>
                <span className="font-mono font-bold text-amber-300">{soilCohesion} kPa</span>
              </div>
              <input
                type="range"
                min={4}
                max={45}
                value={soilCohesion}
                onChange={(e) => setSoilCohesion(parseInt(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">
                Internal friction &phi;&apos;: {frictionAngle}° | Weathered shale: &lt;12 kPa
              </span>
            </div>

            {/* Factor 5: Vegetation & Root Cohesion (c_r) */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <Trees className="w-3.5 h-3.5 text-emerald-400" />
                  5. Root Canopy &amp; Cover:
                </span>
                <span className="font-mono font-bold text-emerald-400">{vegCoverage}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={vegCoverage}
                onChange={(e) => setVegCoverage(parseInt(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">
                Root tensile reinforcement: +{((vegCoverage / 100) * 12).toFixed(1)} kPa
              </span>
            </div>

            {/* Factor 6: Slope Morphology & Curvature */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  6. Slope Morphology:
                </span>
                <span className="font-mono font-bold uppercase text-amber-300">{slopeCurvature}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {(['concave', 'planar', 'convex'] as const).map((curv) => (
                  <button
                    key={curv}
                    onClick={() => setSlopeCurvature(curv)}
                    className={`py-1 rounded text-[10px] font-bold capitalize border ${
                      slopeCurvature === curv
                        ? 'bg-amber-950 border-amber-600 text-amber-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {curv}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-500 block">
                {slopeCurvature === 'concave'
                  ? 'Hollow converges groundwater'
                  : slopeCurvature === 'convex'
                  ? 'Spur disperses water'
                  : 'Uniform planar sheet'}
              </span>
            </div>

            {/* Factor 7: Anthropogenic Road-Cut Toe Excavation */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5 text-amber-400" />
                  7. Toe Benching / Road Cuts:
                </span>
                <span className={`font-mono font-bold ${toeExcavation > 50 ? 'text-red-400' : 'text-amber-300'}`}>
                  {toeExcavation}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={toeExcavation}
                onChange={(e) => setToeExcavation(parseInt(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Removes retaining passive earth resistance</span>
            </div>

            {/* Factor 8: Seismic Peak Ground Acceleration (PGA) */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  8. Seismic Ground Motion (PGA):
                </span>
                <span className="font-mono font-bold text-amber-300">{seismicPGA.toFixed(2)} g</span>
              </div>
              <input
                type="range"
                min={0.0}
                max={0.35}
                step={0.01}
                value={seismicPGA}
                onChange={(e) => setSeismicPGA(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">Dynamic inertial coefficient k_s = { (seismicPGA * 0.6).toFixed(2) }</span>
            </div>

            {/* Factor 9: Mountain Ravine (Jhora) Distance */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-300">
                <span className="flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  9. Jhora Ravine Distance:
                </span>
                <span className="font-mono font-bold text-cyan-300">{jhoraDistance} m</span>
              </div>
              <input
                type="range"
                min={5}
                max={500}
                step={5}
                value={jhoraDistance}
                onChange={(e) => setJhoraDistance(parseInt(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">High-velocity drainage channel toe scour</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRIMARY ENGINE OUTPUT DISPLAYS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ENGINE 1: Landslide Risk Engine (Full Geotechnical Mohr-Coulomb Analysis) */}
        {(activeEngineTab === 'both' || activeEngineTab === 'landslide_deep') && (
          <div className={`bg-slate-900 border border-amber-900/60 rounded-2xl p-5 shadow-xl space-y-4 ${
            activeEngineTab === 'landslide_deep' ? 'lg:col-span-2' : ''
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Mountain className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-base text-white">Landslide Risk Engine (Geotechnical)</h3>
                  <p className="text-[11px] text-slate-400">
                    Mohr-Coulomb Failure Envelope &amp; Infinite Slope FoS
                  </p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                  landslideResult.tier === 'critical'
                    ? 'bg-red-600 text-white animate-pulse'
                    : landslideResult.tier === 'severe'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-700 text-white'
                }`}
              >
                {landslideResult.score}% ({landslideResult.tier})
              </span>
            </div>

            {/* Geotechnical Key Indicators Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {/* Factor of Safety */}
              <div className="bg-slate-950 p-3 rounded-xl border border-amber-900/40 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Factor of Safety (FoS)</span>
                <div
                  className={`text-2xl font-black ${
                    landslideResult.factorOfSafety < 1.0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'
                  }`}
                >
                  {landslideResult.factorOfSafety}
                </div>
                <span className="text-[10px] text-slate-500 block">
                  {landslideResult.factorOfSafety < 1.0 ? 'FoS < 1.0: Active Failure' : 'FoS > 1.3: Stable Margin'}
                </span>
              </div>

              {/* Predicted Failure Mechanism */}
              <div className="bg-slate-950 p-3 rounded-xl border border-amber-900/40 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Failure Mechanism</span>
                <div className="text-sm font-black text-amber-300 mt-1 leading-tight">
                  {landslideResult.failureMode}
                </div>
                <span className="text-[10px] text-slate-500 block">Dominant kinematics</span>
              </div>

              {/* Mohr-Coulomb Shear Stress vs Strength */}
              <div className="bg-slate-950 p-3 rounded-xl border border-amber-900/40 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Resisting vs Driving</span>
                <div className="text-base font-black text-white mt-1">
                  <span className="text-emerald-400 font-mono">{landslideResult.criticalShearStrengthKPa}</span>
                  <span className="text-slate-500 text-xs"> / </span>
                  <span className="text-red-400 font-mono">{landslideResult.drivingShearStressKPa}</span>
                  <span className="text-[10px] text-slate-400 ml-1">kPa</span>
                </div>
                <span className="text-[10px] text-slate-500 block">&tau;_resisting / &tau;_driving</span>
              </div>

              {/* Lead-Time to Failure */}
              <div className="bg-slate-950 p-3 rounded-xl border border-amber-900/40 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Lead Time to Collapse</span>
                <div className="text-2xl font-black text-white mt-1">
                  {landslideResult.timeToSlopeFailureHours ? `${landslideResult.timeToSlopeFailureHours} hrs` : 'Stable'}
                </div>
                <span className="text-[10px] text-slate-500 block">I-D trigger exceedance</span>
              </div>
            </div>

            {/* All 9 Landslide Factor Breakdown Progress Bars */}
            <div className="space-y-2 text-xs pt-1">
              <span className="text-slate-300 font-bold block">Comprehensive 9-Factor Geotechnical Breakdown:</span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>1. Slope Gradient &amp; Steepness (20% wt)</span>
                    <span className="font-mono text-amber-300">{landslideResult.factors.slopeSteepness} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${landslideResult.factors.slopeSteepness}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>2. 72h Rainfall &amp; I-D Trigger (18% wt)</span>
                    <span className="font-mono text-amber-300">{landslideResult.factors.cumulativePrecipitation} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${landslideResult.factors.cumulativePrecipitation}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>3. Positive Pore-Water Pressure u (18% wt)</span>
                    <span className="font-mono text-amber-300">{landslideResult.factors.groundPorePressure} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${landslideResult.factors.groundPorePressure}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>4. Lithology Cohesion Vulnerability (10% wt)</span>
                    <span className="font-mono text-amber-300">{landslideResult.factors.soilCohesionAndGeology} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${landslideResult.factors.soilCohesionAndGeology}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>5. Root Cohesion Deficiency (9% wt)</span>
                    <span className="font-mono text-amber-300">{landslideResult.factors.vegetationDeforestation} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${landslideResult.factors.vegetationDeforestation}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>6. Slope Morphology Hollow Index (8% wt)</span>
                    <span className="font-mono text-amber-300">{landslideResult.factors.slopeMorphologyCurvature} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${landslideResult.factors.slopeMorphologyCurvature}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>7. Toe Excavation &amp; Road-Cut (7% wt)</span>
                    <span className="font-mono text-amber-300">{landslideResult.factors.anthropogenicExcavation} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${landslideResult.factors.anthropogenicExcavation}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>8. Seismic Acceleration Load (5% wt)</span>
                    <span className="font-mono text-amber-300">{landslideResult.factors.seismicPeakGroundAcc} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${landslideResult.factors.seismicPeakGroundAcc}%` }} />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>9. Mountain Ravine / Jhora Toe Undercutting (5% wt)</span>
                    <span className="font-mono text-amber-300">{landslideResult.factors.drainageJhoraProximity} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${landslideResult.factors.drainageJhoraProximity}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ENGINE 2: Flood Risk Engine (Full Hydro-Dynamic Inundation & Velocity Analysis) */}
        {(activeEngineTab === 'both' || activeEngineTab === 'flood_deep') && (
          <div className={`bg-slate-900 border border-cyan-900/60 rounded-2xl p-5 shadow-xl space-y-4 ${
            activeEngineTab === 'flood_deep' ? 'lg:col-span-2' : ''
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="font-bold text-base text-white">Flood Risk Engine (Hydro-Dynamic)</h3>
                  <p className="text-[11px] text-slate-400">
                    2D Inundation Depth, Manning Flow Velocity &amp; Dynamic Surge Force
                  </p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                  floodResult.tier === 'critical'
                    ? 'bg-red-600 text-white animate-pulse'
                    : floodResult.tier === 'severe'
                    ? 'bg-amber-600 text-white'
                    : 'bg-cyan-600 text-white'
                }`}
              >
                {floodResult.score}% ({floodResult.tier})
              </span>
            </div>

            {/* Key Hydrodynamic Outputs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {/* Inundation Depth */}
              <div className="bg-slate-950 p-3 rounded-xl border border-cyan-900/40 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Predicted Water Depth</span>
                <div className="text-2xl font-black text-cyan-300 mt-1">{floodResult.predictedInundationDepthCm} cm</div>
                <div className="text-[10px] text-slate-500">Overland surface ponding</div>
              </div>

              {/* Hydrodynamic Flow Velocity */}
              <div className="bg-slate-950 p-3 rounded-xl border border-cyan-900/40 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Manning Flow Velocity</span>
                <div className="text-2xl font-black text-cyan-400 mt-1">
                  {floodResult.flowVelocityMs} <span className="text-xs font-normal text-slate-400">m/s</span>
                </div>
                <div className="text-[10px] text-slate-500">V = (1/n) R^(2/3) S^(1/2)</div>
              </div>

              {/* Dynamic Surge Pressure */}
              <div className="bg-slate-950 p-3 rounded-xl border border-cyan-900/40 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Surge Impact Pressure</span>
                <div className="text-2xl font-black text-white mt-1">
                  {floodResult.hydrostaticPressureKPa} <span className="text-xs font-normal text-slate-400">kPa</span>
                </div>
                <div className="text-[10px] text-slate-500">Structural wall force</div>
              </div>

              {/* Dominant Flood Regime */}
              <div className="bg-slate-950 p-3 rounded-xl border border-cyan-900/40 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Flood Regime</span>
                <div className="text-sm font-black text-cyan-300 mt-1 leading-tight">
                  {floodResult.floodRegime}
                </div>
                <div className="text-[10px] text-slate-500">Kinematic classification</div>
              </div>
            </div>

            {/* Factor Breakdown Progress Bars */}
            <div className="space-y-2 text-xs pt-1">
              <span className="text-slate-300 font-bold block">Hydrological &amp; Hydraulic Factor Breakdown:</span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>1. River Proximity &amp; Barrage Discharge (30% wt)</span>
                    <span className="font-mono text-cyan-300">{floodResult.factors.riverProximityAndLevel} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${floodResult.factors.riverProximityAndLevel}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>2. Precipitation Accumulation &amp; Deluge (25% wt)</span>
                    <span className="font-mono text-cyan-300">{floodResult.factors.rainfallAccumulation} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${floodResult.factors.rainfallAccumulation}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>3. Terrain Elevation &amp; Slope Sink (20% wt)</span>
                    <span className="font-mono text-cyan-300">{floodResult.factors.terrainSlopeAndElevation} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${floodResult.factors.terrainSlopeAndElevation}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>4. Soil Saturation Index (15% wt)</span>
                    <span className="font-mono text-cyan-300">{floodResult.factors.soilSaturation} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${floodResult.factors.soilSaturation}%` }} />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>5. Drainage Obstruction &amp; Silt Clogging (10% wt)</span>
                    <span className="font-mono text-cyan-300">{floodResult.factors.urbanDrainageCapacity} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${floodResult.factors.urbanDrainageCapacity}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
