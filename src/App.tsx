import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navbar } from './components/Navbar';
import { DisasterMap } from './components/DisasterMap';
import { AuthorityDashboard } from './components/AuthorityDashboard';
import { CitizenPortal } from './components/CitizenPortal';
import { RiskEngineAnalysis } from './components/RiskEngineAnalysis';
import { DigitalTwinSimulator } from './components/DigitalTwinSimulator';
import { SheltersView } from './components/SheltersView';
import { IoTDashboard } from './components/IoTDashboard';
import { HistoricalAnalysisView } from './components/HistoricalAnalysisView';
import { FusionIntelligenceCenter } from './components/FusionIntelligenceCenter';
import { AboutUs } from './components/AboutUs';
import { HowItWorks } from './components/HowItWorks';

import {
  CitizenReport,
  EmergencyAlert,
  HazardZone,
  IoTSensor,
  RegionProfile,
  RescueUnit,
  RiskSummary,
  Shelter,
  SimulationState,
} from './types';
import {
  REGIONS,
  REGION_DATA,
  INITIAL_SIMULATION_STAGES,
} from './data/disasterData';
import {
  enqueueIncident,
  evaluateIncident,
  getFeasibleGovernmentCenterRoutes,
  getPriorityResponseSnapshot,
  isActiveIncidentPendingResource,
  releaseActiveIncident,
  retryActiveIncident,
  setActiveIncidentPendingResource,
  subscribeToPriorityResponseState,
  subscribeToResponses,
} from './priorityResponse/responseEngine';
import { applyCriticalRiskAreas } from './priorityResponse/graph';
import { SUNDARBANS_GRAPH } from './priorityResponse/graphData';
import { ResponseResult } from './priorityResponse/types';
import { assessLocationRisk } from './utils/riskCalculators';
import {
  AiHazardPrediction,
  getSeasonalTimeline,
  normalizeSundarbansRisk,
  seasonalTimelineLabel,
} from './utils/sundarbansRiskNormalization';

export const FLEET_SERVICE_DURATION_MS = 15000;
export const FLEET_RECOVERY_DURATION_MS = 5000;
export const FLEET_DISPATCH_PREPARATION_MS = 2000;

const CENTER_FLEET_PERSONNEL = [160, 150, 180, 140, 170];

function createCenterFleets(): RescueUnit[] {
  return ['g-01', 'g-02', 'g-03', 'g-04', 'g-05'].map((centerId, index) => {
    const center = SUNDARBANS_GRAPH.nodeMap[centerId];
    return {
      id: `fleet-${centerId}`,
      name: `Fleet ${index + 1} — ${centerId.toUpperCase()}`,
      type: 'swiftwater_rescue',
      status: 'available',
      location: { lat: center.lat, lng: center.lon, address: center.displayName },
      personnelCount: CENTER_FLEET_PERSONNEL[index],
    };
  });
}

// Seasonal timelines map onto the existing simulation profiles so the risk
// engine and its heatmap inputs change without introducing a second model.
export function getCurrentSeasonStageIndex(date = new Date()): number {
  const month = date.getMonth() + 1;
  if (month === 12 || month <= 2) return 0; // Winter
  if (month <= 5) return 1; // Pre-monsoon
  if (month <= 9) return 3; // Monsoon
  return 5; // Post-monsoon
}

export interface OperationalEvent {
  id: string;
  level: 'success' | 'warning' | 'danger' | 'info';
  message: string;
  createdAt: number;
}

