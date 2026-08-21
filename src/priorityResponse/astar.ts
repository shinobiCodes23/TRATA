import { GraphState, ResponseResult } from './types';
import { haversineDistanceKm, getAvailableNeighbors } from './graph';

export interface PathResult {
  path: string[];
  distance: number;
}

export function astarShortestPath(graph: GraphState, startNodeId: string, targetNodeId: string): PathResult | null {
  if (!graph.nodeMap[startNodeId] || !graph.nodeMap[targetNodeId]) {
    return null;
  }

  if (startNodeId === targetNodeId) {
    return { path: [startNodeId], distance: 0 };
  }

  const openSet = new Map<string, number>();
  const cameFrom = new Map<string, string | null>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  gScore.set(startNodeId, 0);
  fScore.set(startNodeId, haversineDistanceKm(
    graph.nodeMap[startNodeId].lat,
    graph.nodeMap[startNodeId].lon,
    graph.nodeMap[targetNodeId].lat,
    graph.nodeMap[targetNodeId].lon,
  ));
  openSet.set(startNodeId, fScore.get(startNodeId)!);

  while (openSet.size > 0) {
    const [currentNodeId, currentScore] = [...openSet.entries()].sort((a, b) => a[1] - b[1])[0];
    openSet.delete(currentNodeId);

    if (currentNodeId === targetNodeId) {
      const path: string[] = [];
      let cursor: string | null = currentNodeId;
      while (cursor) {
        path.push(cursor);
        cursor = cameFrom.get(cursor) || null;
      }
      path.reverse();

      return {
        path,
        distance: gScore.get(currentNodeId) ?? 0,
      };
    }

    for (const edge of getAvailableNeighbors(graph, currentNodeId)) {
      const neighborId = edge.neighborId;
      const tentativeG = (gScore.get(currentNodeId) ?? Infinity) + edge.distance;
      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, currentNodeId);
        gScore.set(neighborId, tentativeG);
        const estimated = tentativeG + haversineDistanceKm(
          graph.nodeMap[neighborId].lat,
          graph.nodeMap[neighborId].lon,
          graph.nodeMap[targetNodeId].lat,
          graph.nodeMap[targetNodeId].lon,
        );
        fScore.set(neighborId, estimated);
        openSet.set(neighborId, estimated);
      }
    }
  }

  return null;
}

export function selectBestGovernmentCenterRoute(
  graph: GraphState,
  startNodeId: string,
  governmentCenterIds: string[]
): { centerId: string | null; path: string[]; distance: number | null } {
  let bestCenterId: string | null = null;
  let bestPath: string[] = [];
  let bestDistance: number | null = null;

  for (const centerId of governmentCenterIds) {
    if (!graph.nodeMap[centerId]) continue;
    const route = astarShortestPath(graph, startNodeId, centerId);
    if (!route) continue;

    if (bestDistance === null || route.distance < bestDistance) {
      bestCenterId = centerId;
      bestPath = route.path;
      bestDistance = route.distance;
    }
  }

  return {
    centerId: bestCenterId,
    path: bestPath,
    distance: bestDistance,
  };
}
