import React, { useState } from 'react';
import {
  History,
  TrendingUp,
  Calendar,
  DollarSign,
  AlertOctagon,
  BookOpen,
  Award,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { HISTORICAL_DISASTER_BENCHMARKS } from '../data/disasterData';
import { SimulationState } from '../types';

interface HistoricalAnalysisViewProps {
  simState: SimulationState;
}

export const HistoricalAnalysisView: React.FC<HistoricalAnalysisViewProps> = ({ simState }) => {
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<string>(HISTORICAL_DISASTER_BENCHMARKS[0].id);

  const activeBenchmark =
    HISTORICAL_DISASTER_BENCHMARKS.find((b) => b.id === selectedBenchmarkId) ||
    HISTORICAL_DISASTER_BENCHMARKS[0];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 text-slate-100">
      {/* Header */}
      <div className="pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <History className="w-6 h-6 text-amber-400" />
          <h1 className="text-xl sm:text-2xl font-black text-white">HISTORICAL DISASTER BENCHMARKS & LESSONS</h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Comparative Hydro-meteorological Analysis between Current Event and Past Severe Atmospheric Surges
        </p>
      </div>

      {/* Comparison Strip: Current Event vs Historical Benchmark */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Current Active Disaster Profile */}
        <div className="bg-slate-900 border border-cyan-900/60 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Current Live Event</span>
            <span className="px-2 py-0.5 bg-red-950 text-red-300 border border-red-800 rounded text-[10px] font-bold">
              ACTIVE DEFCON 1
            </span>
          </div>

          <div className="text-lg font-bold text-white">{simState.stageName}</div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Rainfall Accumulation</span>
              <strong className="text-base text-cyan-300 font-mono">{simState.accumulatedRainfallMm} mm</strong>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Peak River Stage</span>
              <strong className="text-base text-cyan-300 font-mono">{simState.riverStageM} m</strong>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Evacuated Population</span>
              <strong className="text-base text-white font-mono">{simState.evacuatedCount.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* Selected Historical Benchmark Profile */}
        <div className="bg-slate-900 border border-amber-900/60 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Historical Comparison Benchmark</span>
            <span className="text-xs text-slate-400">{activeBenchmark.date}</span>
          </div>

          <div className="text-lg font-bold text-white">{activeBenchmark.name}</div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Max 24h Rainfall</span>
              <strong className="text-base text-amber-300 font-mono">{activeBenchmark.max24hRainfallMm} mm</strong>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Peak River Stage</span>
              <strong className="text-base text-amber-300 font-mono">{activeBenchmark.peakRiverStageM} m</strong>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Displaced Citizens</span>
              <strong className="text-base text-white font-mono">{activeBenchmark.displacedPopulation.toLocaleString()}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Database Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="font-bold text-sm text-white">Historical Catastrophic Flood & Landslide Catalog</h3>

        <div className="space-y-3">
          {HISTORICAL_DISASTER_BENCHMARKS.map((item) => {
            const isSelected = selectedBenchmarkId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedBenchmarkId(item.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-850 border-amber-500 shadow-md text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-slate-100">{item.name}</h4>
                    <span className="text-xs text-slate-400">{item.date}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span>Rainfall: <strong className="text-amber-300">{item.max24hRainfallMm}mm</strong></span>
                    <span>River Crest: <strong className="text-cyan-300">{item.peakRiverStageM}m</strong></span>
                    <span>Loss: <strong className="text-red-400">{item.totalDamageUSD}</strong></span>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800 text-xs text-slate-300 flex items-start gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-amber-300 font-semibold">Key Takeaway:</strong> {item.keyLessons}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
