import { GraphNode, GraphState } from './types';
import { buildGraphState, haversineDistanceKm, addSymmetricEdge, ensureGraphNode } from './graph';

const nodeMap: Record<string, GraphNode> = {};

// Geographic labels are presentation metadata for the deterministic prototype
// network. Stable node IDs remain the routing contract.
const NODE_DISPLAY_NAMES: Record<string, string> = {
  's-01': 'Namkhana', 's-02': 'Fraserganj', 's-03': 'Bakkhali', 's-04': 'Henry Island', 's-05': 'Sagar Island',
  's-06': 'Kakdwip', 's-07': 'Patharpratima', 's-08': 'Ramganga', 's-09': 'L-Plot', 's-10': 'Raidighi',
  's-11': 'Kultali', 's-12': 'Basanti', 's-13': 'Gosaba', 's-14': 'Satjelia', 's-15': 'Pakhiralay',
  's-16': 'Dayapur', 's-17': 'Jamespur', 's-18': 'Jharkhali', 's-19': 'Chandpal', 's-20': 'Hatganj',
  's-21': 'Beguakhali', 's-22': 'Chemaguri', 's-23': 'Harwood Point', 's-24': 'Ganeshnagar', 's-25': 'Herobhanga',
  's-26': 'G-Plot', 's-27': 'Debnagar', 's-28': 'Nagendrapur', 's-29': 'Maipith', 's-30': 'Deulbari',
  's-31': 'Canning', 's-32': 'Sonakhali', 's-33': 'Rangabelia', 's-34': 'Bali Island', 's-35': 'Sajnekhali',
  's-36': 'Dobanki', 's-37': 'Netidhopani', 's-38': 'Sudhanyakhali', 's-39': 'Kumirmari', 's-40': 'Lahiripur',
  's-41': 'Mousuni Island', 's-42': 'Daksin Gopalnagar', 's-43': 'Ghoramara', 's-44': 'Kachuberia', 's-45': 'Rudranagar',
  's-46': 'Dhablat', 's-47': 'Kalas Island', 's-48': 'Chotomollakhali', 's-49': 'Dulki', 's-50': 'Bidyadhari Bank',
  'g-01': 'G-01 — Delta Response Center (Prototype)',
  'g-02': 'G-02 — Tidal Response Center (Prototype)',
  'g-03': 'G-03 — Sundarbans Response Center (Prototype)',
  'g-04': 'G-04 — Western Response Center (Prototype)',
  'g-05': 'G-05 — Northern Response Center (Prototype)',
};

const locationNodes = [
  ['s-01', 22.120, 88.440, 'LOCATION'],
  ['s-02', 22.132, 88.470, 'LOCATION'],
  ['s-03', 22.146, 88.495, 'LOCATION'],
  ['s-04', 22.160, 88.520, 'LOCATION'],
  ['s-05', 22.175, 88.545, 'LOCATION'],
  ['s-06', 22.188, 88.580, 'LOCATION'],
  ['s-07', 22.205, 88.610, 'LOCATION'],
  ['s-08', 22.220, 88.640, 'LOCATION'],
  ['s-09', 22.248, 88.685, 'LOCATION'],
  ['s-10', 22.280, 88.715, 'LOCATION'],
  ['s-11', 22.300, 88.760, 'LOCATION'],
  ['s-12', 22.315, 88.812, 'LOCATION'],
  ['s-13', 22.365, 88.838, 'LOCATION'],
  ['s-14', 22.390, 88.870, 'LOCATION'],
  ['s-15', 22.410, 88.905, 'LOCATION'],
  ['s-16', 22.445, 88.930, 'LOCATION'],
  ['s-17', 22.470, 88.965, 'LOCATION'],
  ['s-18', 22.495, 88.998, 'LOCATION'],
  ['s-19', 22.126, 88.455, 'LOCATION'],
  ['s-20', 22.137, 88.480, 'LOCATION'],
  ['s-21', 22.151, 88.505, 'LOCATION'],
  ['s-22', 22.166, 88.532, 'LOCATION'],
  ['s-23', 22.181, 88.558, 'LOCATION'],
  ['s-24', 22.194, 88.593, 'LOCATION'],
  ['s-25', 22.212, 88.622, 'LOCATION'],
  ['s-26', 22.228, 88.654, 'LOCATION'],
  ['s-27', 22.238, 88.672, 'LOCATION'],
  ['s-28', 22.258, 88.697, 'LOCATION'],
  ['s-29', 22.272, 88.730, 'LOCATION'],
  ['s-30', 22.289, 88.742, 'LOCATION'],
  ['s-31', 22.307, 88.780, 'LOCATION'],
  ['s-32', 22.325, 88.801, 'LOCATION'],
  ['s-33', 22.340, 88.825, 'LOCATION'],
  ['s-34', 22.374, 88.850, 'LOCATION'],
  ['s-35', 22.382, 88.858, 'LOCATION'],
  ['s-36', 22.400, 88.886, 'LOCATION'],
  ['s-37', 22.425, 88.914, 'LOCATION'],
  ['s-38', 22.435, 88.920, 'LOCATION'],
  ['s-39', 22.458, 88.945, 'LOCATION'],
  ['s-40', 22.480, 88.980, 'LOCATION'],
  ['s-41', 22.150, 88.460, 'LOCATION'],
  ['s-42', 22.176, 88.500, 'LOCATION'],
  ['s-43', 22.202, 88.548, 'LOCATION'],
  ['s-44', 22.232, 88.592, 'LOCATION'],
  ['s-45', 22.260, 88.640, 'LOCATION'],
  ['s-46', 22.290, 88.690, 'LOCATION'],
  ['s-47', 22.322, 88.740, 'LOCATION'],
  ['s-48', 22.350, 88.790, 'LOCATION'],
  ['s-49', 22.390, 88.830, 'LOCATION'],
  ['s-50', 22.430, 88.875, 'LOCATION'],
  ['g-01', 22.530, 88.420, 'GOVERNMENT_CENTER'],
  ['g-02', 22.515, 88.770, 'GOVERNMENT_CENTER'],
  ['g-03', 22.355, 88.950, 'GOVERNMENT_CENTER'],
  ['g-04', 22.210, 88.300, 'GOVERNMENT_CENTER'],
  ['g-05', 22.650, 88.620, 'GOVERNMENT_CENTER'],
] as const;

