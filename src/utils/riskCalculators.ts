import { CitizenReport, GeoLocation, HazardSeverity, HazardZone, IoTSensor, ResponsePriorityTier, RiskAnalysisResult, Shelter, SimulationState } from '../types';

/**
 * Calculates the Flood Risk Score (0 - 100) based on hydrological factors:
 * - Current rainfall accumulation & intensity (mm/hr)
 * - River stage and proximity to river channel
 * - Elevation & Topographic Wetness Index (TWI) / Slope
 * - Antecedent Soil Moisture / Saturation (%)
 * - Drainage / Infiltration capacity
 */
export function calculateFloodRisk(
  location: GeoLocation,
  simState: SimulationState,
  nearbySensors: IoTSensor[] = []
): {
  score: number;
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
  flowVelocityMs: number;
  hydrostaticPressureKPa: number;
  floodRegime: 'Flash Torrent Inundation' | 'Riverine Confluence Overbank' | 'Estuary Storm Surge Overtopping' | 'Urban Waterlogging' | 'Safe High Ground';
} {
  const elevation = location.elevation ?? 25; // meters
  const slope = location.slopeAngle ?? 3; // degrees
  const distRiver = location.distanceToRiver ?? 450; // meters
  const drainageObstruction = location.urbanDrainageObstructionPercent ?? (simState.stage >= 3 ? 65 : 25);
  const upstreamDischarge = location.upstreamDischargeCumecs ?? (simState.riverStageM * 850);
  const stormSurgeCrest = location.stormSurgeTidalCrestM ?? (elevation < 10 ? 2.8 : 0);
  const manningsN = location.manningsRoughnessCoeff ?? 0.035;

  // Factor 1: Rainfall (Weight 25%)
  // Heavy rain threshold: 50mm/hr, total > 150mm
  const rainAccumFactor = Math.min(100, (simState.accumulatedRainfallMm / 200) * 55 + (simState.rainfallRateMmH / 60) * 45);

  // Factor 2: River Proximity, Channel Stage & Upstream Barrage Discharge (Weight 30%)
  const riverSensors = nearbySensors.filter((s) => s.type === 'river_gauge');
  const riverLevel = riverSensors.length > 0 ? Math.max(...riverSensors.map((s) => s.currentValue)) : simState.riverStageM;
  const riverStageRatio = Math.min(1.8, Math.max(0, riverLevel / 5.5));
  const proximityMultiplier = Math.max(0, 1 - distRiver / 1200);
  const dischargeFactor = Math.min(30, (upstreamDischarge / 8000) * 30);
  const surgeFactor = Math.min(35, (stormSurgeCrest / 4.0) * 35);
  const riverFactor = Math.min(
    100,
    riverStageRatio * 65 * proximityMultiplier + (riverStageRatio > 0.9 ? 20 : 0) + dischargeFactor * 0.4 + surgeFactor * (elevation < 15 ? 0.6 : 0)
  );

  // Factor 3: Terrain Slope & Elevation (Weight 20%)
  // Lower elevations (< 20m) and flatter slopes (< 4 deg) accumulate water
  const elevationVulnerability = Math.max(0, 100 - elevation * 2.2);
  const slopeAccumulation = Math.max(0, 100 - slope * 10);
  const terrainFactor = Math.min(100, elevationVulnerability * 0.6 + slopeAccumulation * 0.4);

  // Factor 4: Soil Saturation Index (Weight 15%)
  const soilSaturationFactor = simState.soilSaturationPercent;

  // Factor 5: Drainage Capacity Deficiency & Silt Clogging (Weight 10%)
  const baseDrainageDeficit = simState.accumulatedRainfallMm > 80 ? 60 + simState.stage * 6 : 20;
  const drainageFactor = Math.min(100, baseDrainageDeficit * 0.5 + drainageObstruction * 0.5);

  // Weighted Composite
  const rawScore =
    rainAccumFactor * 0.25 +
    riverFactor * 0.3 +
    terrainFactor * 0.2 +
    soilSaturationFactor * 0.15 +
    drainageFactor * 0.1;

  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  let tier: HazardSeverity = 'low';
  if (score >= 80) tier = 'critical';
  else if (score >= 65) tier = 'severe';
  else if (score >= 45) tier = 'high';
  else if (score >= 25) tier = 'moderate';

  // Inundation prediction in cm
  const baseDepthCm = Math.max(
    0,
    (score - 25) * 2.2 * Math.max(0.15, 1 - elevation / 65) +
      (riverLevel > 5.0 && distRiver < 200 ? (riverLevel - 5.0) * 60 : 0) +
      (stormSurgeCrest > 2.0 && elevation < 10 ? stormSurgeCrest * 35 : 0)
  );
  const predictedInundationDepthCm = Math.round(baseDepthCm);

  // Hydrodynamic Flow Velocity (V) via Manning's formula: V = (1/n) * R^(2/3) * S^(1/2)
  const hydraulicRadiusR = Math.max(0.05, predictedInundationDepthCm / 100);
  const hydraulicSlopeS = Math.max(0.001, Math.tan((slope * Math.PI) / 180));
  const calculatedVelocity = (1 / Math.max(0.015, manningsN)) * Math.pow(hydraulicRadiusR, 2 / 3) * Math.pow(hydraulicSlopeS, 1 / 2);
  const flowVelocityMs = Number(Math.min(6.5, Math.max(0.1, calculatedVelocity)).toFixed(2));

  // Hydrostatic & Dynamic Surge Pressure (P = 0.5 * rho * g * h^2 + rho * V^2 * h) in kPa
  const depthM = predictedInundationDepthCm / 100;
  const hydrostaticPressureKPa = Number(((0.5 * 1000 * 9.81 * Math.pow(depthM, 2) + 1000 * Math.pow(flowVelocityMs, 2) * depthM * 0.3) / 1000).toFixed(2));

  const estimatedTimeToFloodMinutes =
    score > 35 ? Math.max(5, Math.round((100 - score) * 1.4)) : null;

  // Classify dominant flood regime
  let floodRegime: 'Flash Torrent Inundation' | 'Riverine Confluence Overbank' | 'Estuary Storm Surge Overtopping' | 'Urban Waterlogging' | 'Safe High Ground' = 'Safe High Ground';
  if (score < 25) {
    floodRegime = 'Safe High Ground';
  } else if (elevation < 12 && stormSurgeCrest > 2.0) {
    floodRegime = 'Estuary Storm Surge Overtopping';
  } else if (slope > 15 && flowVelocityMs > 2.0) {
    floodRegime = 'Flash Torrent Inundation';
  } else if (distRiver < 250 || riverStageRatio > 0.9) {
    floodRegime = 'Riverine Confluence Overbank';
  } else {
    floodRegime = 'Urban Waterlogging';
  }

  return {
    score,
    tier,
    factors: {
      rainfallAccumulation: Math.round(rainAccumFactor),
      riverProximityAndLevel: Math.round(riverFactor),
      terrainSlopeAndElevation: Math.round(terrainFactor),
      soilSaturation: Math.round(soilSaturationFactor),
      urbanDrainageCapacity: Math.round(drainageFactor),
    },
    predictedInundationDepthCm,
    estimatedTimeToFloodMinutes,
    flowVelocityMs,
    hydrostaticPressureKPa,
    floodRegime,
  };
}

