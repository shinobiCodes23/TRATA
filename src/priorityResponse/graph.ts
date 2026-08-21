import { GraphEdge, GraphNode, GraphState, GraphMutationInput } from './types';

export const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const latA = toRadians(lat1);
  const latB = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(latA) * Math.cos(latB);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function buildGraphState(nodeMap: Record<string, GraphNode>, adjacency: Record<string, GraphEdge[]>, governmentCenters: string[]): GraphState {
  return {
    nodeMap,
    adjacency,
    governmentCenters,
  };
}

export function cloneGraphState(graph: GraphState): GraphState {
  return {
    nodeMap: { ...graph.nodeMap },
    adjacency: Object.fromEntries(Object.entries(graph.adjacency).map(([nodeId, edges]) => [nodeId, [...edges]])),
    governmentCenters: [...graph.governmentCenters],
  };
}

export function addSymmetricEdge(graph: GraphState, nodeA: string, nodeB: string, distance: number, available = true): void {
  const edgeA: GraphEdge = { neighborId: nodeB, distance, available };
  const edgeB: GraphEdge = { neighborId: nodeA, distance, available };
  graph.adjacency[nodeA] = [...(graph.adjacency[nodeA] || []), edgeA];
  graph.adjacency[nodeB] = [...(graph.adjacency[nodeB] || []), edgeB];
}

export function ensureGraphNode(graph: GraphState, node: GraphNode): void {
  if (!graph.nodeMap[node.nodeId]) {
    graph.nodeMap[node.nodeId] = node;
    graph.adjacency[node.nodeId] = graph.adjacency[node.nodeId] || [];
  }
}

export function findNearestNode(graph: GraphState, lat: number, lon: number): string | null {
  let nearestNodeId: string | null = null;
  let nearestDistance: number | null = null;

  for (const [nodeId, node] of Object.entries(graph.nodeMap)) {
    const distance = haversineDistanceKm(lat, lon, node.lat, node.lon);
    if (nearestDistance === null || distance < nearestDistance) {
      nearestDistance = distance;
      nearestNodeId = nodeId;
    }
  }

  return nearestNodeId;
}

export function toggleEdgeAvailabilityByCoordinates(graph: GraphState, lat: number, lon: number, available: boolean): void {
  const targetNodeId = findNearestNode(graph, lat, lon);
  if (!targetNodeId) {
    return;
  }

  for (const [nodeId, edges] of Object.entries(graph.adjacency)) {
    for (const edge of edges) {
      if (edge.neighborId === targetNodeId) {
        edge.available = available;
      }
    }
  }

  const targetEdges = graph.adjacency[targetNodeId] || [];
  for (const edge of targetEdges) {
    edge.available = available;
  }
}

export function applyBlockedOrRecoveredCoordinates(graph: GraphState, coordinates: GraphMutationInput[]): void {
  for (const coordinate of coordinates) {
    toggleEdgeAvailabilityByCoordinates(graph, coordinate.lat, coordinate.lon, coordinate.available);
  }
}

/** Returns whether a coordinate lies inside a risk-engine supplied polygon. */
function isInsidePolygon(lat: number, lon: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latA, lonA] = polygon[i];
    const [latB, lonB] = polygon[j];
    const intersects = ((lonA > lon) !== (lonB > lon))
      && lat < ((latB - latA) * (lon - lonA)) / (lonB - lonA) + latA;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Applies only critical risk-engine areas to network availability. Nodes are
 * never removed; recovery restores their incident edges on the next update.
 */
export function applyCriticalRiskAreas(
  graph: GraphState,
  criticalAreas: Array<{ polygon: [number, number][]; riskTier: string }>,
): string[] {
  const affected = new Set(Object.values(graph.nodeMap)
    .filter((node) => criticalAreas.some((area) => area.riskTier === 'critical' && isInsidePolygon(node.lat, node.lon, area.polygon)))
    .map((node) => node.nodeId));

  for (const [nodeId, edges] of Object.entries(graph.adjacency)) {
    for (const edge of edges) {
      edge.available = !affected.has(nodeId) && !affected.has(edge.neighborId);
    }
  }
  return [...affected];
}

export function isGovernmentCenter(graph: GraphState, nodeId: string): boolean {
  return graph.governmentCenters.includes(nodeId);
}

export function getNodeIdForLocation(graph: GraphState, lat: number, lon: number): string | null {
  return findNearestNode(graph, lat, lon);
}

export function getAvailableNeighbors(graph: GraphState, nodeId: string): GraphEdge[] {
  return (graph.adjacency[nodeId] || []).filter((edge) => edge.available);
}