for (const [id, lat, lon, type] of locationNodes) {
  const displayName = NODE_DISPLAY_NAMES[id];
  ensureGraphNode({ nodeMap, adjacency: {}, governmentCenters: [] } as GraphState, { nodeId: id, displayName, lat, lon, type });
  nodeMap[id] = { nodeId: id, displayName, lat, lon, type };
}

export const SUNDARBANS_GRAPH_NODES: Record<string, GraphNode> = Object.fromEntries(
  Object.entries(nodeMap).map(([nodeId, node]) => [nodeId, { ...node }])
);

export const GOVERNMENT_CENTER_IDS = ['g-01', 'g-02', 'g-03', 'g-04', 'g-05'];

const adjacency: Record<string, any[]> = Object.fromEntries(
  Object.keys(SUNDARBANS_GRAPH_NODES).map((nodeId) => [nodeId, []])
);

const edges = [
  ['s-01', 's-02'], ['s-02', 's-03'], ['s-03', 's-04'], ['s-04', 's-05'], ['s-05', 's-06'], ['s-06', 's-07'], ['s-07', 's-08'], ['s-08', 's-09'], ['s-09', 's-10'], ['s-10', 's-11'], ['s-11', 's-12'], ['s-12', 's-13'], ['s-13', 's-14'], ['s-14', 's-15'], ['s-15', 's-16'], ['s-16', 's-17'], ['s-17', 's-18'],
  ['s-01', 'g-04'], ['s-02', 'g-04'], ['s-03', 'g-04'],
  ['s-04', 'g-01'], ['s-05', 'g-01'], ['s-06', 'g-02'], ['s-07', 'g-02'], ['s-08', 'g-02'],
  ['s-09', 'g-02'], ['s-10', 'g-03'], ['s-11', 'g-03'], ['s-12', 'g-03'], ['s-13', 'g-03'], ['s-14', 'g-03'], ['s-15', 'g-05'], ['s-16', 'g-05'], ['s-17', 'g-05'], ['s-18', 'g-05'],
  ['s-03', 's-06'], ['s-04', 's-07'], ['s-08', 's-11'], ['s-10', 's-13'], ['s-13', 's-16'], ['s-15', 's-18'],
  ['g-01', 'g-02'], ['g-02', 'g-03'], ['g-03', 'g-05'], ['g-05', 'g-01'],
  ['s-01', 's-19'], ['s-19', 's-20'], ['s-20', 's-21'], ['s-21', 's-22'], ['s-22', 's-23'], ['s-23', 's-24'], ['s-24', 's-25'], ['s-25', 's-26'],
  ['s-26', 's-27'], ['s-27', 's-28'], ['s-28', 's-29'], ['s-29', 's-30'], ['s-30', 's-31'], ['s-31', 's-32'], ['s-32', 's-33'], ['s-33', 's-34'],
  ['s-34', 's-35'], ['s-35', 's-36'], ['s-36', 's-37'], ['s-37', 's-38'], ['s-38', 's-39'], ['s-39', 's-40'], ['s-40', 's-18'],
  ['s-19', 's-02'], ['s-20', 's-03'], ['s-21', 's-04'], ['s-22', 's-05'], ['s-23', 's-06'], ['s-24', 's-07'], ['s-25', 's-08'], ['s-26', 's-09'],
  ['s-28', 's-10'], ['s-29', 's-11'], ['s-30', 's-12'], ['s-31', 's-13'], ['s-32', 's-13'], ['s-33', 's-14'], ['s-34', 's-14'], ['s-35', 's-15'],
  ['s-36', 's-15'], ['s-37', 's-16'], ['s-38', 's-16'], ['s-39', 's-17'], ['s-40', 's-17'],
  ['s-19', 's-41'], ['s-41', 's-42'], ['s-42', 's-43'], ['s-43', 's-44'], ['s-44', 's-45'], ['s-45', 's-46'], ['s-46', 's-47'], ['s-47', 's-48'], ['s-48', 's-49'], ['s-49', 's-50'], ['s-50', 's-37'],
  ['s-41', 's-03'], ['s-42', 's-05'], ['s-43', 's-06'], ['s-44', 's-08'], ['s-45', 's-09'], ['s-46', 's-10'], ['s-47', 's-12'], ['s-48', 's-13'], ['s-49', 's-14'], ['s-50', 's-16'],
];

for (const [fromId, toId] of edges) {
  const fromNode = SUNDARBANS_GRAPH_NODES[fromId];
  const toNode = SUNDARBANS_GRAPH_NODES[toId];
  if (!fromNode || !toNode) continue;
  const distance = haversineDistanceKm(fromNode.lat, fromNode.lon, toNode.lat, toNode.lon);
  addSymmetricEdge({ nodeMap: SUNDARBANS_GRAPH_NODES, adjacency, governmentCenters: GOVERNMENT_CENTER_IDS } as GraphState, fromId, toId, distance, true);
}

export const SUNDARBANS_GRAPH: GraphState = buildGraphState(SUNDARBANS_GRAPH_NODES, adjacency, GOVERNMENT_CENTER_IDS);
