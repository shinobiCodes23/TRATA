import { SUNDARBANS_GRAPH, GOVERNMENT_CENTER_IDS } from './graphData';
import { PriorityIncidentInput, ResponseResult } from './types';
import { PriorityQueue } from './priorityQueue';
import { findNearestNode, getAvailableNeighbors } from './graph';
import { astarShortestPath, selectBestGovernmentCenterRoute } from './astar';

export const priorityResponseQueue = new PriorityQueue();
export const PRIORITY_BUFFER_WINDOW_MS = 5000;

const intakeBuffer: PriorityIncidentInput[] = [];
const responseListeners = new Set<(response: ResponseResult) => void>();
const stateListeners = new Set<() => void>();
let bufferWindow: ReturnType<typeof setTimeout> | undefined;
let bufferWindowEndsAt: number | null = null;
let activeIncidentId: string | undefined;
let activeIncident: PriorityIncidentInput | undefined;
let activeResponse: ResponseResult | undefined;
let activeIncidentPendingResource = false;

function notifyStateListeners(): void {
  stateListeners.forEach((listener) => listener());
}

function hasIncidentId(incidentId: string): boolean {
  return activeIncidentId === incidentId
    || intakeBuffer.some((incident) => incident.incidentId === incidentId)
    || priorityResponseQueue.getAll().some((incident) => incident.incidentId === incidentId);
}

function flushIntakeBuffer(): void {
  const bufferedIncidents = intakeBuffer.splice(0, intakeBuffer.length);
  for (const incident of bufferedIncidents) {
    priorityResponseQueue.enqueue(incident);
  }
  notifyStateListeners();
}

function dispatchNextIncident(): void {
  if (activeIncidentId || priorityResponseQueue.size() === 0) {
    return;
  }

  const nextIncident = priorityResponseQueue.dequeue();
  if (!nextIncident) {
    return;
  }

  activeIncidentId = nextIncident.incidentId;
  activeIncident = nextIncident;
  activeIncidentPendingResource = false;
  notifyStateListeners();
  activeResponse = evaluateIncident(nextIncident);
  responseListeners.forEach((listener) => listener(activeResponse!));
}

/**
 * Releases the current queue head only after the application has acted on its
 * authoritative ResponseResult (ground dispatch or airlift handling). Fleet
 * scheduling remains in App; this module still owns the single queue/order.
 */
export function releaseActiveIncident(): void {
  if (!activeIncidentId) return;
  activeIncidentId = undefined;
  activeIncident = undefined;
  activeResponse = undefined;
  activeIncidentPendingResource = false;
  flushIntakeBuffer();
  notifyStateListeners();
  dispatchNextIncident();
}

/** Re-evaluates the held queue head against current graph availability. */
export function retryActiveIncident(): void {
  if (!activeIncidentId || !activeIncident) return;
  activeResponse = evaluateIncident(activeIncident);
  responseListeners.forEach((listener) => listener(activeResponse!));
}

/** Marks whether the held queue head is waiting for a fleet rather than active in a dispatch lifecycle. */
export function setActiveIncidentPendingResource(pending: boolean): void {
  if (!activeIncidentId || activeIncidentPendingResource === pending) return;
  activeIncidentPendingResource = pending;
  notifyStateListeners();
}

export function isActiveIncidentPendingResource(): boolean {
  return activeIncidentPendingResource;
}

function flushBufferWindow(): void {
  bufferWindow = undefined;
  bufferWindowEndsAt = null;
  notifyStateListeners();
  if (activeIncidentId) {
    return;
  }

  flushIntakeBuffer();
  dispatchNextIncident();
}

export function getRequiredPersonnel(priorityScore: number): number {
  if (priorityScore >= 80) return 10;
  if (priorityScore >= 65) return 8;
  if (priorityScore >= 45) return 6;
  return 4;
}

export function enqueueIncident(incident: PriorityIncidentInput): void {
  if (hasIncidentId(incident.incidentId)) {
    throw new Error(`Duplicate incident ID: ${incident.incidentId}`);
  }

  intakeBuffer.push(incident);
  if (!bufferWindow) {
    bufferWindowEndsAt = Date.now() + PRIORITY_BUFFER_WINDOW_MS;
    bufferWindow = setTimeout(flushBufferWindow, PRIORITY_BUFFER_WINDOW_MS);
  }
  notifyStateListeners();
}

export function subscribeToResponses(listener: (response: ResponseResult) => void): () => void {
  responseListeners.add(listener);
  return () => responseListeners.delete(listener);
}

export function subscribeToPriorityResponseState(listener: () => void): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

export function getPriorityResponseSnapshot(): {
  intakeBuffer: PriorityIncidentInput[];
  pendingQueue: ReturnType<PriorityQueue['getAll']>;
  activeIncidentId?: string;
  activeIncidentPendingResource: boolean;
  bufferWindowEndsAt: number | null;
} {
  return {
    intakeBuffer: [...intakeBuffer],
    pendingQueue: priorityResponseQueue.getAll(),
    activeIncidentId,
    activeIncidentPendingResource,
    bufferWindowEndsAt,
  };
}

