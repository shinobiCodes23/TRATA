export type HazardSeverity = 'low' | 'moderate' | 'high' | 'severe' | 'critical';

export type IncidentCategory =
  | 'flash_flood'
  | 'landslide'
  | 'road_blocked'
  | 'trapped_civilians'
  | 'power_outage'
  | 'bridge_damaged'
  | 'mudslide'
  | 'drainage_clogged';

export type IncidentStatus = 'pending' | 'verified' | 'dispatched' | 'in_progress' | 'resolved';

export type ResponsePriorityTier = 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MODERATE' | 'P4_LOW';

export interface GeoLocation {
  lat: number;
  lng: number;
  address?: string;
  elevation?: number; // meters above sea level
  slopeAngle?: number; // degrees
  distanceToRiver?: number; // meters
  // Comprehensive Geotechnical & Landslide Factors
  slopeCurvature?: 'concave' | 'planar' | 'convex';
  soilCohesionKPa?: number; // Effective soil cohesion c' (5 - 45 kPa)
  frictionAngleDeg?: number; // Internal friction angle phi' (20 - 45 deg)
  vegetationCoveragePercent?: number; // Canopy & root density (0 - 100%)
  toeExcavationSeverityPercent?: number; // Road-cut toe removal / human excavation (0 - 100%)
  distanceToJhoraM?: number; // Proximity to mountain drainage stream / ravine (meters)
  seismicPGAG?: number; // Peak Ground Acceleration in g (0 - 0.5g)
  rockWeatheringGrade?: 'fresh' | 'moderately_weathered' | 'highly_weathered' | 'completely_decomposed';
  // Comprehensive Hydro-Dynamic & Flood Factors
  urbanDrainageObstructionPercent?: number; // Silt / debris culvert blockage (0 - 100%)
  upstreamDischargeCumecs?: number; // Dam / barrage release discharge in m³/s (0 - 20,000)
  stormSurgeTidalCrestM?: number; // Coastal high tide / storm surge anomaly in meters (0 - 8m)
  manningsRoughnessCoeff?: number; // Surface hydraulic roughness n (0.013 - 0.080)
}

export interface CitizenReport {
  id: string;
  title: string;
  category: IncidentCategory;
  description: string;
  location: GeoLocation;
  reportedAt: string;
  reporterName: string;
  contactNumber?: string;
  trappedCount: number;
  waterDepthCm?: number;
  debrisHeightM?: number;
  imageUrl?: string;
  severity: HazardSeverity;
  status: IncidentStatus;
  priorityTier: ResponsePriorityTier;
  priorityScore: number; // 0 to 100
  assignedUnitId?: string;
  aiVerification?: {
    verified: boolean;
    confidence: number;
    hazardKeywords: string[];
    urgencyReasoning: string;
  };
}

export interface IoTSensor {
  id: string;
  name: string;
  type: 'river_gauge' | 'piezometer' | 'rain_gauge' | 'inclinometer' | 'seismic_node' | 'soil_moisture';
  location: GeoLocation;
  currentValue: number;
  unit: string;
  normalThreshold: number;
  warningThreshold: number;
  criticalThreshold: number;
  status: 'normal' | 'warning' | 'critical' | 'offline';
  lastUpdated: string;
  history: { timestamp: string; value: number }[];
  batteryPercent: number;
  isFutureSensor?: boolean;
}

export interface HazardZone {
  id: string;
  name: string;
  type: 'flood' | 'landslide' | 'compound';
  polygon: [number, number][]; // lat, lng pairs
  riskScore: number; // 0 - 100
  riskTier: HazardSeverity;
  populationAtRisk: number;
  vulnerableStructures: number;
  primaryCause: string;
  evacuationStatus: 'none' | 'advisory' | 'mandatory' | 'completed';
  waterLevelCurrentM?: number;
  waterLevelMaxPredictedM?: number;
  slopeStabilityFactor?: number; // Factor of safety (FoS)
}

export interface RiskSummary {
  areasUnderThreat: number;
  criticallyAffected: number;
  citizensUnderWarning: number;
}

