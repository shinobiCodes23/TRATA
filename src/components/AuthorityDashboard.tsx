import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Radio,
  Send,
  CheckCircle,
  Sparkles,
  Truck,
  ChevronRight,
} from 'lucide-react';
import {
  CitizenReport,
  EmergencyAlert,
  HazardZone,
  RiskSummary,
  RescueUnit,
  RegionProfile,
} from '../types';
import { REGIONS } from '../data/disasterData';
import { SUNDARBANS_GRAPH } from '../priorityResponse/graphData';
import { PriorityIncidentInput, PriorityQueueEntry, ResponseResult } from '../priorityResponse/types';

interface AuthorityDashboardProps {
  reports: CitizenReport[];
  units: RescueUnit[];
  zones: HazardZone[];
  onIssueAlert: (newAlert: EmergencyAlert) => void;
  onSelectReportOnMap: (report: CitizenReport) => void;
  currentRegion?: RegionProfile;
  step4Results?: Record<string, ResponseResult>;
  prioritySnapshot?: {
    intakeBuffer: PriorityIncidentInput[];
    pendingQueue: PriorityQueueEntry[];
    activeIncidentId?: string;
    activeIncidentPendingResource: boolean;
    bufferWindowEndsAt: number | null;
  };
  operationalEvents?: Array<{ id: string; level: 'success' | 'warning' | 'danger' | 'info'; message: string; createdAt: number }>;
  citizensSaved?: number;
  fleetRecoveryEndsAt?: Record<string, number>;
  riskSummary?: RiskSummary;
}

function getCompassDirection(fromNodeId: string, toNodeId: string): string {
  const from = SUNDARBANS_GRAPH.nodeMap[fromNodeId];
  const to = SUNDARBANS_GRAPH.nodeMap[toNodeId];
  if (!from || !to) return 'Continue';

  const angle = (Math.atan2(to.lon - from.lon, to.lat - from.lat) * 180 / Math.PI + 360) % 360;
  const directions = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return `Proceed ${directions[Math.round(angle / 45) % directions.length]}`;
}

function formatGraphNode(nodeId: string): string {
  const node = SUNDARBANS_GRAPH.nodeMap[nodeId];
  return node ? `${node.displayName} (${nodeId.toUpperCase()})` : nodeId.toUpperCase();
}

const AVERAGE_RESPONSE_SPEED_KMH = 30;