export function evaluateIncident(incident: PriorityIncidentInput): ResponseResult {
  return evaluateIncidentForCenters(incident, GOVERNMENT_CENTER_IDS);
}

/**
 * Returns every currently feasible government-center route, ordered by the
 * actual A* distance. Fleet eligibility is deliberately not considered here.
 */
export function getFeasibleGovernmentCenterRoutes(incident: PriorityIncidentInput): ResponseResult[] {
  if (!incident || !incident.location || Number.isNaN(incident.location.lat) || Number.isNaN(incident.location.lng)) {
    return [];
  }

  const originNodeId = findNearestNode(SUNDARBANS_GRAPH, incident.location.lat, incident.location.lng);
  if (!originNodeId) return [];

  const routes: ResponseResult[] = [];
  for (const centerId of GOVERNMENT_CENTER_IDS) {
    if (!SUNDARBANS_GRAPH.nodeMap[centerId]) continue;
    const route = astarShortestPath(SUNDARBANS_GRAPH, originNodeId, centerId);
    if (route) {
      routes.push({
        incidentId: incident.incidentId,
        priorityScore: incident.priorityScore,
        requiredPersonnel: getRequiredPersonnel(incident.priorityScore),
        originNodeId,
        selectedCenterId: centerId,
        path: route.path,
        distance: Number(route.distance.toFixed(2)),
        status: 'ROUTE_FOUND',
      });
    }
  }
  return routes.sort((left, right) => (left.distance ?? Infinity) - (right.distance ?? Infinity));
}

/**
 * Evaluates a supplied operational subset of government centers with the
 * existing A* selector.  Fleet state belongs to the application layer, while
 * route feasibility and distance remain entirely owned by PriorityResponse.
 */
export function evaluateIncidentForCenters(
  incident: PriorityIncidentInput,
  eligibleCenterIds: string[],
): ResponseResult {
  if (!incident || !incident.location || Number.isNaN(incident.location.lat) || Number.isNaN(incident.location.lng)) {
    return {
      incidentId: incident?.incidentId || 'unknown',
      priorityScore: incident?.priorityScore ?? 0,
      requiredPersonnel: getRequiredPersonnel(incident?.priorityScore ?? 0),
      originNodeId: null,
      selectedCenterId: null,
      path: [],
      distance: null,
      status: 'INVALID_INPUT',
    };
  }

  const startNodeId = findNearestNode(SUNDARBANS_GRAPH, incident.location.lat, incident.location.lng);
  if (!startNodeId) {
    return {
      incidentId: incident.incidentId,
      priorityScore: incident.priorityScore,
      requiredPersonnel: getRequiredPersonnel(incident.priorityScore),
      originNodeId: null,
      selectedCenterId: null,
      path: [],
      distance: null,
      status: 'INVALID_INPUT',
    };
  }

  const selection = selectBestGovernmentCenterRoute(
    SUNDARBANS_GRAPH,
    startNodeId,
    eligibleCenterIds.filter((centerId) => GOVERNMENT_CENTER_IDS.includes(centerId) && SUNDARBANS_GRAPH.nodeMap[centerId]),
  );

  if (!selection.centerId || selection.distance === null) {
    return {
      incidentId: incident.incidentId,
      priorityScore: incident.priorityScore,
      requiredPersonnel: getRequiredPersonnel(incident.priorityScore),
      originNodeId: startNodeId,
      selectedCenterId: null,
      path: [],
      distance: null,
      status: 'NO_FEASIBLE_ROUTE',
    };
  }

  return {
    incidentId: incident.incidentId,
    priorityScore: incident.priorityScore,
    requiredPersonnel: getRequiredPersonnel(incident.priorityScore),
    originNodeId: startNodeId,
    selectedCenterId: selection.centerId,
    path: selection.path,
    distance: Number(selection.distance.toFixed(2)),
    status: 'ROUTE_FOUND',
  };
}

export function getPendingIncidentCount(): number {
  return priorityResponseQueue.size();
}

export function getIntakeBufferCount(): number {
  return intakeBuffer.length;
}

export function isDispatchingIncident(): boolean {
  return activeIncidentId !== undefined;
}

export function clearPendingQueue(): void {
  priorityResponseQueue.clear();
  intakeBuffer.splice(0, intakeBuffer.length);
  if (bufferWindow) {
    clearTimeout(bufferWindow);
    bufferWindow = undefined;
  }
  bufferWindowEndsAt = null;
  activeIncidentId = undefined;
  activeIncident = undefined;
  activeResponse = undefined;
  activeIncidentPendingResource = false;
  notifyStateListeners();
}