export default function App() {
  // The operational UI is intentionally fixed to the Sundarbans prototype.
  const currentRegionId = 'wb-south';
  const currentRegion: RegionProfile =
    REGIONS.find((r) => r.id === currentRegionId) || REGIONS[0];

  // Navigation State: 'map' | 'authority' | 'citizen' | 'risk-engine' | 'digital-twin' | 'shelters' | 'iot' | 'historical'
  const [activeTab, setActiveTab] = useState<string>('map');

  // Simulation Stages State
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(() => getCurrentSeasonStageIndex());
  const simState: SimulationState = INITIAL_SIMULATION_STAGES[currentStageIndex] || INITIAL_SIMULATION_STAGES[0];
  const selectedSeason = getSeasonalTimeline(currentStageIndex);

  // Core Data Collections initialized from active region
  const activeRegionData = REGION_DATA[currentRegionId] || REGION_DATA['wb-north'];
  const [hazardZones, setHazardZones] = useState<HazardZone[]>(activeRegionData.hazardZones);
  const [sensors, setSensors] = useState<IoTSensor[]>(activeRegionData.sensors);
  const [shelters, setShelters] = useState<Shelter[]>(activeRegionData.shelters);
  const [reports, setReports] = useState<CitizenReport[]>([]);
  // The operational fleet maps one existing RescueUnit-shaped asset to each
  // authoritative government center; no routing or priority model is added.
  const [rescueUnits, setRescueUnits] = useState<RescueUnit[]>(createCenterFleets);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>(activeRegionData.alerts);
  const [step4Results, setStep4Results] = useState<Record<string, ResponseResult>>({});
  const [scanLocation, setScanLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [prioritySnapshot, setPrioritySnapshot] = useState(getPriorityResponseSnapshot);
  const [operationalEvents, setOperationalEvents] = useState<OperationalEvent[]>([]);
  const [graphRevision, setGraphRevision] = useState(0);
  const [aiHazardPrediction, setAiHazardPrediction] = useState<AiHazardPrediction | undefined>();
  const [citizensSaved, setCitizensSaved] = useState(0);
  const [fleetRecoveryEndsAt, setFleetRecoveryEndsAt] = useState<Record<string, number>>({});
  const [riskSummary, setRiskSummary] = useState<RiskSummary>();
  const fleetTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const eventSequence = useRef(0);
  const rescueUnitsRef = useRef(rescueUnits);
  const reportsRef = useRef(reports);
  const completedIncidentIds = useRef(new Set<string>());
  const scheduledFleetIncidents = useRef(new Set<string>());

  useEffect(() => { rescueUnitsRef.current = rescueUnits; }, [rescueUnits]);
  useEffect(() => { reportsRef.current = reports; }, [reports]);
  useEffect(() => {
    const controller = new AbortController();
    // The existing prediction API is optional contextual input. If it is not
    // available, the established risk engine remains the complete data source.
    fetch('/api/ai/predict-hazards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        currentRainfall: simState.rainfallRateMmH,
        riverStage: simState.riverStageM,
        soilMoisture: simState.soilSaturationPercent,
        porePressure: simState.groundPorePressureKPa,
      }),
    })
      .then((response) => response.ok ? response.json() : undefined)
      .then((prediction) => { if (prediction) setAiHazardPrediction(prediction); })
      .catch((error) => { if (error.name !== 'AbortError') setAiHazardPrediction(undefined); });
    return () => controller.abort();
  }, [simState]);

  const networkRiskSnapshots = useMemo(() => Object.fromEntries(Object.values(SUNDARBANS_GRAPH.nodeMap).map((node) => {
    const risk = assessLocationRisk({ lat: node.lat, lng: node.lon, elevation: 4, slopeAngle: 1, distanceToRiver: 120, seismicPGAG: 0.05 }, simState, sensors, shelters);
    const baseRisk = {
      overall: risk.compositeRiskScore,
      flood: risk.floodRisk.score,
      landslide: risk.landslideRisk.score,
      earthquake: risk.landslideRisk.factors.seismicPeakGroundAcc,
    };
    return [node.nodeId, normalizeSundarbansRisk(baseRisk, node, selectedSeason, aiHazardPrediction)];
  })), [simState, sensors, shelters, selectedSeason, aiHazardPrediction]);

  const addOperationalEvent = (level: OperationalEvent['level'], message: string) => {
    setOperationalEvents((events) => [
      { id: `${Date.now()}-${eventSequence.current++}`, level, message, createdAt: Date.now() },
      ...events,
    ].slice(0, 12));
  };

  const startFleetDispatch = (report: CitizenReport, fleet: RescueUnit, response: ResponseResult) => {
    if (scheduledFleetIncidents.current.has(report.id)) return;
    scheduledFleetIncidents.current.add(report.id);
    addOperationalEvent('info', 'Assigning fleet...');

    const dispatchTimer = setTimeout(() => {
      rescueUnitsRef.current = rescueUnitsRef.current.map((unit) => unit.id === fleet.id
        ? { ...unit, status: 'en_route', assignedIncidentId: report.id }
        : unit);
      setRescueUnits(rescueUnitsRef.current);
      setReports((items) => items.map((item) => item.id === report.id
        ? { ...item, status: 'dispatched', assignedUnitId: fleet.id }
        : item));
      addOperationalEvent('success', 'Successfully dispatched. Fleet on way.');
    }, FLEET_DISPATCH_PREPARATION_MS);

    const onSceneTimer = setTimeout(() => {
      setRescueUnits((items) => items.map((unit) => unit.id === fleet.id && unit.assignedIncidentId === report.id
        ? { ...unit, status: 'on_scene' }
        : unit));
      setReports((items) => items.map((item) => item.id === report.id ? { ...item, status: 'in_progress' } : item));
    }, FLEET_DISPATCH_PREPARATION_MS + Math.round(FLEET_SERVICE_DURATION_MS / 3));

    const completionTimer = setTimeout(() => {
      setRescueUnits((items) => items.map((unit) => unit.id === fleet.id && unit.assignedIncidentId === report.id
        ? { ...unit, status: 'returning' }
        : unit));
      setReports((items) => items.map((item) => item.id === report.id ? { ...item, status: 'resolved' } : item));
      if (!completedIncidentIds.current.has(report.id)) {
        completedIncidentIds.current.add(report.id);
        setCitizensSaved((saved) => saved + (report.trappedCount || 0));
        addOperationalEvent('success', `A successful evacuation was undertaken for ${report.location.address || report.title}.`);
      }
      setFleetRecoveryEndsAt((current) => ({ ...current, [fleet.id]: Date.now() + FLEET_RECOVERY_DURATION_MS }));
      setRescueUnits((items) => items.map((unit) => unit.id === fleet.id && unit.assignedIncidentId === report.id
        ? { ...unit, status: 'maintenance' }
        : unit));
    }, FLEET_DISPATCH_PREPARATION_MS + Math.round((FLEET_SERVICE_DURATION_MS * 2) / 3));

    const recoveryTimer = setTimeout(() => {
      rescueUnitsRef.current = rescueUnitsRef.current.map((unit) => unit.id === fleet.id
        ? { ...unit, status: 'available', assignedIncidentId: undefined }
        : unit);
      setRescueUnits(rescueUnitsRef.current);
      setFleetRecoveryEndsAt((current) => {
        const { [fleet.id]: _, ...remaining } = current;
        return remaining;
      });
      scheduledFleetIncidents.current.delete(report.id);
      addOperationalEvent('success', `Fleet ${fleet.id.replace('fleet-', '').toUpperCase()} is available again.`);
      // A resource-pending head must be retried, not released. A completed
      // dispatch releases normally and advances the authoritative queue.
      if (isActiveIncidentPendingResource()) {
        retryActiveIncident();
      } else {
        releaseActiveIncident();
      }
    }, FLEET_DISPATCH_PREPARATION_MS + FLEET_SERVICE_DURATION_MS);
    fleetTimers.current.push(dispatchTimer, onSceneTimer, completionTimer, recoveryTimer);
    void response;
  };

  useEffect(() => subscribeToResponses((response) => {
    if (response.status !== 'ROUTE_FOUND') {
      setStep4Results((prev) => ({ ...prev, [response.incidentId]: response }));
      addOperationalEvent(response.status === 'NO_FEASIBLE_ROUTE' ? 'danger' : 'warning', response.status === 'NO_FEASIBLE_ROUTE'
        ? 'All routes blocked. Airlift required.'
        : 'Route blocked. Trying to find an alternative...');
      releaseActiveIncident();
      return;
    }
    const report = reportsRef.current.find((item) => item.id === response.incidentId);
    if (!report) return;
    const feasibleRoutes = getFeasibleGovernmentCenterRoutes({
      incidentId: report.id,
      priorityScore: report.priorityScore,
      location: report.location,
      category: report.category,
      trappedCount: report.trappedCount,
      status: report.status,
    });
    const availableResponse = feasibleRoutes.find((candidate) => {
      const candidateFleet = rescueUnitsRef.current.find((unit) => unit.id === `fleet-${candidate.selectedCenterId}`);
      return candidateFleet?.status === 'available' && candidateFleet.personnelCount >= candidate.requiredPersonnel;
    });
    if (!availableResponse) {
      // A route exists, but no eligible center-associated fleet can take it.
      const wasPendingResource = isActiveIncidentPendingResource();
      setActiveIncidentPendingResource(true);
      if (!wasPendingResource) {
        addOperationalEvent('warning', 'No suitable fleet is currently available. Incident remains pending.');
      }
      return;
    }
    const fleet = rescueUnitsRef.current.find((unit) => unit.id === `fleet-${availableResponse.selectedCenterId}`);
    if (!fleet) return;
    setActiveIncidentPendingResource(false);
    setStep4Results((prev) => ({ ...prev, [availableResponse.incidentId]: availableResponse }));
    const centerName = SUNDARBANS_GRAPH.nodeMap[availableResponse.selectedCenterId!]?.displayName || availableResponse.selectedCenterId;
    const isFallbackCenter = feasibleRoutes[0]?.selectedCenterId !== availableResponse.selectedCenterId;
    addOperationalEvent('success', isFallbackCenter
      ? `Government Center ${centerName} is the closest available response center. We are assigning a fleet response from there.`
      : `Government Center ${centerName} is closest to the affected region. We are assigning a fleet response from there.`);
    startFleetDispatch(report, fleet, availableResponse);
  }), []);

  useEffect(() => subscribeToPriorityResponseState(() => {
    setPrioritySnapshot(getPriorityResponseSnapshot());
  }), []);

  useEffect(() => () => {
    fleetTimers.current.forEach(clearTimeout);
  }, []);

  // Network availability is owned by the risk model: only critical hazard
  // polygons may detach graph connections. Recovery is handled by restoring
  // edges outside the current critical areas.
  useEffect(() => {
    applyCriticalRiskAreas(SUNDARBANS_GRAPH, hazardZones);
    setGraphRevision((revision) => revision + 1);
  }, [hazardZones]);

  // Re-evaluate existing routes after a risk-engine availability transition.
  // The queue remains untouched; this only refreshes structured route state.
  useEffect(() => {
    setStep4Results((existing) => Object.fromEntries(Object.entries(existing).map(([incidentId, previous]) => {
      if (incidentId === 'scan-location') {
        return [incidentId, scanLocation ? evaluateIncident({ incidentId, priorityScore: 50, location: scanLocation }) : previous];
      }
      const report = reports.find((item) => item.id === incidentId);
      if (!report) return [incidentId, previous];
      return [incidentId, evaluateIncident({ incidentId, priorityScore: report.priorityScore, location: report.location, category: report.category, trappedCount: report.trappedCount, status: report.status })];
    })));
  }, [graphRevision, reports, scanLocation]);

  // Map inspection selection state
  const [selectedMapItem, setSelectedMapItem] = useState<{
    type: 'zone' | 'sensor' | 'shelter' | 'report' | 'unit';
    data: any;
  } | null>(null);

  // Handle stage change
  const handleStageChange = (newIndex: number) => {
    setCurrentStageIndex(newIndex);
    const newSim = INITIAL_SIMULATION_STAGES[newIndex];
    // Dynamic zone severity adjustment based on simulation stage
    setHazardZones((prevZones) =>
      prevZones.map((z) => {
        if (z.type === 'flood' || z.type === 'compound') {
          return {
            ...z,
            riskScore: Math.min(100, Math.round(z.riskScore * (1 + newSim.rainfallRateMmH / 200))),
            waterLevelCurrentM: Number(((z.waterLevelCurrentM || 3.5) + (newSim.riverStageM - 4.0) * 0.3).toFixed(1)),
          };
        } else {
          return {
            ...z,
            riskScore: Math.min(100, Math.round(z.riskScore * (1 + newSim.groundPorePressureKPa / 150))),
          };
        }
      })
    );
  };

  // Add new citizen report (or SOS distress beacon)
  const handleAddCitizenReport = (newReport: CitizenReport) => {
    setReports((prev) => [newReport, ...prev]);

    enqueueIncident({
      incidentId: newReport.id,
      priorityScore: newReport.priorityScore,
      location: {
        lat: newReport.location.lat,
        lng: newReport.location.lng,
        address: newReport.location.address,
      },
      category: newReport.category,
      trappedCount: newReport.trappedCount,
      status: newReport.status,
    });

    // Also push a live emergency alert if it's an SOS Beacon or Critical Life Threat
    if (newReport.priorityTier === 'P1_CRITICAL') {
      const sosAlert: EmergencyAlert = {
        id: `sos-alert-${Date.now()}`,
        headline: `DISTRESS BEACON: ${newReport.title}`,
        hazardType: 'Compound',
        severity: 'Emergency',
        affectedAreas: [newReport.location.address || 'Reported Sector'],
        issuedAt: 'Just now',
        expiresAt: 'In 3 hours',
        instruction: 'Rescue units have been automatically notified. Stand by for swiftwater extraction.',
        channel: ['SMS', 'APP_PUSH', 'EAS_BROADCAST'],
        active: true,
      };
      setAlerts((prev) => [sosAlert, ...prev]);
    }
  };

  const handleScanLocation = (location: { lat: number; lng: number; address?: string }) => {
    setScanLocation(location);
    const response = evaluateIncident({
      incidentId: 'scan-location', priorityScore: 50, location,
    });
    setStep4Results((results) => ({ ...results, [response.incidentId]: response }));
  };

  // Issue official authority alert
  const handleIssueAlert = (newAlert: EmergencyAlert) => {
    setAlerts((prev) => [newAlert, ...prev]);
  };

  // Deploy virtual IoT sensor node
  const handleDeploySensor = (newSensor: IoTSensor) => {
    setSensors((prev) => [newSensor, ...prev]);
  };

  // Cross-component focus on map item
  const handleSelectReportOnMap = (report: CitizenReport) => {
    setSelectedMapItem({ type: 'report', data: report });
    setActiveTab('map');
  };

  const handleSelectShelterOnMap = (shelter: Shelter) => {
    setSelectedMapItem({ type: 'shelter', data: shelter });
    setActiveTab('map');
  };

  const unresolvedP1Count = reports.filter(
    (r) => r.priorityTier === 'P1_CRITICAL' && r.status !== 'resolved'
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation & Status Center */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        alerts={alerts}
        simState={simState}
        currentStageIndex={currentStageIndex}
        onStageChange={handleStageChange}
        unresolvedReportsCount={unresolvedP1Count}
      />

      {/* Main Content Area */}
      <main className="app-body flex-1 w-full pb-10">
        {activeTab === 'map' && (
          <DisasterMap
            hazardZones={hazardZones}
            sensors={sensors}
            shelters={shelters}
            reports={reports}
            units={rescueUnits}
            simState={simState}
            currentRegion={currentRegion}
            selectedMapItem={selectedMapItem}
            step4Results={step4Results}
            graphRevision={graphRevision}
            networkRiskSnapshots={networkRiskSnapshots}
            selectedSeasonLabel={seasonalTimelineLabel(selectedSeason)}
            onScanLocation={handleScanLocation}
            onClearSelectedItem={() => setSelectedMapItem(null)}
            onSelectReport={(rep) => setSelectedMapItem(rep ? { type: 'report', data: rep } : null)}
            onSelectSensor={(sens) => setSelectedMapItem(sens ? { type: 'sensor', data: sens } : null)}
            onSelectShelter={(shelt) => setSelectedMapItem(shelt ? { type: 'shelter', data: shelt } : null)}
          />
        )}

        {activeTab === 'fusion' && (
          <FusionIntelligenceCenter
            reports={reports}
            units={rescueUnits}
            sensors={sensors}
            zones={hazardZones}
            alerts={alerts}
            simState={simState}
            currentRegion={currentRegion}
            onNavigateToMap={() => setActiveTab('map')}
          />
        )}

        {activeTab === 'authority' && (
          <AuthorityDashboard
            reports={reports}
            units={rescueUnits}
            zones={hazardZones}
            currentRegion={currentRegion}
            step4Results={step4Results}
            prioritySnapshot={prioritySnapshot}
            operationalEvents={operationalEvents}
            citizensSaved={citizensSaved}
            fleetRecoveryEndsAt={fleetRecoveryEndsAt}
            riskSummary={riskSummary}
            onIssueAlert={handleIssueAlert}
            onSelectReportOnMap={handleSelectReportOnMap}
          />
        )}

        {activeTab === 'citizen' && (
          <CitizenPortal
            shelters={shelters}
            simState={simState}
            currentRegion={currentRegion}
            routeResult={(Object.values(step4Results) as ResponseResult[]).at(-1)}
            onSubmitReport={handleAddCitizenReport}
            onSelectShelterOnMap={handleSelectShelterOnMap}
          />
        )}

        {activeTab === 'risk-engine' && (
          <RiskEngineAnalysis
            simState={simState}
            zones={hazardZones}
            onRiskSummaryChange={setRiskSummary}
          />
        )}

        {activeTab === 'digital-twin' && (
          <DigitalTwinSimulator
            currentStageIndex={currentStageIndex}
            onSetStageIndex={handleStageChange}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'shelters' && (
          <SheltersView shelters={shelters} onSelectShelterOnMap={handleSelectShelterOnMap} />
        )}

        {activeTab === 'iot' && (
          <IoTDashboard sensors={sensors} onDeploySensor={handleDeploySensor} />
        )}

        {activeTab === 'historical' && <HistoricalAnalysisView simState={simState} />}

        {activeTab === 'about' && <AboutUs />}

        {activeTab === 'how-it-works' && <HowItWorks />}
      </main>
    </div>
  );
}