function formatEstimatedReachTime(distance: number | null): string {
  if (distance === null) return 'Unavailable';
  const totalMinutes = Math.round((distance / AVERAGE_RESPONSE_SPEED_KMH) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours === 0 ? `${minutes} min` : minutes === 0 ? `${hours} hour${hours === 1 ? '' : 's'}` : `${hours}h ${minutes}m`;
}

export const AuthorityDashboard: React.FC<AuthorityDashboardProps> = ({
  reports = [],
  units = [],
  zones = [],
  onIssueAlert,
  onSelectReportOnMap,
  currentRegion = REGIONS[0],
  step4Results = {},
  prioritySnapshot,
  operationalEvents = [],
  citizensSaved = 0,
  fleetRecoveryEndsAt = {},
  riskSummary,
}) => {
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('active'); // active (pending, dispatched, in_progress) vs resolved

  // Default regional broadcast areas
  const defaultArea = currentRegion.id === 'wb-north'
    ? 'Teesta Bazar, Gajoldoba Barrage Lowlands, NH-10 Paglajhora, Tindharia'
    : currentRegion.id === 'wb-south'
    ? 'Gosaba Bali Island, Kakdwip, Sagar Island, Behala Kolkata'
    : 'Lower River Confluence, North Ridge Escarpment, Timberline Hills';

  // AI Broadcast Generator state
  const [broadcastHazard, setBroadcastHazard] = useState<'Flood' | 'Landslide' | 'Compound' | 'Evacuation'>('Flood');
  const [broadcastSeverity, setBroadcastSeverity] = useState<'Advisory' | 'Watch' | 'Warning' | 'Emergency'>('Emergency');
  const [broadcastAreas, setBroadcastAreas] = useState<string>(defaultArea);
  const [customNotes, setCustomNotes] = useState<string>(
    currentRegion.state === 'West Bengal'
      ? 'Teesta river exceeding danger mark at 114.5m / High tidal surge overtopping earthen bunds. Mandatory evacuation ordered by WBSDMA.'
      : 'River cresting at 7.4m, mandatory evacuation order'
  );
  const [isGeneratingBroadcast, setIsGeneratingBroadcast] = useState<boolean>(false);
  const [generatedBroadcast, setGeneratedBroadcast] = useState<any>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!prioritySnapshot?.bufferWindowEndsAt && Object.keys(fleetRecoveryEndsAt).length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [prioritySnapshot?.bufferWindowEndsAt, fleetRecoveryEndsAt]);


  // Statistics calculation
  const totalTrappedCivilians = reports
    .filter((r) => r.status !== 'resolved')
    .reduce((acc, r) => acc + (r.trappedCount || 0), 0);


  const totalPopAtRisk = zones.reduce((acc, z) => acc + z.populationAtRisk, 0);
  const criticalAreaCount = zones.filter((zone) => zone.riskTier === 'critical' || zone.riskTier === 'severe').length;
  const areasUnderThreat = riskSummary?.areasUnderThreat ?? zones.length;
  const criticallyAffected = riskSummary?.criticallyAffected ?? criticalAreaCount;
  const citizensUnderWarning = riskSummary?.citizensUnderWarning ?? totalPopAtRisk;
  const fleetAvailableCount = units.filter((unit) => unit.status === 'available').length;
  const fleetDeployedCount = units.length - fleetAvailableCount;
  const airliftRequiredCount = (Object.values(step4Results) as ResponseResult[]).filter((response) => response.status === 'NO_FEASIBLE_ROUTE').length;
  const activeFleet = units.find((unit) => unit.status !== 'available' && unit.assignedIncidentId);
  const activeReport = activeFleet ? reports.find((report) => report.id === activeFleet.assignedIncidentId) : undefined;
  const activeResponse = activeReport ? step4Results[activeReport.id] : undefined;

  // This is incident review, not a second queue: queue order above remains authoritative.
  const filteredReports = reports
    .filter((r) => {
      if (selectedStatusFilter === 'active' && r.status === 'resolved') return false;
      if (selectedStatusFilter === 'resolved' && r.status !== 'resolved') return false;
      if (selectedPriorityFilter === 'ALL') return true;
      return r.priorityTier === selectedPriorityFilter;
    });

  // Handle AI broadcast generator trigger
  const handleGenerateAIBroadcast = async () => {
    setIsGeneratingBroadcast(true);
    try {
      const res = await fetch('/api/ai/broadcast-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hazardType: broadcastHazard,
          severity: broadcastSeverity,
          affectedAreas: broadcastAreas.split(',').map((s) => s.trim()),
          customNotes,
        }),
      });
      const data = await res.json();
      setGeneratedBroadcast(data);
    } catch (err) {
      console.error('Broadcast generation failed', err);
    } finally {
      setIsGeneratingBroadcast(false);
    }
  };

  // Submit official alert
  const handlePublishAlert = () => {
    if (!generatedBroadcast) return;
    const newAlert: EmergencyAlert = {
      id: `alert-${Date.now()}`,
      headline: generatedBroadcast.headline || `${broadcastSeverity.toUpperCase()}: ${broadcastHazard} Threat`,
      hazardType: broadcastHazard,
      severity: broadcastSeverity,
      affectedAreas: broadcastAreas.split(',').map((s) => s.trim()),
      issuedAt: 'Just now',
      expiresAt: 'In 6 hours',
      instruction: generatedBroadcast.smsText || 'Evacuate to designated safe zones immediately.',
      channel: ['SMS', 'EAS_BROADCAST', 'SIREN', 'APP_PUSH'],
      active: true,
    };
    onIssueAlert(newAlert);
    setGeneratedBroadcast(null);
  };


  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 text-slate-100">
      {/* Header & Situational Metric Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">AUTHORITY COMMAND & DISPATCH</h1>
            <span className="px-2 py-0.5 bg-red-950 text-red-300 border border-red-800 rounded text-xs font-bold uppercase animate-pulse">
              DEFCON 1 Emergency
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Algorithmic Response Prioritization, Live Telemetry Stream, & Emergency Public Broadcasts
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-cyan-900/70 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/20 p-4 shadow-xl">
        <div className="flex flex-col gap-2 border-b border-slate-800 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Authority command lifecycle</div>
            <h2 className="mt-1 text-lg font-black text-white">Sundarbans Response Control Center</h2>
          </div>
          <div className="flex gap-2 text-[10px] font-bold">
            <span className="rounded bg-cyan-950 px-2 py-1 text-cyan-200">50 LOCATION NODES</span>
            <span className="rounded bg-purple-950 px-2 py-1 text-purple-200">5 PROTOTYPE CENTERS</span>
          </div>
        </div>
        {operationalEvents.length > 0 && (
          <div className="mt-3 rounded-xl border border-slate-800 bg-black/20 p-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Operational event history</div>
            <div className="space-y-1">
              {operationalEvents.slice(0, 3).map((event) => <div key={event.id} className={`text-[11px] ${event.level === 'danger' ? 'text-red-300' : event.level === 'warning' ? 'text-amber-300' : event.level === 'success' ? 'text-emerald-300' : 'text-cyan-300'}`}>{event.message}</div>)}
            </div>
          </div>
        )}
        {activeReport && activeFleet && activeResponse && (
          <div className="mt-3 rounded-xl border border-blue-900 bg-blue-950/20 p-3 text-xs">
            <div className="font-black uppercase tracking-wider text-blue-300">Active response · {activeFleet.status.replace('_', ' ')}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3 text-slate-200">
              <div><span className="text-slate-400">Incident:</span> {activeReport.id} · {activeReport.location.address || activeReport.title}</div>
              <div><span className="text-slate-400">Priority / citizens:</span> {activeResponse.priorityScore} · {activeReport.trappedCount}</div>
              <div><span className="text-slate-400">Center / fleet:</span> {activeResponse.selectedCenterId ? formatGraphNode(activeResponse.selectedCenterId) : 'N/A'} · {activeFleet.name}</div>
              <div><span className="text-slate-400">Allocated:</span> {activeResponse.requiredPersonnel} personnel</div>
              <div><span className="text-slate-400">Route:</span> {activeResponse.distance ?? 'N/A'} km</div>
              <div><span className="text-slate-400">ETA:</span> {formatEstimatedReachTime(activeResponse.distance)}</div>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {[
          ['Areas under threat', areasUnderThreat, 'text-cyan-300'],
          ['Critically affected', criticallyAffected, 'text-red-300'],
          ['Citizens to be rescued', totalTrappedCivilians, 'text-amber-300'],
          ['Citizens under warning', citizensUnderWarning.toLocaleString(), 'text-orange-300'],
          ['Citizens saved', citizensSaved, 'text-emerald-300'],
          ['Fleet available', `${fleetAvailableCount} / ${units.length}`, 'text-emerald-300'],
          ['Fleet deployed', `${fleetDeployedCount} / ${units.length}`, 'text-blue-300'],
          ['Airlift required', airliftRequiredCount, 'text-red-300'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-3 shadow-lg">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
            <div className={`mt-1 text-2xl font-black ${color}`}>{value}</div>
          </div>
        ))}
      </section>

      {/* Main Grid: Incident Review & Broadcast Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Incident review, separate from the authoritative queue above */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            {/* Header & Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  <h2 className="font-bold text-base text-white">Incident Review</h2>
                </div>
                <p className="text-xs text-slate-400">
                  Detailed incident information and the A* result used by the command workflow.
                </p>
              </div>

              {/* Triage Priority Filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {['ALL', 'P1_CRITICAL', 'P2_HIGH', 'P3_MODERATE'].map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setSelectedPriorityFilter(tier)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                      selectedPriorityFilter === tier
                        ? tier === 'P1_CRITICAL'
                          ? 'bg-red-600 text-white'
                          : tier === 'P2_HIGH'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-700 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tier === 'P1_CRITICAL' ? 'P1 Critical' : tier === 'P2_HIGH' ? 'P2 High' : tier === 'P3_MODERATE' ? 'P3 Mod' : 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Incident Cards List */}
            <div className="mt-4 space-y-3">
              {filteredReports.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No incident reports matching current priority filter.
                </div>
              ) : (
                filteredReports.map((report) => {
                  const isP1 = report.priorityTier === 'P1_CRITICAL';
                  const isP2 = report.priorityTier === 'P2_HIGH';
                  const assignedUnit = units.find((u) => u.id === report.assignedUnitId);
                  const step4Result = step4Results[report.id];

                  return (
                    <div
                      key={report.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isP1
                          ? 'bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 border-red-800/80 shadow-md shadow-red-950/20'
                          : isP2
                          ? 'bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border-amber-800/60'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              isP1
                                ? 'bg-red-600 text-white animate-pulse'
                                : isP2
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {report.priorityTier.replace('_', ' ')} • SCORE {report.priorityScore}/100
                          </span>
                          <span className="text-[11px] text-slate-400">{report.reportedAt}</span>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              report.status === 'resolved'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : report.status === 'dispatched'
                                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                : report.status === 'in_progress'
                                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                : 'bg-yellow-950 text-yellow-300 border border-yellow-800'
                            }`}
                          >
                            {report.status}
                          </span>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <div className="mt-2">
                        <h3 className="font-bold text-sm text-slate-100">{report.title}</h3>
                        <p className="text-xs text-slate-300 mt-1">{report.description}</p>
                      </div>

                      {/* Location & Hazard Highlights */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          📍 {report.location.address || `${report.location.lat}, ${report.location.lng}`}
                        </span>

                        {report.trappedCount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-700 font-bold">
                            🚨 {report.trappedCount} Persons Trapped
                          </span>
                        )}

                        {report.waterDepthCm && (
                          <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                            💧 Water: {report.waterDepthCm} cm
                          </span>
                        )}

                        {report.debrisHeightM && (
                          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                            ⛰️ Debris: {report.debrisHeightM} m
                          </span>
                        )}

                        {assignedUnit && (
                          <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-medium">
                            🚑 Unit: {assignedUnit.name} (ETA {assignedUnit.etaMinutes || 5}m)
                          </span>
                        )}
                      </div>

                      {/* AI Triage & Verification Reasoning */}
                      {report.aiVerification && (
                        <div className="mt-2.5 bg-slate-900/90 p-2 rounded-lg border border-cyan-950 text-[11px] text-cyan-200 flex items-start gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-cyan-300">AI Triage (Confidence {Math.round(report.aiVerification.confidence * 100)}%): </span>
                            <span>{report.aiVerification.urgencyReasoning}</span>
                          </div>
                        </div>
                      )}

                      {/* Step 4 Response Details */}
                      {step4Result && (
                        <div className="mt-2.5 bg-slate-900/95 border border-cyan-900 rounded-lg p-2.5 text-[11px] text-cyan-100">
                          <div className="font-bold uppercase tracking-wider text-cyan-300 mb-1">A* Response</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-200 border border-cyan-800">
                              Center: {step4Result.selectedCenterId || 'N/A'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                              Personnel: {step4Result.requiredPersonnel}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                              Distance: {step4Result.distance !== null ? `${step4Result.distance} km` : 'N/A'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                              ETA: {formatEstimatedReachTime(step4Result.distance)} at {AVERAGE_RESPONSE_SPEED_KMH} km/h
                            </span>
                          </div>
                          <div className="mt-1 text-slate-300">
                            {step4Result.status === 'ROUTE_FOUND'
                              ? 'Route found. Select “View Route” to inspect the A* path on the map.'
                              : step4Result.status === 'NO_FEASIBLE_ROUTE'
                              ? 'No feasible route to any government center.'
                              : 'Invalid incident coordinates for A* routing.'}
                          </div>
                          {step4Result.status === 'ROUTE_FOUND' && (
                            <div className="mt-2 border-t border-cyan-950 pt-2">
                              <div className="font-semibold text-cyan-200">Prototype route details</div>
                              <ol className="mt-1 space-y-1 text-slate-300">
                                <li>Incident</li>
                                {step4Result.path.filter((nodeId) => nodeId !== step4Result.selectedCenterId).map((nodeId, pathIndex, routeNodes) => (
                                  <li key={nodeId} className="pl-3 border-l border-cyan-800/70">
                                    ↓ {formatGraphNode(nodeId)}{pathIndex > 0 ? ` — ${getCompassDirection(routeNodes[pathIndex - 1], nodeId)}` : ''}
                                  </li>
                                ))}
                                <li className="font-semibold text-emerald-300">↓ {step4Result.selectedCenterId ? formatGraphNode(step4Result.selectedCenterId) : 'Government Center unavailable'}</li>
                              </ol>
                              <div className="mt-1 text-[10px] text-slate-500">Compass descriptions are prototype geographic guidance, not road directions.</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Dispatch & Action Bar */}
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
                        <button
                          onClick={() => onSelectReportOnMap(report)}
                          className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
                        >
                          <span>{step4Result?.status === 'ROUTE_FOUND' ? 'View Route' : 'Locate on Map'}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>

                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Col: CAP Emergency Broadcast Generator & Fleet Overview */}
        <div className="space-y-4">
          {/* Rescue Fleet Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-xs text-white">Rescue Fleet Deployment</h3>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">LIVE GPS</span>
            </div>

            <div className="mt-2 space-y-2">
              {units.map((unit, index) => {
                const assignedReport = reports.find((report) => report.id === unit.assignedIncidentId);
                const assignedResponse = assignedReport ? step4Results[assignedReport.id] : undefined;
                const deployedPersonnel = assignedResponse?.requiredPersonnel || 0;
                const recoverySeconds = fleetRecoveryEndsAt[unit.id] ? Math.max(0, Math.ceil((fleetRecoveryEndsAt[unit.id] - now) / 1000)) : null;
                return (
                <div key={unit.id} className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200">Fleet {index + 1} · {unit.name.split('—')[1]?.trim() || unit.name}</div>
                    <div className="text-[10px] text-slate-400">
                      Center pool: {unit.personnelCount} · Deployed: {deployedPersonnel} · Available: {unit.personnelCount - deployedPersonnel}
                    </div>
                    {assignedReport && <div className="text-[10px] text-cyan-300">Incident: {assignedReport.location.address || assignedReport.title}</div>}
                    {recoverySeconds !== null && <div className="text-[10px] text-amber-300">Recovering · available in 00:{String(recoverySeconds).padStart(2, '0')}</div>}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      unit.status === 'available'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : unit.status === 'en_route'
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : 'bg-purple-950 text-purple-300 border border-purple-800'
                    }`}
                  >
                    {unit.status}
                  </span>
                </div>
              )})}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