/**
 * Calculates the Comprehensive Landslide Risk Score (0 - 100) and Geotechnical Factor of Safety (FoS):
 * 1. Slope angle gradient (critical angle > 28°)
 * 2. 72h cumulative precipitation vs empirical I-D (Intensity-Duration) threshold
 * 3. Positive pore water pressure (u) in shear failure plane
 * 4. Geological lithology & rock shear cohesion (c')
 * 5. Vegetation root tensile reinforcement (c_r) & deforestation index
 * 6. Slope morphology & profile/plan curvature (concave water-accumulating hollows)
 * 7. Anthropogenic excavation & road-cut toe benching (e.g. NH-10 highway cuts)
 * 8. Dynamic seismic Peak Ground Acceleration (PGA) & micro-tremor loading
 * 9. Proximity to mountain ravines & ephemeral water channels (jhoras)
 */
export function calculateLandslideRisk(
  location: GeoLocation,
  simState: SimulationState,
  nearbySensors: IoTSensor[] = []
): {
  score: number;
  tier: HazardSeverity;
  factors: {
    slopeSteepness: number;
    cumulativePrecipitation: number;
    soilCohesionAndGeology: number;
    vegetationDeforestation: number;
    groundPorePressure: number;
    slopeMorphologyCurvature: number;
    anthropogenicExcavation: number;
    seismicPeakGroundAcc: number;
    drainageJhoraProximity: number;
  };
  factorOfSafety: number;
  timeToSlopeFailureHours: number | null;
  failureMode: 'Debris Flow / Mudflow' | 'Translational Planar Slide' | 'Rotational Slump' | 'Rockfall / Topple' | 'Stable Slope';
  criticalShearStrengthKPa: number;
  drivingShearStressKPa: number;
  rainfallIntensityTriggerMmH: number;
} {
  const slope = location.slopeAngle ?? 28; // degrees
  const elevation = location.elevation ?? 85;
  const curvature = location.slopeCurvature ?? 'concave';
  const soilCohesion = location.soilCohesionKPa ?? (elevation > 120 ? 12 : 22); // kPa
  const frictionAngle = location.frictionAngleDeg ?? 31; // degrees
  const vegCoverage = location.vegetationCoveragePercent ?? (slope > 35 ? 40 : 65); // %
  const toeExcavation = location.toeExcavationSeverityPercent ?? (elevation > 100 ? 55 : 20); // %
  const jhoraDistance = location.distanceToJhoraM ?? (elevation > 50 ? 45 : 350); // meters
  const seismicPGA = location.seismicPGAG ?? 0.05; // g

  // 1. Slope Gradient Factor (Weight 20%)
  let slopeFactor = 0;
  if (slope < 12) slopeFactor = 5;
  else if (slope < 22) slopeFactor = 28;
  else if (slope < 32) slopeFactor = 68;
  else if (slope < 45) slopeFactor = 96;
  else slopeFactor = 88; // rock faces shed quickly

  // 2. Cumulative 72h Precipitation & Dynamic Trigger Intensity (Weight 18%)
  const rainAccum = simState.accumulatedRainfallMm;
  const rainRate = simState.rainfallRateMmH;
  const rainFactor = Math.min(100, (rainAccum / 190) * 65 + (rainRate / 60) * 35);

  // 3. Ground Pore-Water Pressure & Soil Saturation (Weight 18%)
  const piezometerSensors = nearbySensors.filter((s) => s.type === 'piezometer');
  const porePressureKPa =
    piezometerSensors.length > 0
      ? Math.max(...piezometerSensors.map((s) => s.currentValue))
      : simState.groundPorePressureKPa;
  const porePressureFactor = Math.min(100, (porePressureKPa / 42) * 100);

  // 4. Geological Lithology & Soil Cohesion (Weight 10%)
  // Lower cohesion c' yields higher vulnerability
  const geologyFactor = Math.max(10, Math.min(100, Math.round(100 - (soilCohesion / 35) * 80)));

  // 5. Vegetation Root Anchorage & Deforestation (Weight 9%)
  // Lower vegetation cover increases erosion and destabilizes the root reinforcement matrix
  const vegetationFactor = Math.max(10, Math.min(100, Math.round(100 - vegCoverage)));

  // 6. Slope Morphology & Plan/Profile Curvature (Weight 8%)
  // Concave hollows concentrate groundwater flow lines; convex spurs disperse them
  let curvatureFactor = 50;
  if (curvature === 'concave') curvatureFactor = 90;
  else if (curvature === 'planar') curvatureFactor = 55;
  else if (curvature === 'convex') curvatureFactor = 25;

  // 7. Anthropogenic Toe Excavation & Road-Cut Benching (Weight 7%)
  const excavationFactor = Math.min(100, Math.max(0, toeExcavation));

  // 8. Seismic Peak Ground Acceleration (PGA) (Weight 5%)
  const seismicFactor = Math.min(100, Math.round((seismicPGA / 0.25) * 100));

  // 9. Mountain Ravine / Jhora Proximity (Weight 5%)
  // Proximity to high-velocity mountain drainage gullies causes severe toe scouring
  const jhoraFactor = Math.max(5, Math.min(100, Math.round(100 - (jhoraDistance / 400) * 90)));

  // Weighted Composite Landslide Vulnerability Score (0 - 100)
  const rawScore =
    slopeFactor * 0.20 +
    rainFactor * 0.18 +
    porePressureFactor * 0.18 +
    geologyFactor * 0.10 +
    vegetationFactor * 0.09 +
    curvatureFactor * 0.08 +
    excavationFactor * 0.07 +
    seismicFactor * 0.05 +
    jhoraFactor * 0.05;

  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Geotechnical Infinite Slope Stability Equation with Mohr-Coulomb Shear Strength:
  // FoS = Resisting Shear Strength / Driving Shear Stress
  // Resisting = c' + c_root + (gamma_sat * z * cos^2(beta) - u) * tan(phi')
  // Driving = gamma_sat * z * sin(beta) * cos(beta) + (k_seismic * gamma_sat * z) + tau_anthro
  const rad = Math.PI / 180;
  const slopeRad = Math.max(0.12, slope * rad);
  const frictionRad = frictionAngle * rad;
  const gammaSat = 19.5; // kN/m^3 unit weight of saturated colluvial soil
  const depthZ = 2.4; // meters depth of potential slip surface

  // Root apparent cohesion (c_root): deep tree root network provides up to 14 kPa tensile strength
  const cRootKPa = (vegCoverage / 100) * 12.0;
  const effectiveCohesion = soilCohesion + cRootKPa;

  // Normal total stress at slip surface: sigma = gamma_sat * z * cos^2(beta)
  const totalNormalStress = gammaSat * depthZ * Math.pow(Math.cos(slopeRad), 2);
  const effectiveNormalStress = Math.max(1.5, totalNormalStress - porePressureKPa);

  // Resisting Mohr-Coulomb shear strength (kPa)
  const criticalShearStrengthKPa = parseFloat(
    (effectiveCohesion + effectiveNormalStress * Math.tan(frictionRad)).toFixed(1)
  );

  // Gravitational driving shear stress + seismic inertia + anthropogenic toe unloading
  const gravitationalDrivingStress = gammaSat * depthZ * Math.sin(slopeRad) * Math.cos(slopeRad);
  const seismicInertialStress = (seismicPGA * 0.6) * gammaSat * depthZ;
  const toeDestabilizationStress = (toeExcavation / 100) * 6.5;

  const drivingShearStressKPa = parseFloat(
    (gravitationalDrivingStress + seismicInertialStress + toeDestabilizationStress).toFixed(1)
  );

  // Factor of Safety (FoS)
  let rawFoS = criticalShearStrengthKPa / Math.max(1.0, drivingShearStressKPa);
  // Curvature penalty: concave convergence concentrates pore water
  if (curvature === 'concave') rawFoS *= 0.88;
  const factorOfSafety = Math.max(0.35, Math.min(2.85, parseFloat(rawFoS.toFixed(2))));

  // Critical rainfall intensity threshold (mm/h) based on GSI / Caine empirical I-D relationship
  // I = alpha * D^(-beta)
  const durationHours = 24;
  const rainfallIntensityTriggerMmH = Math.round(
    Math.max(15, (38 * Math.pow(durationHours, -0.35) * (factorOfSafety / 1.2)))
  );

  // Determine Landslide Hazard Tier
  let tier: HazardSeverity = 'low';
  if (score >= 78 || factorOfSafety < 1.0) tier = 'critical';
  else if (score >= 62 || factorOfSafety < 1.15) tier = 'severe';
  else if (score >= 42 || factorOfSafety < 1.35) tier = 'high';
  else if (score >= 22) tier = 'moderate';

  // Determine Landslide Failure Mechanism
  let failureMode: 'Debris Flow / Mudflow' | 'Translational Planar Slide' | 'Rotational Slump' | 'Rockfall / Topple' | 'Stable Slope';
  if (factorOfSafety > 1.35 && score < 40) {
    failureMode = 'Stable Slope';
  } else if (slope > 45 && soilCohesion < 15) {
    failureMode = 'Rockfall / Topple';
  } else if (simState.soilSaturationPercent > 82 && porePressureKPa > 32 && slope >= 24) {
    failureMode = 'Debris Flow / Mudflow';
  } else if (toeExcavation > 45 || curvature === 'concave') {
    failureMode = 'Rotational Slump';
  } else {
    failureMode = 'Translational Planar Slide';
  }

  // Calculate estimated lead-time to slope failure (hours)
  const timeToSlopeFailureHours =
    factorOfSafety < 1.15
      ? Math.max(0.3, parseFloat(((factorOfSafety - 0.85) * 6.5).toFixed(1)))
      : null;

  return {
    score,
    tier,
    factors: {
      slopeSteepness: Math.round(slopeFactor),
      cumulativePrecipitation: Math.round(rainFactor),
      soilCohesionAndGeology: Math.round(geologyFactor),
      vegetationDeforestation: Math.round(vegetationFactor),
      groundPorePressure: Math.round(porePressureFactor),
      slopeMorphologyCurvature: Math.round(curvatureFactor),
      anthropogenicExcavation: Math.round(excavationFactor),
      seismicPeakGroundAcc: Math.round(seismicFactor),
      drainageJhoraProximity: Math.round(jhoraFactor),
    },
    factorOfSafety,
    timeToSlopeFailureHours,
    failureMode,
    criticalShearStrengthKPa,
    drivingShearStressKPa,
    rainfallIntensityTriggerMmH,
  };
}

