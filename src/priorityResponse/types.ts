export type NodeType = 'LOCATION' | 'GOVERNMENT_CENTER';
export type ResponseStatus = 'ROUTE_FOUND' | 'NO_FEASIBLE_ROUTE' | 'INVALID_INPUT';

export interface GeoCoord {
  lat: number;
  lon: number;
}

export interface GraphNode {
  nodeId: string;
  displayName: string;
  lat: number;
  lon: number;
  type: NodeType;
}

export interface GraphEdge {
  neighborId: string;
  distance: number;
  available: boolean;
}

export interface GraphState {
  nodeMap: Record<string, GraphNode>;
  adjacency: Record<string, GraphEdge[]>;
  governmentCenters: string[];
}

export interface PriorityIncidentInput {
  incidentId: string;
  priorityScore: number;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  category?: string;
  trappedCount?: number;
  status?: string;
}

export interface PriorityQueueEntry extends PriorityIncidentInput {
  arrivalSequence: number;
}

export interface ResponseResult {
  incidentId: string;
  priorityScore: number;
  requiredPersonnel: number;
  /** The graph node selected from the incident's real-world coordinates. */
  originNodeId: string | null;
  selectedCenterId: string | null;
  path: string[];
  distance: number | null;
  status: ResponseStatus;
}

export interface InvalidResponse extends ResponseResult {
  status: 'INVALID_INPUT';
  selectedCenterId: null;
  path: [];
  distance: null;
}

export interface GraphMutationInput {
  lat: number;
  lon: number;
  available: boolean;
}