export interface Shelter {
  id: string;
  name: string;
  location: GeoLocation;
  capacityTotal?: number;
  capacityCurrent?: number;
  isOpen?: boolean;
  elevationM?: number;
  isFloodSafe?: boolean;
  contactNumber?: string;
  facilities?: {
    medicalUnit?: boolean;
    backupPower?: boolean;
    wheelchairAccessible?: boolean;
    petFriendly?: boolean;
    foodSuppliesDays?: number;
    cleanWaterAvailable?: boolean;
  };
}

export interface RescueUnit {
  id: string;
  name: string;
  type: 'swiftwater_rescue' | 'drone_recon' | 'medical_ambulance' | 'heavy_excavator' | 'evacuation_bus' | 'helicopter';
  status: 'available' | 'en_route' | 'on_scene' | 'returning' | 'maintenance';
  location: GeoLocation;
  assignedIncidentId?: string;
  personnelCount: number;
  etaMinutes?: number;
}

export interface EmergencyAlert {
  id: string;
  headline: string;
  hazardType: 'Flood' | 'Landslide' | 'Compound' | 'Evacuation';
  severity: 'Advisory' | 'Watch' | 'Warning' | 'Emergency';
  affectedAreas: string[];
  issuedAt: string;
  expiresAt: string;
  instruction: string;
  channel: ('SMS' | 'EAS_BROADCAST' | 'SIREN' | 'APP_PUSH')[];
  active: boolean;
}

export interface SimulationState {
  stage: number; // 0: Normal, 1: Watch, 2: Saturated, 3: Flash Flood Peak, 4: Landslide Trigger, 5: Recovery
  stageName: string;
  timeElapsedHours: number;
  rainfallRateMmH: number;
  accumulatedRainfallMm: number;
  riverStageM: number;
  soilSaturationPercent: number;
  groundPorePressureKPa: number;
  activeDisasterCount: number;
  evacuatedCount: number;
}

export interface RiskAnalysisResult {
  location: GeoLocation;
  compositeRiskScore: number; // 0 - 100
  compositeRiskTier: HazardSeverity;
  floodRisk: {
    score: number; // 0 - 100
    tier: HazardSeverity;
    factors: {
      rainfallAccumulation: number;
      riverProximityAndLevel: number;
      terrainSlopeAndElevation: number;
      soilSaturation: number;
      urbanDrainageCapacity: number;
    };
    predictedInundationDepthCm: number;
    estimatedTimeToFloodMinutes: number | null;
    flowVelocityMs?: number;
    hydrostaticPressureKPa?: number;
    floodRegime?: 'Flash Torrent Inundation' | 'Riverine Confluence Overbank' | 'Estuary Storm Surge Overtopping' | 'Urban Waterlogging' | 'Safe High Ground';
  };
  landslideRisk: {
    score: number; // 0 - 100
    tier: HazardSeverity;
    factors: {
      slopeSteepness: number; // 0 - 100
      cumulativePrecipitation: number; // 0 - 100
      soilCohesionAndGeology: number; // 0 - 100
      vegetationDeforestation: number; // 0 - 100
      groundPorePressure: number; // 0 - 100
      slopeMorphologyCurvature: number; // 0 - 100
      anthropogenicExcavation: number; // 0 - 100
      seismicPeakGroundAcc: number; // 0 - 100
      drainageJhoraProximity: number; // 0 - 100
    };
    factorOfSafety: number; // FoS < 1.0 indicates failure
    timeToSlopeFailureHours: number | null;
    failureMode: 'Debris Flow / Mudflow' | 'Translational Planar Slide' | 'Rotational Slump' | 'Rockfall / Topple' | 'Stable Slope';
    criticalShearStrengthKPa: number;
    drivingShearStressKPa: number;
    rainfallIntensityTriggerMmH: number;
  };
  nearestShelter: Shelter | null;
  distanceToShelterKm: number | null;
  actionableRecommendations: string[];
}

export interface RegionProfile {
  id: string;
  name: string;
  subname: string;
  state: string;
  country: string;
  center: [number, number];
  zoom: number;
  description: string;
  authorityName: string;
  helpline: string;
}