/**
 * Calculates straight-line and road-approximated distance in Kilometers using Haversine formula
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

/**
 * Comprehensive Location-Based Risk Assessment
 */
export function assessLocationRisk(
  location: GeoLocation,
  simState: SimulationState,
  sensors: IoTSensor[] = [],
  shelters: Shelter[] = []
): RiskAnalysisResult {
  const floodRisk = calculateFloodRisk(location, simState, sensors);
  const landslideRisk = calculateLandslideRisk(location, simState, sensors);

  // Composite multi-hazard score
  // If location has high slope -> landslide dominant, if low elevation -> flood dominant
  const slope = location.slopeAngle ?? 10;
  const isHighland = slope > 15 || (location.elevation ?? 20) > 40;

  const compositeRiskScore = Math.round(
    isHighland
      ? landslideRisk.score * 0.7 + floodRisk.score * 0.3
      : floodRisk.score * 0.75 + landslideRisk.score * 0.25
  );

  let compositeRiskTier: HazardSeverity = 'low';
  if (compositeRiskScore >= 80 || floodRisk.tier === 'critical' || landslideRisk.tier === 'critical') {
    compositeRiskTier = 'critical';
  } else if (compositeRiskScore >= 65 || floodRisk.tier === 'severe' || landslideRisk.tier === 'severe') {
    compositeRiskTier = 'severe';
  } else if (compositeRiskScore >= 45) {
    compositeRiskTier = 'high';
  } else if (compositeRiskScore >= 25) {
    compositeRiskTier = 'moderate';
  }

  // Find nearest open, safe shelter
  let nearestShelter: Shelter | null = null;
  let minDistance = Infinity;

  for (const shelter of shelters) {
    if (shelter.isOpen) {
      const dist = calculateDistanceKm(location.lat, location.lng, shelter.location.lat, shelter.location.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestShelter = shelter;
      }
    }
  }

  // Generate actionable safety recommendations
  const recommendations: string[] = [];
  if (compositeRiskTier === 'critical') {
    recommendations.push('🚨 IMMEDIATE EVACUATION ORDER: Severe life-threatening hazard detected at this coordinate.');
    if (nearestShelter) {
      recommendations.push(`Move immediately to ${nearestShelter.name} (${minDistance} km away). Avoid low-lying river bridges and steep cuttings.`);
    }
    recommendations.push('Do NOT attempt to drive or walk through flood waters deeper than 15 cm.');
  } else if (compositeRiskTier === 'severe') {
    recommendations.push('⚠️ MANDATORY EVACUATION PREPARATION: Pack essential medications, documents, and emergency water.');
    recommendations.push('Elevate critical electronics and shut off main electrical breakers if water enters property.');
    if (landslideRisk.score > 60) {
      recommendations.push('Watch for ground cracking, tilting trees, or sudden mud seeps from uphill slopes.');
    }
  } else if (compositeRiskTier === 'high') {
    recommendations.push('📢 FLOOD/LANDSLIDE WATCH: Monitor emergency broadcast channels and siren warnings.');
    recommendations.push('Identify your primary and secondary evacuation corridors.');
  } else {
    recommendations.push('✅ Current location is relatively stable. Maintain battery charge and monitor localized updates.');
  }

  return {
    location,
    compositeRiskScore,
    compositeRiskTier,
    floodRisk,
    landslideRisk,
    nearestShelter,
    distanceToShelterKm: minDistance === Infinity ? null : minDistance,
    actionableRecommendations: recommendations,
  };
}

