import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  CheckCircle,
  ArrowRight,
  ShieldAlert,
  Droplets,
  Mountain,
  Smartphone,
  Camera,
  LayoutDashboard,
  Target,
  Wrench,
  Radio,
  Layers,
} from 'lucide-react';
import { SimulationState } from '../types';
import { INITIAL_SIMULATION_STAGES } from '../data/disasterData';

interface DigitalTwinSimulatorProps {
  currentStageIndex: number;
  onSetStageIndex: (index: number) => void;
  onNavigateTab: (tab: string) => void;
}

export const DigitalTwinSimulator: React.FC<DigitalTwinSimulatorProps> = ({
  currentStageIndex,
  onSetStageIndex,
  onNavigateTab,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeStoryStep, setActiveStoryStep] = useState<number>(0);

  const stage = INITIAL_SIMULATION_STAGES[currentStageIndex] || INITIAL_SIMULATION_STAGES[0];

  // Auto-play timer for simulation stages
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        onSetStageIndex((currentStageIndex + 1) % INITIAL_SIMULATION_STAGES.length);
      }, 4500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentStageIndex, onSetStageIndex]);

  // MVP Main Story sequence defined by user
  const storySteps = [
    {
      step: 1,
      icon: '🌧️',
      title: 'Disaster Developing',
      desc: 'Atmospheric river brings heavy torrential downpours. Precipitation accumulation reaches 245mm with rainfall rate exceeding 80mm/hr.',
      targetTab: 'map',
      tag: 'Stage 1-4',
    },
    {
      step: 2,
      icon: '🧠',
      title: 'System Calculates Risk',
      desc: 'Flood & Landslide Risk Engines continuously process catchment hydrology, soil moisture, and slope gradient stability in real time.',
      targetTab: 'risk-engine',
      tag: 'Algorithms',
    },
    {
      step: 3,
      icon: '🗺️',
      title: 'Vulnerable Areas Identified',
      desc: 'GIS hazard polygons dynamically highlight Lower River Confluence (Flood Critical) and North Ridge Escarpment (Landslide Failure).',
      targetTab: 'map',
      tag: 'GIS Mapping',
    },
    {
      step: 4,
      icon: '📱',
      title: 'Citizens Receive Location Info',
      desc: 'Citizens scan micro-coordinates, receive localized inundation depth predictions, safety checklists, and safe shelter corridors.',
      targetTab: 'citizen',
      tag: 'Citizen App',
    },
    {
      step: 5,
      icon: '📸',
      title: 'Citizens Report Real Hazards',
      desc: 'Citizens take field photos of trapped neighbors, road washouts, and submerged vehicles with GPS verification.',
      targetTab: 'citizen',
      tag: 'Field Reports',
    },
    {
      step: 6,
      icon: '🏛️',
      title: 'Authority Sees Unified Dashboard',
      desc: 'Incident Commanders view live telemetry streams, verified incident queues, rescue fleet locations, and mass alerting tools.',
      targetTab: 'authority',
      tag: 'Command Center',
    },
    {
      step: 7,
      icon: '🎯',
      title: 'System Ranks Response Priority',
      desc: 'Algorithmic multi-factor ranking elevates P1 rooftop rescues with trapped lives above standard road debris clearing.',
      targetTab: 'authority',
      tag: 'Smart Triage',
    },
    {
      step: 8,
      icon: '🔧',
      title: 'IoT Sensors Improve Prediction',
      desc: 'Ultrasonic river gauges, piezometers, and acoustic sensors provide continuous feedback loops, expanding lead warning time.',
      targetTab: 'iot',
      tag: 'IoT Telemetry',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-6 h-6 text-amber-400" />
            <h1 className="text-xl sm:text-2xl font-black text-white">DIGITAL TWIN & DISASTER LIFECYCLE</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            End-to-End Simulation of Atmospheric Inundation, Risk Calculation, Citizen Action, & Response Prioritization
          </p>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              isPlaying ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause Sim' : 'Auto Play'}</span>
          </button>

          <button
            onClick={() => onSetStageIndex(0)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Reset to Stage 1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Timeline Stage Scrubber */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Disaster Timeline Stages:</span>
          <span className="text-xs font-mono font-bold text-amber-400">{stage.stageName}</span>
        </div>

        {/* Stages Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          {INITIAL_SIMULATION_STAGES.map((s, idx) => (
            <button
              key={s.stage}
              onClick={() => onSetStageIndex(idx)}
              className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                currentStageIndex === idx
                  ? 'bg-gradient-to-br from-amber-600 to-red-600 text-white border-white shadow-lg font-bold scale-[1.02]'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="text-[10px] uppercase font-bold opacity-80">Hour +{s.timeElapsedHours}</div>
              <div className="font-semibold text-[11px] truncate mt-0.5">{s.stageName.split(':')[1] || s.stageName}</div>
              <div className="text-[10px] mt-1 opacity-90">
                🌊 {s.riverStageM}m • 🌧️ {s.rainfallRateMmH}mm/h
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* MVP 8-Step Story Sequence Flow */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="font-bold text-base text-white">Disaster Intelligence Lifecycle Flow</h2>
            <p className="text-xs text-slate-400">Click any step to inspect the corresponding live application module</p>
          </div>
          <span className="px-2.5 py-1 bg-amber-950 text-amber-300 border border-amber-800 rounded text-[11px] font-bold">
            8-Step Story Model
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {storySteps.map((item, idx) => {
            const isSelected = activeStoryStep === idx;
            return (
              <div
                key={item.step}
                onClick={() => {
                  setActiveStoryStep(idx);
                  onNavigateTab(item.targetTab);
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${
                  isSelected
                    ? 'bg-gradient-to-b from-slate-800 to-slate-900 border-amber-500 shadow-lg text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    Step {item.step}
                  </span>
                </div>
                <div className="font-bold text-sm text-slate-100 mt-2">{item.title}</div>
                <p className="text-xs text-slate-400 mt-1 line-clamp-3 leading-relaxed">{item.desc}</p>
                <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-amber-400 font-semibold">
                  <span>Open {item.targetTab.toUpperCase()}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Digital Twin 2D/3D Hydraulic Cross-Section Elevation Graphic */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Digital Twin Terrain & Hydrologic Water-Table Model</h3>
              <p className="text-[11px] text-slate-400">Elevation Profile cross-section showing flood inundation & slope shear plane</p>
            </div>
          </div>
          <span className="text-xs font-mono text-cyan-300">STAGE {currentStageIndex + 1} LIVE CUT</span>
        </div>

        {/* SVG Graphic Profile */}
        <div className="relative w-full h-64 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden p-4">
          <svg className="w-full h-full" viewBox="0 0 800 240" preserveAspectRatio="none">
            <defs>
              <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
              <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="terrainGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
              <linearGradient id="shearGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#b91c1c" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* Background Sky */}
            <rect width="800" height="240" fill="url(#skyGrad)" />

            {/* Rain simulation lines */}
            {stage.rainfallRateMmH > 20 && (
              <g stroke="#38bdf8" strokeWidth="1" opacity="0.3" strokeDasharray="3, 10">
                <line x1="50" y1="0" x2="40" y2="240" />
                <line x1="150" y1="0" x2="140" y2="240" />
                <line x1="250" y1="0" x2="240" y2="240" />
                <line x1="350" y1="0" x2="340" y2="240" />
                <line x1="450" y1="0" x2="440" y2="240" />
                <line x1="550" y1="0" x2="540" y2="240" />
                <line x1="650" y1="0" x2="640" y2="240" />
                <line x1="750" y1="0" x2="740" y2="240" />
              </g>
            )}

            {/* Terrain Profile: Left Flat Basin (Flood Area) -> Middle River Channel -> Right Steep North Ridge (Landslide) */}
            <path
              d="M 0 170 Q 150 170, 260 210 Q 320 230, 380 210 Q 480 160, 600 70 L 800 30 L 800 240 L 0 240 Z"
              fill="url(#terrainGrad)"
              stroke="#475569"
              strokeWidth="2"
            />

            {/* Dynamic Water Level (River Channel + Inundation) */}
            {/* Water height scales with stage.riverStageM */}
            {(() => {
              const waterY = Math.max(140, 220 - stage.riverStageM * 10);
              return (
                <path
                  d={`M 140 170 Q 250 ${waterY}, 320 ${waterY} Q 380 ${waterY}, 440 175 L 440 240 L 140 240 Z`}
                  fill="url(#waterGrad)"
                />
              );
            })()}

            {/* Landslide Shear Plane Highlight on Steep Ridge (x: 550 to 750) */}
            {stage.groundPorePressureKPa > 30 && (
              <path
                d="M 580 85 Q 640 100, 720 50 L 730 65 Q 640 120, 570 105 Z"
                fill="url(#shearGrad)"
                stroke="#f87171"
                strokeWidth="1.5"
                strokeDasharray="4, 4"
              />
            )}

            {/* Labels in SVG */}
            <text x="30" y="160" fill="#94a3b8" fontSize="11" fontWeight="bold">
              Lower River Floodplain (18m)
            </text>
            <text x="280" y="195" fill="#38bdf8" fontSize="11" fontWeight="bold">
              River Mainstem ({stage.riverStageM}m)
            </text>
            <text x="610" y="45" fill="#f59e0b" fontSize="11" fontWeight="bold">
              North Ridge Escarpment (160m, 38° Slope)
            </text>
            {stage.groundPorePressureKPa > 35 && (
              <text x="590" y="130" fill="#ef4444" fontSize="10" fontWeight="bold">
                ⚠️ Critical Shear Failure (Pore Press: {stage.groundPorePressureKPa} kPa)
              </text>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};
