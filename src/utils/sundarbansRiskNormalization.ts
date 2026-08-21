import { HISTORICAL_DISASTER_BENCHMARKS } from '../data/disasterData';

export type SeasonalTimeline = 'winter' | 'pre-monsoon' | 'monsoon' | 'post-monsoon';

export interface NetworkRiskSnapshot {
  overall: number;
  flood: number;
  landslide: number;
  earthquake: number;
}

export interface AiHazardPrediction {
  timeline?: Array<{ floodTrend?: string; landslideTrend?: string }>;
  criticalBreachRisk?: boolean;
  confidenceScore?: number;
}

const SEASONAL_PROFILES: Record<SeasonalTimeline, { flood: number; landslide: number; earthquake: number }> = {
  winter: { flood: 0.68, landslide: 0.58, earthquake: 1 },
  'pre-monsoon': { flood: 0.94, landslide: 0.72, earthquake: 1 },
  monsoon: { flood: 1.24, landslide: 1.1, earthquake: 1 },
  'post-monsoon': { flood: 0.88, landslide: 0.76, earthquake: 1 },
};

function clamp(score: number): number {
  return Math.round(Math.max(0, Math.min(100, score)));
}

function benchmarkMonth(date: string): number | null {
  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? null : new Date(parsed).getMonth() + 1;
}

function seasonForMonth(month: number): SeasonalTimeline {
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'pre-monsoon';
  if (month <= 9) return 'monsoon';
  return 'post-monsoon';
}

/**
 * The catalog has one explicitly Sundarbans-specific benchmark: Amphan 2020.
 * Other catalog records remain untouched and are not represented as local
 * Sundarbans history. The small Amphan calibration is only applied in its
 * source season (pre-monsoon), making the prototype's provenance explicit.
 */
function sundarbansHistoricalFloodCalibration(season: SeasonalTimeline): number {
  const amphan = HISTORICAL_DISASTER_BENCHMARKS.find((benchmark) => benchmark.id === 'hist-wb-2020-amphan');
  if (!amphan || benchmarkMonth(amphan.date) === null || seasonForMonth(benchmarkMonth(amphan.date)!) !== season) return 0;
  return Math.min(12, Math.round((amphan.max24hRainfallMm / 450) * 10 + (amphan.peakRiverStageM / 10) * 2));
}

function aiForecastAdjustment(prediction?: AiHazardPrediction): { flood: number; landslide: number } {
  // Only structured output from the existing prediction endpoint is used. Its
  // deterministic server fallback has no confidenceScore, so it contributes no
  // fabricated "AI" risk when a live model result is unavailable.
  if (!prediction || typeof prediction.confidenceScore !== 'number') return { flood: 0, landslide: 0 };
  const confidence = Math.max(0, Math.min(1, prediction.confidenceScore));
  const timeline = prediction.timeline || [];
  const floodRising = timeline.some((entry) => /rising|peak|high/i.test(entry.floodTrend || ''));
  const landslideHigh = timeline.some((entry) => /high|active|critical/i.test(entry.landslideTrend || ''));
  return {
    flood: (prediction.criticalBreachRisk ? 8 : floodRising ? 4 : 0) * confidence,
    landslide: (landslideHigh ? 4 : 0) * confidence,
  };
}

/**
 * Presentation-only calibration for the existing risk-engine output. It does
 * not route, mutate graph availability, or create hazard observations. The
 * longitude/latitude term keeps the existing deterministic node data legible
 * as a coastal-delta prototype: southern/eastern nodes receive more tidal
 * exposure while the risk engine remains the primary source of each score.
 */
export function normalizeSundarbansRisk(
  base: NetworkRiskSnapshot,
  coordinates: { lat: number; lon: number },
  season: SeasonalTimeline,
  prediction?: AiHazardPrediction,
): NetworkRiskSnapshot {
  const profile = SEASONAL_PROFILES[season];
  const coastalExposure = Math.max(0, Math.min(1, (22.5 - coordinates.lat) / 0.45)) * 7;
  const easternTidalExposure = Math.max(0, Math.min(1, (coordinates.lon - 88.55) / 0.45)) * 5;
  const historicalFlood = sundarbansHistoricalFloodCalibration(season);
  const ai = aiForecastAdjustment(prediction);

  const flood = clamp(base.flood * profile.flood + coastalExposure + easternTidalExposure + historicalFlood + ai.flood);
  const landslide = clamp(base.landslide * profile.landslide + ai.landslide);
  const earthquake = clamp(base.earthquake * profile.earthquake);

  return {
    flood,
    landslide,
    earthquake,
    overall: clamp(base.overall * 0.55 + flood * 0.35 + landslide * 0.08 + earthquake * 0.02),
  };
}

export function getSeasonalTimeline(stageIndex: number): SeasonalTimeline {
  if (stageIndex === 1) return 'pre-monsoon';
  if (stageIndex === 3) return 'monsoon';
  if (stageIndex === 5) return 'post-monsoon';
  return 'winter';
}

export function seasonalTimelineLabel(season: SeasonalTimeline): string {
  return season === 'pre-monsoon' ? 'Pre-Monsoon' : season === 'post-monsoon' ? 'Post-Monsoon' : `${season[0].toUpperCase()}${season.slice(1)}`;
}