/**
 * Algorithmic Response Prioritization for Incident Dispatch
 * Priority Score (0-100) =
 *   0.35 * (Trapped Lives & Medical Need) +
 *   0.25 * (Hazard Severity & Rate of Inundation) +
 *   0.20 * (Isolation & Cutoff Threat) +
 *   0.10 * (Critical Infrastructure Impact) +
 *   0.10 * (Time Elapsed without Dispatch)
 */
export function calculateResponsePriority(report: Partial<CitizenReport>): {
  priorityScore: number;
  priorityTier: ResponsePriorityTier;
  reasoning: string;
} {
  // 1. Lives at Risk Score (0 - 100)
  const trapped = report.trappedCount ?? 0;
  let livesScore = 0;
  if (trapped >= 10) livesScore = 100;
  else if (trapped >= 5) livesScore = 85;
  else if (trapped >= 1) livesScore = 70;
  else if (report.category === 'trapped_civilians') livesScore = 75;
  else livesScore = 20;

  // 2. Hazard Severity Score (0 - 100)
  let severityScore = 30;
  if (report.severity === 'critical') severityScore = 100;
  else if (report.severity === 'severe') severityScore = 80;
  else if (report.severity === 'high') severityScore = 60;
  else if (report.severity === 'moderate') severityScore = 40;

  // Extra boost if deep water or heavy debris
  if ((report.waterDepthCm ?? 0) > 100) severityScore = Math.min(100, severityScore + 20);
  if ((report.debrisHeightM ?? 0) > 2) severityScore = Math.min(100, severityScore + 20);

  // 3. Isolation & Cutoff Threat (0 - 100)
  let isolationScore = 30;
  if (report.category === 'bridge_damaged' || report.category === 'road_blocked' || report.category === 'landslide') {
    isolationScore = 85;
  }

  // 4. Infrastructure (0 - 100)
  let infraScore = 25;
  if (report.category === 'power_outage' || report.category === 'bridge_damaged') {
    infraScore = 75;
  }

  // 5. Time Elapsed (Urgency)
  const timeScore = 50;

  const totalScore = Math.round(
    livesScore * 0.35 +
    severityScore * 0.25 +
    isolationScore * 0.2 +
    infraScore * 0.1 +
    timeScore * 0.1
  );

  let priorityTier: ResponsePriorityTier = 'P4_LOW';
  let reasoning = 'Routine incident report. Scheduled for standard patrol queue.';

  if (totalScore >= 80 || trapped > 2) {
    priorityTier = 'P1_CRITICAL';
    reasoning = `CRITICAL PRIORITY: ${trapped > 0 ? `${trapped} lives directly trapped` : 'Severe life danger'} under imminent flood/debris hazard. Immediate swiftwater / heavy rescue deployment required.`;
  } else if (totalScore >= 65) {
    priorityTier = 'P2_HIGH';
    reasoning = 'HIGH PRIORITY: Rapidly deteriorating situation or primary evacuation route cut off. Dispatch high-clearance response team.';
  } else if (totalScore >= 45) {
    priorityTier = 'P3_MODERATE';
    reasoning = 'MODERATE PRIORITY: Localized damage or infrastructure hazard without immediate life threat.';
  }

  return {
    priorityScore: totalScore,
    priorityTier,
    reasoning,
  };
}
