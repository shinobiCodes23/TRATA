import { afterEach, describe, expect, it, vi } from 'vitest';

import { PriorityQueue } from '../priorityQueue';
import { SUNDARBANS_GRAPH } from '../graphData';
import { applyBlockedOrRecoveredCoordinates, applyCriticalRiskAreas, cloneGraphState, findNearestNode, haversineDistanceKm } from '../graph';
import { astarShortestPath, selectBestGovernmentCenterRoute } from '../astar';
import {
  clearPendingQueue,
  enqueueIncident,
  evaluateIncident,
  evaluateIncidentForCenters,
  getFeasibleGovernmentCenterRoutes,
  getIntakeBufferCount,
  getPendingIncidentCount,
  getPriorityResponseSnapshot,
  getRequiredPersonnel,
  isDispatchingIncident,
  isActiveIncidentPendingResource,
  PRIORITY_BUFFER_WINDOW_MS,
  releaseActiveIncident,
  retryActiveIncident,
  setActiveIncidentPendingResource,
  subscribeToResponses,
} from '../responseEngine';

afterEach(() => {
  clearPendingQueue();
  vi.useRealTimers();
});

describe('Step 4 priority response layer', () => {
  it('creates a symmetric undirected graph with consistent edge distances', () => {
    const from = SUNDARBANS_GRAPH.adjacency['s-01'];
    const neighbor = from.find((edge) => edge.neighborId === 's-02');
    expect(neighbor).toBeDefined();
    const reverse = SUNDARBANS_GRAPH.adjacency['s-02'].find((edge) => edge.neighborId === 's-01');
    expect(reverse).toBeDefined();
    expect(reverse?.distance).toBeCloseTo(neighbor!.distance, 6);
    expect(reverse?.available).toBe(true);
  });

  it('keeps the complete named 50-location, 5-center Sundarbans graph contract', () => {
    const nodes = Object.values(SUNDARBANS_GRAPH.nodeMap);
    const locationNodes = nodes.filter((node) => node.type === 'LOCATION');
    const governmentCenters = nodes.filter((node) => node.type === 'GOVERNMENT_CENTER');

    expect(nodes).toHaveLength(55);
    expect(locationNodes).toHaveLength(50);
    expect(governmentCenters).toHaveLength(5);
    expect(new Set(nodes.map((node) => node.nodeId)).size).toBe(55);
    expect(nodes.every((node) => node.displayName.trim().length > 0)).toBe(true);
    expect(nodes.every((node) => Number.isFinite(node.lat) && Number.isFinite(node.lon))).toBe(true);
  });

  it('keeps every graph edge valid, unique, and symmetric', () => {
    const directedEdges = Object.entries(SUNDARBANS_GRAPH.adjacency).flatMap(([fromId, edges]) =>
      edges.map((edge) => ({ fromId, ...edge }))
    );

    expect(new Set(directedEdges.map((edge) => `${edge.fromId}|${edge.neighborId}`)).size).toBe(directedEdges.length);
    directedEdges.forEach((edge) => {
      expect(SUNDARBANS_GRAPH.nodeMap[edge.fromId]).toBeDefined();
      expect(SUNDARBANS_GRAPH.nodeMap[edge.neighborId]).toBeDefined();
      expect(edge.fromId).not.toBe(edge.neighborId);
      const reverse = SUNDARBANS_GRAPH.adjacency[edge.neighborId].find((candidate) => candidate.neighborId === edge.fromId);
      expect(reverse?.distance).toBeCloseTo(edge.distance, 6);
      expect(reverse?.available).toBe(edge.available);
    });
  });

  it('orders multiple incidents by descending priority with deterministic tie-breaks', () => {
    const queue = new PriorityQueue();
    queue.enqueue({ incidentId: 'b', priorityScore: 71, location: { lat: 22.2, lng: 88.5 } });
    queue.enqueue({ incidentId: 'a', priorityScore: 92, location: { lat: 22.1, lng: 88.4 } });
    queue.enqueue({ incidentId: 'c', priorityScore: 87, location: { lat: 22.3, lng: 88.7 } });

    expect(queue.peek()?.incidentId).toBe('a');
    expect(queue.dequeue()?.incidentId).toBe('a');
    expect(queue.dequeue()?.incidentId).toBe('c');
    expect(queue.dequeue()?.incidentId).toBe('b');
  });

  it('buffers the initial intake window, then dispatches incidents by priority', async () => {
    vi.useFakeTimers();
    const dispatched: string[] = [];
    const unsubscribe = subscribeToResponses((response) => {
      dispatched.push(response.incidentId);
      releaseActiveIncident();
    });

    enqueueIncident({ incidentId: 'b', priorityScore: 71, location: { lat: 22.2, lng: 88.5 } });
    enqueueIncident({ incidentId: 'a', priorityScore: 92, location: { lat: 22.1, lng: 88.4 } });
    enqueueIncident({ incidentId: 'c', priorityScore: 87, location: { lat: 22.3, lng: 88.7 } });

    expect(getIntakeBufferCount()).toBe(3);
    expect(getPendingIncidentCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(PRIORITY_BUFFER_WINDOW_MS);

    expect(dispatched).toEqual(['a', 'c', 'b']);
    expect(getIntakeBufferCount()).toBe(0);
    expect(getPendingIncidentCount()).toBe(0);
    expect(isDispatchingIncident()).toBe(false);
    unsubscribe();
  });

  it('keeps the active dispatch non-preemptive and flushes arrivals before the next dispatch', async () => {
    vi.useFakeTimers();
    const dispatched: string[] = [];
    const unsubscribe = subscribeToResponses((response) => {
      dispatched.push(response.incidentId);
      if (response.incidentId === 'a') {
        enqueueIncident({ incidentId: 'b', priorityScore: 60, location: { lat: 22.2, lng: 88.5 } });
        enqueueIncident({ incidentId: 'c', priorityScore: 100, location: { lat: 22.3, lng: 88.7 } });
        enqueueIncident({ incidentId: 'd', priorityScore: 75, location: { lat: 22.4, lng: 88.8 } });
      }
      releaseActiveIncident();
    });

    enqueueIncident({ incidentId: 'a', priorityScore: 90, location: { lat: 22.1, lng: 88.4 } });
    await vi.advanceTimersByTimeAsync(PRIORITY_BUFFER_WINDOW_MS);

    expect(dispatched).toEqual(['a', 'c', 'd', 'b']);
    expect(getIntakeBufferCount()).toBe(0);
    expect(getPendingIncidentCount()).toBe(0);
    expect(isDispatchingIncident()).toBe(false);
    unsubscribe();
  });

  it('returns to idle and starts a fresh buffer cycle for later incidents', async () => {
    vi.useFakeTimers();
    const dispatched: string[] = [];
    const unsubscribe = subscribeToResponses((response) => {
      dispatched.push(response.incidentId);
      releaseActiveIncident();
    });

    enqueueIncident({ incidentId: 'first', priorityScore: 80, location: { lat: 22.1, lng: 88.4 } });
    await vi.advanceTimersByTimeAsync(PRIORITY_BUFFER_WINDOW_MS);

    expect(dispatched).toEqual(['first']);
    expect(getIntakeBufferCount()).toBe(0);
    expect(getPendingIncidentCount()).toBe(0);
    expect(isDispatchingIncident()).toBe(false);

    enqueueIncident({ incidentId: 'second', priorityScore: 70, location: { lat: 22.2, lng: 88.5 } });
    expect(getIntakeBufferCount()).toBe(1);
    expect(dispatched).toEqual(['first']);
    await vi.advanceTimersByTimeAsync(PRIORITY_BUFFER_WINDOW_MS);

    expect(dispatched).toEqual(['first', 'second']);
    expect(getIntakeBufferCount()).toBe(0);
    expect(getPendingIncidentCount()).toBe(0);
    unsubscribe();
  });

  it('resolves coordinates to the nearest graph node via Haversine matching', () => {
    const nearest = findNearestNode(SUNDARBANS_GRAPH, 22.131, 88.470);
    expect(nearest).toBe('s-02');
    expect(haversineDistanceKm(22.131, 88.470, SUNDARBANS_GRAPH.nodeMap[nearest!].lat, SUNDARBANS_GRAPH.nodeMap[nearest!].lon)).toBeLessThan(2);
  });

  it('blocks and restores graph edges without destroying the original distance', () => {
    const graph = cloneGraphState(SUNDARBANS_GRAPH);
    const edgeBefore = graph.adjacency['s-01'].find((e) => e.neighborId === 's-02');
    const originalDistance = edgeBefore?.distance;

    applyBlockedOrRecoveredCoordinates(graph, [{ lat: 22.120, lon: 88.440, available: false }]);
    const blockedEdge = graph.adjacency['s-01'].find((e) => e.neighborId === 's-02');
    expect(blockedEdge?.available).toBe(false);

    applyBlockedOrRecoveredCoordinates(graph, [{ lat: 22.120, lon: 88.440, available: true }]);
    const restoredEdge = graph.adjacency['s-01'].find((e) => e.neighborId === 's-02');
    expect(restoredEdge?.available).toBe(true);
    expect(restoredEdge?.distance).toBe(originalDistance);
  });

  it('changes availability only for nodes inside critical risk-engine areas and restores them on recovery', () => {
    const graph = cloneGraphState(SUNDARBANS_GRAPH);
    const affected = applyCriticalRiskAreas(graph, [{
      riskTier: 'critical',
      polygon: [[22.11, 88.43], [22.11, 88.48], [22.14, 88.48], [22.14, 88.43]],
    }]);
    expect(affected).toContain('s-01');
    expect(graph.adjacency['s-01'].every((edge) => !edge.available)).toBe(true);
    expect(graph.adjacency['s-18'].some((edge) => edge.available)).toBe(true);

    applyCriticalRiskAreas(graph, []);
    expect(graph.adjacency['s-01'].every((edge) => edge.available)).toBe(true);
  });

  it('finds the shortest path with A* and reconstructs the route', () => {
    const graph = cloneGraphState(SUNDARBANS_GRAPH);
    const path = astarShortestPath(graph, 's-01', 'g-01');
    expect(path).not.toBeNull();
    expect(path?.path[0]).toBe('s-01');
    expect(path?.path[path.path.length - 1]).toBe('g-01');
    expect(path?.distance).toBeGreaterThan(0);
  });

  it('selects the minimum-distance reachable government center for each incident', () => {
    const graph = cloneGraphState(SUNDARBANS_GRAPH);
    const selection = selectBestGovernmentCenterRoute(graph, 's-18', ['g-01', 'g-02', 'g-03', 'g-04', 'g-05']);
    expect(selection.centerId).toBe('g-03');
    expect(selection.distance).not.toBeNull();
    expect(selection.path.length).toBeGreaterThan(1);
  });

  it('uses A* to fall back to the best available center when the nearest fleet is busy', () => {
    const normal = evaluateIncident({
      incidentId: 'fallback-normal', priorityScore: 90, location: { lat: 22.325, lng: 88.615 },
    });
    expect(normal.status).toBe('ROUTE_FOUND');

    const fallback = evaluateIncidentForCenters({
      incidentId: 'fallback-available', priorityScore: 90, location: { lat: 22.325, lng: 88.615 },
    }, ['g-01', 'g-02', 'g-03', 'g-04', 'g-05'].filter((centerId) => centerId !== normal.selectedCenterId));

    expect(fallback.status).toBe('ROUTE_FOUND');
    expect(fallback.selectedCenterId).not.toBe(normal.selectedCenterId);
    expect(fallback.selectedCenterId).not.toBeNull();
    expect(fallback.distance).not.toBeNull();

    const rankedRoutes = getFeasibleGovernmentCenterRoutes({
      incidentId: 'fallback-ranked', priorityScore: 90, location: { lat: 22.325, lng: 88.615 },
    });
    expect(rankedRoutes[0]?.selectedCenterId).toBe(normal.selectedCenterId);
    expect(rankedRoutes.every((route, index) => index === 0 || route.distance! >= rankedRoutes[index - 1].distance!)).toBe(true);
  });

  it('re-evaluates a held incident against current graph availability on retry', async () => {
    vi.useFakeTimers();
    const responses: string[] = [];
    const availability = Object.fromEntries(Object.entries(SUNDARBANS_GRAPH.adjacency).map(([nodeId, edges]) => [
      nodeId,
      edges.map((edge) => edge.available),
    ]));
    const unsubscribe = subscribeToResponses((response) => responses.push(response.status));

    try {
      enqueueIncident({ incidentId: 'reroute-check', priorityScore: 90, location: { lat: 22.135, lng: 88.473 } });
      await vi.advanceTimersByTimeAsync(PRIORITY_BUFFER_WINDOW_MS);
      expect(responses.at(-1)).toBe('ROUTE_FOUND');

      Object.values(SUNDARBANS_GRAPH.adjacency).forEach((edges) => edges.forEach((edge) => { edge.available = false; }));
      retryActiveIncident();
      expect(responses.at(-1)).toBe('NO_FEASIBLE_ROUTE');
    } finally {
      Object.entries(SUNDARBANS_GRAPH.adjacency).forEach(([nodeId, edges]) => edges.forEach((edge, index) => {
        edge.available = availability[nodeId][index];
      }));
      unsubscribe();
    }
  });

  it('keeps a no-fleet queue head active for recovery retry instead of dropping it', async () => {
    vi.useFakeTimers();
    const dispatched: string[] = [];
    const unsubscribe = subscribeToResponses((response) => dispatched.push(response.incidentId));

    enqueueIncident({ incidentId: 'resource-pending', priorityScore: 90, location: { lat: 22.135, lng: 88.473 } });
    await vi.advanceTimersByTimeAsync(PRIORITY_BUFFER_WINDOW_MS);
    setActiveIncidentPendingResource(true);

    expect(isActiveIncidentPendingResource()).toBe(true);
    expect(getPriorityResponseSnapshot().activeIncidentId).toBe('resource-pending');
    expect(getPendingIncidentCount()).toBe(0);

    retryActiveIncident();
    expect(dispatched).toEqual(['resource-pending', 'resource-pending']);
    expect(getPriorityResponseSnapshot().activeIncidentId).toBe('resource-pending');
    unsubscribe();
  });

  it('uses the exact resource thresholds from the Step 4 architecture', () => {
    expect(getRequiredPersonnel(100)).toBe(10);
    expect(getRequiredPersonnel(80)).toBe(10);
    expect(getRequiredPersonnel(79)).toBe(8);
    expect(getRequiredPersonnel(65)).toBe(8);
    expect(getRequiredPersonnel(64)).toBe(6);
    expect(getRequiredPersonnel(45)).toBe(6);
    expect(getRequiredPersonnel(44)).toBe(4);
  });

  it('returns a typed response result for a valid incident and NO_FEASIBLE_ROUTE for invalid input', () => {
    const valid = evaluateIncident({
      incidentId: 'incident-valid',
      priorityScore: 92,
      location: { lat: 22.135, lng: 88.473, address: 'S-02 area' },
      category: 'trapped_civilians',
      trappedCount: 5,
    });

    expect(valid.status).toBe('ROUTE_FOUND');
    expect(valid.originNodeId).toBe('s-02');
    expect(valid.selectedCenterId).not.toBeNull();
    expect(valid.requiredPersonnel).toBe(10);

    const invalid = evaluateIncident({
      incidentId: 'incident-invalid',
      priorityScore: 50,
      location: { lat: Number.NaN, lng: 88.4 },
    });

    expect(invalid.status).toBe('INVALID_INPUT');
    expect(invalid.selectedCenterId).toBeNull();
  });
});
