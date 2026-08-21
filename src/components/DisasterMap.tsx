import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Layers,
  MapPin,
  AlertTriangle,
  Home,
  Radio,
  Crosshair,
  Droplets,
  Mountain,
  Navigation,
  ShieldCheck,
  Zap,
  Phone,
  Heart,
  Dog,
  Users,
  Compass,
  ArrowUpRight,
  Clock,
  Battery,
  Activity,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import {
  CitizenReport,
  GeoLocation,
  HazardZone,
  IoTSensor,
  RescueUnit,
  RiskAnalysisResult,
  Shelter,
  SimulationState,
} from '../types';
import { assessLocationRisk } from '../utils/riskCalculators';
import { RegionProfile } from '../types';
import { REGIONS } from '../data/disasterData';
import { SUNDARBANS_GRAPH } from '../priorityResponse/graphData';
import { ResponseResult } from '../priorityResponse/types';
import { findNearestNode, haversineDistanceKm } from '../priorityResponse/graph';

const AVERAGE_RESPONSE_SPEED_KMH = 30;
const sundarbansNodeCoordinates = Object.values(SUNDARBANS_GRAPH.nodeMap).map((node) => [node.lat, node.lon] as [number, number]);

function formatEta(distanceKm: number | null): string {
  if (distanceKm === null) return 'Unavailable';
  const minutes = Math.round((distanceKm / AVERAGE_RESPONSE_SPEED_KMH) * 60);
  return minutes < 60 ? `${minutes} minutes` : `${Math.floor(minutes / 60)} hour${minutes >= 120 ? 's' : ''} ${minutes % 60 ? `${minutes % 60} minutes` : ''}`.trim();
}

function compassDirection(fromId: string, toId: string): string {
  const from = SUNDARBANS_GRAPH.nodeMap[fromId];
  const to = SUNDARBANS_GRAPH.nodeMap[toId];
  if (!from || !to) return 'Continue';
  const angle = (Math.atan2(to.lon - from.lon, to.lat - from.lat) * 180 / Math.PI + 360) % 360;
  return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(angle / 45) % 8];
}

function routeDirectionsHtml(path: string[]): string {
  let cumulative = 0;
  return path.slice(1).map((toId, index) => {
    const fromId = path[index];
    const from = SUNDARBANS_GRAPH.nodeMap[fromId];
    const to = SUNDARBANS_GRAPH.nodeMap[toId];
    if (!from || !to) return '';
    const distance = haversineDistanceKm(from.lat, from.lon, to.lat, to.lon);
    cumulative += distance;
    return `<div>${index + 1}. ${from.displayName} → ${to.displayName}: ${distance.toFixed(2)} km ${compassDirection(fromId, toId)} (total ${cumulative.toFixed(2)} km)</div>`;
  }).join('');
}

interface DisasterMapProps {
  zones?: HazardZone[];
  hazardZones?: HazardZone[];
  sensors?: IoTSensor[];
  shelters?: Shelter[];
  reports?: CitizenReport[];
  units?: RescueUnit[];
  simState: SimulationState;
  selectedReport?: CitizenReport | null;
  selectedMapItem?: {
    type: 'zone' | 'sensor' | 'shelter' | 'report' | 'unit';
    data: any;
  } | null;
  onClearSelectedItem?: () => void;
  onSelectReport?: (report: CitizenReport | null) => void;
  onSelectSensor?: (sensor: IoTSensor | null) => void;
  onSelectShelter?: (shelter: Shelter | null) => void;
  currentRegion?: RegionProfile;
  step4Results?: Record<string, ResponseResult>;
  graphRevision?: number;
  onScanLocation?: (location: { lat: number; lng: number; address?: string }) => void;
  networkRiskSnapshots?: Record<string, { overall: number; flood: number; landslide: number; earthquake: number }>;
  selectedSeasonLabel?: string;
}

export const DisasterMap: React.FC<DisasterMapProps> = ({
  zones,
  hazardZones,
  sensors = [],
  shelters = [],
  reports = [],
  units = [],
  simState,
  selectedMapItem,
  onClearSelectedItem,
  onSelectReport,
  onSelectSensor,
  onSelectShelter,
  currentRegion = REGIONS[0],
  step4Results = {},
  graphRevision = 0,
  onScanLocation,
  networkRiskSnapshots = {},
  selectedSeasonLabel = 'Winter',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Layer Visibility Controls
  const [riskLayer, setRiskLayer] = useState<'overall' | 'flood' | 'landslide' | 'earthquake'>('overall');
  const [showReports, setShowReports] = useState(false);
  const [showSensors, setShowSensors] = useState(false);
  const [showShelters, setShowShelters] = useState(false);
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite' | 'street'>('dark');
  const [showStep4Graph, setShowStep4Graph] = useState(true);
  const [showGraphEdges, setShowGraphEdges] = useState(true);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);
  const [nodeSearch, setNodeSearch] = useState('');
  const [nodeFilter, setNodeFilter] = useState<'ALL' | 'LOCATION' | 'GOVERNMENT_CENTER' | 'BLOCKED' | 'DETACHED' | 'ACTIVE'>('ALL');

  const [userLocation, setUserLocation] = useState<GeoLocation | null>(null);
  const [hideFloatingCards, setHideFloatingCards] = useState(false);
  // Used only by the explicit Scan My Location action; empty-map clicks do not
  // create assessments or map messages.
  const [clickedAssessment, setClickedAssessment] = useState<RiskAnalysisResult | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [22.35, 88.72],
      zoom: 10,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;
    map.fitBounds(L.latLngBounds(sundarbansNodeCoordinates), { padding: [35, 35] });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Fly to region when selected region changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !currentRegion || showStep4Graph) return;
    map.flyTo(currentRegion.center, currentRegion.zoom, { duration: 1.2 });
  }, [currentRegion?.id, showStep4Graph]);

  // Fly to selected item (e.g. Shelter, Report, Sensor) when selectedMapItem changes
  useEffect(() => {
    if (!selectedMapItem || !mapInstanceRef.current) return;
    const { type, data } = selectedMapItem;

    if (type === 'shelter' && data?.location) {
      setShowShelters(true);
      mapInstanceRef.current.flyTo([data.location.lat, data.location.lng], 15, { duration: 1.2 });
    } else if (type === 'report' && data?.location) {
      setShowReports(true);
      mapInstanceRef.current.flyTo([data.location.lat, data.location.lng], 15, { duration: 1.2 });
    } else if (type === 'sensor' && data?.location) {
      setShowSensors(true);
      mapInstanceRef.current.flyTo([data.location.lat, data.location.lng], 15, { duration: 1.2 });
    } else if (type === 'zone' && data?.polygon?.[0]) {
      mapInstanceRef.current.flyTo(data.polygon[0], 14, { duration: 1.2 });
    }
  }, [selectedMapItem]);

  // Update Base Tile Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    let tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    let attribution = '&copy; OpenStreetMap &copy; CARTO';

    if (mapStyle === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = '&copy; Esri, Maxar, Earthstar';
    } else if (mapStyle === 'street') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; OpenStreetMap contributors';
    }

    L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);
  }, [mapStyle]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const selectedReport = selectedMapItem?.type === 'report' ? selectedMapItem.data as CitizenReport : null;
    const response = selectedReport ? step4Results[selectedReport.id] : undefined;
    if (!map || !selectedReport || response?.status !== 'ROUTE_FOUND') return;

    const routeCoordinates = response.path
      .map((nodeId) => SUNDARBANS_GRAPH.nodeMap[nodeId])
      .filter((node): node is NonNullable<typeof node> => Boolean(node))
      .map((node) => [node.lat, node.lon] as [number, number]);
    if (routeCoordinates.length === 0) return;

    map.fitBounds(L.latLngBounds([
      [selectedReport.location.lat, selectedReport.location.lng],
      ...routeCoordinates,
    ]), { padding: [45, 45], maxZoom: 13, duration: 0.8 });
  }, [selectedMapItem, step4Results]);

  // Render Overlays & Layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Complete Step 4 Sundarbans graph. Node identity and availability are
    // read from the authoritative graph; this layer performs no routing.
    const selectedReport = selectedMapItem?.type === 'report' ? selectedMapItem.data as CitizenReport : null;
    const activeRoute = selectedReport ? step4Results[selectedReport.id]?.path || [] : step4Results['scan-location']?.path || [];
    // Risk snapshots are provided by application state; the map only renders
    // them and never calculates or predicts risk itself.
    Object.values(SUNDARBANS_GRAPH.nodeMap).forEach((node) => {
      const snapshot = networkRiskSnapshots[node.nodeId];
      const score = snapshot?.[riskLayer] ?? 0;
      const color = score >= 80 ? '#ef4444' : score >= 60 ? '#f97316' : score >= 35 ? '#eab308' : '#22c55e';
      L.circle([node.lat, node.lon], { radius: 850, stroke: false, fillColor: color, fillOpacity: 0.28 + score / 320, interactive: false }).addTo(group);
    });
    if (showStep4Graph) {
      if (showGraphEdges) {
        const renderedEdges = new Set<string>();
        Object.entries(SUNDARBANS_GRAPH.adjacency).forEach(([fromId, edges]) => {
          edges.forEach((edge) => {
            const key = [fromId, edge.neighborId].sort().join('|');
            if (renderedEdges.has(key)) return;
            renderedEdges.add(key);
            const from = SUNDARBANS_GRAPH.nodeMap[fromId];
            const to = SUNDARBANS_GRAPH.nodeMap[edge.neighborId];
            if (!from || !to) return;
            const routeEdgeIndex = activeRoute.findIndex((nodeId, index) => index > 0 && ((activeRoute[index - 1] === fromId && nodeId === edge.neighborId) || (activeRoute[index - 1] === edge.neighborId && nodeId === fromId)));
            const routeStatus = routeEdgeIndex >= 0 ? 'ACTIVE A* ROUTE' : 'NORMAL';
            const roadPopup = `
              <div class="p-2 text-slate-900 font-sans text-xs min-w-[220px]">
                <strong>ROAD / GRAPH EDGE</strong>
                <div class="mt-1"><strong>From:</strong> ${from.displayName} (${fromId.toUpperCase()})</div>
                <div><strong>To:</strong> ${to.displayName} (${edge.neighborId.toUpperCase()})</div>
                <div><strong>Distance:</strong> ${edge.distance.toFixed(2)} km</div>
                <div><strong>Average response speed:</strong> ${AVERAGE_RESPONSE_SPEED_KMH} km/h</div>
                <div><strong>Estimated traversal:</strong> ${formatEta(edge.distance)}</div>
                <div><strong>Status:</strong> ${edge.available ? 'AVAILABLE' : 'BLOCKED'}</div>
                ${edge.available ? '' : '<div><strong>Reason:</strong> Critical risk simulation</div>'}
                <div><strong>Route status:</strong> ${routeStatus}</div>
              </div>`;
            const coordinates: [number, number][] = [[from.lat, from.lon], [to.lat, to.lon]];
            L.polyline(coordinates, {
              color: edge.available ? '#64748b' : '#ef4444',
              weight: routeEdgeIndex >= 0 ? 5 : edge.available ? 1.5 : 2,
              opacity: routeEdgeIndex >= 0 ? 0.9 : edge.available ? 0.42 : 0.7,
              dashArray: edge.available ? '3, 5' : '7, 5',
              interactive: false,
            }).addTo(group);
            // This SVG hit path has the identical endpoints as the one visible
            // road. It is deliberately near-transparent (rather than opacity 0)
            // so Leaflet/SVG reliably retains pointer events across its full span.
            const roadHitArea = L.polyline(coordinates, {
              color: '#000000', weight: 18, opacity: 0.01, interactive: true, className: 'priority-response-road-hit-area',
            }).addTo(group).bindPopup(roadPopup);
            roadHitArea.on('click', () => roadHitArea.openPopup());
          });
        });
      }

      Object.values(SUNDARBANS_GRAPH.nodeMap).forEach((node) => {
        const edges = SUNDARBANS_GRAPH.adjacency[node.nodeId] || [];
        const availableConnections = edges.filter((edge) => edge.available).length;
        const unavailableConnections = edges.length - availableConnections;
        const connectivity = availableConnections === 0 ? 'FULLY DETACHED' : unavailableConnections > 0 ? 'PARTIALLY BLOCKED' : 'CONNECTED';
        const onActiveRoute = activeRoute.includes(node.nodeId);
        const isCenter = node.type === 'GOVERNMENT_CENTER';
        const color = isCenter ? '#a855f7' : connectivity === 'FULLY DETACHED' ? '#ef4444' : connectivity === 'PARTIALLY BLOCKED' ? '#f59e0b' : '#38bdf8';
        const marker = L.circleMarker([node.lat, node.lon], {
          radius: isCenter ? 8 : onActiveRoute ? 7 : 5,
          color: onActiveRoute ? '#f8fafc' : color,
          weight: onActiveRoute ? 3 : 2,
          fillColor: onActiveRoute ? '#22d3ee' : color,
          fillOpacity: isCenter ? 0.95 : 0.8,
        }).addTo(group);
        marker.bindPopup(`
          <div class="p-2 text-slate-900 font-sans text-xs min-w-[210px]">
            <strong>${node.displayName}</strong>
            <div class="mt-1 text-slate-600">${node.nodeId.toUpperCase()} · ${node.type.replace('_', ' ')}</div>
            <div class="mt-2 space-y-1">
              <div>GPS: ${node.lat.toFixed(4)}, ${node.lon.toFixed(4)}</div>
              <div>Connections: ${edges.length} total · ${availableConnections} available · ${unavailableConnections} unavailable</div>
              <div>Status: <strong>${connectivity}</strong></div>
              <div>Active route: ${onActiveRoute ? 'Yes' : 'No'}</div>
              <div>Risk layer: <strong>${riskLayer === 'overall' ? 'OVERALL NATURAL RISK' : riskLayer.toUpperCase()}</strong></div>
            </div>
          </div>
        `);
        marker.on('click', () => setSelectedGraphNodeId(node.nodeId));
      });
    }
    
    // 2. Verified Shelters
    if (showShelters) {
      shelters.forEach((shelter) => {
        const hasCapacity = typeof shelter.capacityCurrent === 'number' && typeof shelter.capacityTotal === 'number';
        const percentFull = hasCapacity ? Math.round((shelter.capacityCurrent! / shelter.capacityTotal!) * 100) : null;
        const isSelected = selectedMapItem?.type === 'shelter' && selectedMapItem.data?.id === shelter.id;

        const iconHtml = `
          <div class="relative flex items-center justify-center w-9 h-9 rounded-full ${
            isSelected ? 'bg-emerald-500 ring-4 ring-emerald-300 animate-bounce' : 'bg-emerald-600'
          } border-2 border-white shadow-xl text-white transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            <span class="absolute -bottom-1 -right-1 bg-slate-950 text-emerald-300 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-emerald-600 shadow">
              ${percentFull === null ? '—' : `${percentFull}%`}
            </span>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'shelter-marker',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([shelter.location.lat, shelter.location.lng], { icon: customIcon }).addTo(group);

        // Highlight radius circle if selected
        if (isSelected) {
          L.circle([shelter.location.lat, shelter.location.lng], {
            radius: 250,
            color: '#10b981',
            weight: 2,
            fillColor: '#10b981',
            fillOpacity: 0.18,
            dashArray: '5, 5',
          }).addTo(group);
        }

        marker.bindPopup(`
          <div class="p-2.5 text-slate-900 font-sans text-xs min-w-[250px]">
            <div class="font-bold text-sm text-emerald-800 flex items-center justify-between pb-1 border-b border-slate-200">
              <span class="flex items-center gap-1">🏠 ${shelter.name}</span>
              <span class="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] uppercase">
                ${shelter.isFloodSafe === undefined ? 'Map Location' : shelter.isFloodSafe ? 'Flood-Safe' : 'Lowland'}
              </span>
            </div>
            <div class="mt-2 space-y-1.5 text-slate-700">
              <div class="text-[11px] text-slate-500">${shelter.location.address || 'Emergency Hub'}</div>
              ${shelter.elevationM === undefined ? '' : `<div><strong>Elevation:</strong> ${shelter.elevationM}m above sea level</div>`}
              ${hasCapacity ? `<div><strong>Capacity:</strong> ${shelter.capacityCurrent} / ${shelter.capacityTotal} beds (${percentFull}% full)</div>` : ''}
              ${shelter.facilities?.foodSuppliesDays === undefined ? '' : `<div><strong>Ration Reserves:</strong> ${shelter.facilities.foodSuppliesDays} Days</div>`}
              ${shelter.contactNumber ? `<div><strong>Emergency Hotline:</strong> <a href="tel:${shelter.contactNumber}" class="text-emerald-700 font-bold underline">${shelter.contactNumber}</a></div>` : ''}
              <div class="pt-1 flex flex-wrap gap-1">
                ${shelter.facilities?.medicalUnit ? '<span class="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold">🏥 Medical</span>' : ''}
                ${shelter.facilities?.backupPower ? '<span class="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold">⚡ Generator</span>' : ''}
                ${shelter.facilities?.petFriendly ? '<span class="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-bold">🐾 Pets OK</span>' : ''}
              </div>
            </div>
          </div>
        `);

        marker.on('click', () => {
          if (onSelectShelter) onSelectShelter(shelter);
        });
      });
    }

    // 3. IoT Sensor Nodes
    if (showSensors) {
      sensors.forEach((sensor) => {
        const isCritical = sensor.status === 'critical';
        const colorBg = isCritical ? 'bg-red-600' : 'bg-amber-500';
        const isSelected = selectedMapItem?.type === 'sensor' && selectedMapItem.data?.id === sensor.id;

        const iconHtml = `
          <div class="relative flex items-center justify-center w-7 h-7 rounded-full ${colorBg} text-white border-2 border-white shadow-lg ${
            isSelected ? 'ring-4 ring-cyan-300' : ''
          } ${isCritical ? 'animate-bounce' : ''}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M9 9h6v6H9z"/></svg>
            <span class="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
          </div>
        `;

        const sensorIcon = L.divIcon({
          html: iconHtml,
          className: 'sensor-marker',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([sensor.location.lat, sensor.location.lng], { icon: sensorIcon }).addTo(group);

        marker.bindPopup(`
          <div class="p-2 text-slate-900 font-sans text-xs min-w-[220px]">
            <div class="font-bold text-sm text-slate-900 flex items-center justify-between">
              <span>${sensor.name}</span>
              <span class="px-1 bg-red-100 text-red-700 rounded font-bold uppercase text-[9px]">${sensor.status}</span>
            </div>
            <div class="mt-2 space-y-1 text-slate-700">
              <div><strong>Type:</strong> ${sensor.type.replace('_', ' ').toUpperCase()}</div>
              <div><strong>Live Telemetry:</strong> <span class="font-mono text-red-600 font-bold">${sensor.currentValue} ${sensor.unit}</span></div>
              <div><strong>Warning Threshold:</strong> ${sensor.warningThreshold} ${sensor.unit}</div>
              <div><strong>Critical Threshold:</strong> ${sensor.criticalThreshold} ${sensor.unit}</div>
              <div class="text-[10px] text-slate-400">Updated: ${sensor.lastUpdated} | Battery: ${sensor.batteryPercent}%</div>
            </div>
          </div>
        `);

        marker.on('click', () => {
          if (onSelectSensor) onSelectSensor(sensor);
        });
      });
    }

    // 4. Citizen Reports & Incident Pins
    if (showReports) {
      reports.forEach((report) => {
        const isP1 = report.priorityTier === 'P1_CRITICAL';
        const isP2 = report.priorityTier === 'P2_HIGH';
        const isSelected = selectedMapItem?.type === 'report' && selectedMapItem.data?.id === report.id;
        const pinColor = isP1 ? 'bg-red-600' : isP2 ? 'bg-amber-600' : 'bg-yellow-500';

        const iconHtml = `
          <div class="relative flex items-center justify-center w-8 h-8 rounded-full ${pinColor} text-white border-2 border-white shadow-xl ${
            isSelected ? 'ring-4 ring-red-400 animate-bounce' : isP1 ? 'animate-pulse' : ''
          }">
            <span class="text-[11px] font-black">${report.trappedCount > 0 ? 'SOS' : '!'}</span>
            ${
              report.trappedCount > 0
                ? `<span class="absolute -top-2 -right-2 bg-red-950 text-red-300 text-[10px] font-black px-1.5 py-0.2 rounded-full border border-red-500">
                    ${report.trappedCount}
                   </span>`
                : ''
            }
          </div>
        `;

        const reportIcon = L.divIcon({
          html: iconHtml,
          className: 'report-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([report.location.lat, report.location.lng], { icon: reportIcon }).addTo(group);

        marker.bindPopup(`
          <div class="p-2 text-slate-900 font-sans text-xs min-w-[250px]">
            <div class="flex items-center justify-between pb-1 border-b border-slate-200">
              <span class="px-1.5 py-0.5 rounded font-black text-[10px] uppercase ${
                isP1 ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
              }">
                ${report.priorityTier.replace('_', ' ')} (${report.priorityScore}/100)
              </span>
              <span class="text-[10px] text-slate-500">${report.reportedAt}</span>
            </div>
            <div class="mt-2 font-bold text-sm text-slate-900">${report.title}</div>
            <p class="mt-1 text-slate-600 text-xs">${report.description}</p>
            <div class="mt-2 text-slate-700 space-y-0.5 bg-slate-50 p-1.5 rounded border border-slate-200">
              ${report.trappedCount > 0 ? `<div class="text-red-600 font-bold">⚠️ Trapped Civilians: ${report.trappedCount}</div>` : ''}
              ${report.waterDepthCm ? `<div>Water Depth: <strong>${report.waterDepthCm} cm</strong></div>` : ''}
              <div>Status: <strong class="uppercase text-blue-600">${report.status}</strong></div>
              <div>Reporter: ${report.reporterName}</div>
            </div>
          </div>
        `);

        marker.on('click', () => {
          if (onSelectReport) onSelectReport(report);
        });
      });
    }

    // 5. Scan-only visual cue. This reads the already selected response center
    // but is not a graph edge, does not enter adjacency, and is never routed.
    const scanResponse = step4Results['scan-location'];
    const scanCenter = scanResponse?.selectedCenterId
      ? SUNDARBANS_GRAPH.nodeMap[scanResponse.selectedCenterId]
      : undefined;
    if (userLocation && scanResponse?.status === 'ROUTE_FOUND' && scanCenter) {
      L.polyline([
        [userLocation.lat, userLocation.lng],
        [scanCenter.lat, scanCenter.lon],
      ], {
        color: '#c084fc',
        weight: 2.5,
        opacity: 0.8,
        dashArray: '10, 8',
        interactive: true,
      }).addTo(group).bindPopup(`
        <div class="p-2 text-slate-900 font-sans text-xs min-w-[210px]">
          <strong>SIMULATED LOCATION → RESPONSE CENTER</strong>
          <div class="mt-1">Destination: ${scanCenter.displayName}</div>
          <div class="text-slate-600">Demo connection — not part of routing graph.</div>
        </div>
      `);
    }

    // 6. Step 4 route. This is the exact path returned by the engine, never a
    // straight-line substitute between incident and center.
    const selectedReportForRoute = selectedMapItem?.type === 'report' ? selectedMapItem.data as CitizenReport : null;
    const response = selectedReportForRoute ? step4Results[selectedReportForRoute.id] : step4Results['scan-location'];
    if (response?.status === 'ROUTE_FOUND') {
      const routeNodes = response.path
        .map((nodeId) => SUNDARBANS_GRAPH.nodeMap[nodeId])
        .filter((node): node is NonNullable<typeof node> => Boolean(node));
      const routeCoordinates = routeNodes.map((node) => [node.lat, node.lon] as [number, number]);

      if (routeCoordinates.length > 0) {
        const incidentLocation = selectedReportForRoute?.location || userLocation;

        L.polyline(routeCoordinates, {
          color: '#06b6d4',
          weight: 5,
          opacity: 0.95,
          lineJoin: 'round',
          interactive: false,
        }).addTo(group).bindPopup(`
          <div class="p-2 text-slate-900 font-sans text-xs min-w-[210px]">
            <strong>A* SHORTEST FEASIBLE ROUTE</strong>
            <div class="mt-1">Origin: ${SUNDARBANS_GRAPH.nodeMap[response.originNodeId || '']?.displayName || 'Unknown'} (${response.originNodeId?.toUpperCase() || '—'})</div>
            <div>Center: ${SUNDARBANS_GRAPH.nodeMap[response.selectedCenterId || '']?.displayName || response.selectedCenterId}</div>
            <div>Distance: ${response.distance} km · Average speed: ${AVERAGE_RESPONSE_SPEED_KMH} km/h · ETA: ${formatEta(response.distance)}</div>
            <div>Personnel: ${response.requiredPersonnel}</div>
            <div class="mt-1 font-semibold">Directions</div>${routeDirectionsHtml(response.path)}
          </div>
        `);

        if (incidentLocation) {
          L.circleMarker([incidentLocation.lat, incidentLocation.lng], {
            radius: 9, color: '#ffffff', weight: 3, fillColor: selectedReportForRoute ? '#ef4444' : '#0ea5e9', fillOpacity: 1,
          }).addTo(group).bindTooltip(selectedReportForRoute ? 'Active incident' : 'Your approximate location', { permanent: true, direction: 'top', offset: [0, -8] });
        }

        const selectedCenter = response.selectedCenterId ? SUNDARBANS_GRAPH.nodeMap[response.selectedCenterId] : undefined;
        if (selectedCenter) {
          L.circleMarker([selectedCenter.lat, selectedCenter.lon], {
            radius: 10,
            color: '#ffffff',
            weight: 3,
            fillColor: '#22c55e',
            fillOpacity: 1,
          }).addTo(group).bindTooltip(`Government Center ${selectedCenter.nodeId}`, { permanent: true, direction: 'top', offset: [0, -8] });
        }
      }
    }

  }, [
    sensors,
    shelters,
    reports,
    riskLayer,
    networkRiskSnapshots,
    showReports,
    showSensors,
    showShelters,
    userLocation,
    selectedMapItem,
    step4Results,
    graphRevision,
    showStep4Graph,
    showGraphEdges,
    simState,
  ]);

  // Center to user GPS location
  const handleGetLocation = () => {
    const useLocation = (loc: GeoLocation) => {
      setUserLocation(loc);
      setHideFloatingCards(true);
      setClickedAssessment(null);
      onScanLocation?.({ lat: loc.lat, lng: loc.lng, address: loc.address });
      mapInstanceRef.current?.flyTo([loc.lat, loc.lng], 14, { duration: 1.5 });
    };
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: GeoLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            address: 'Your GPS Coordinates',
            elevation: 32,
            slopeAngle: 6,
            distanceToRiver: 350,
          };
          useLocation(loc);
        },
        () => {
          const sampleLoc: GeoLocation = {
            lat: currentRegion.center[0],
            lng: currentRegion.center[1],
            address: `${currentRegion.name} High-Risk Zone (Sample GPS)`,
            elevation: 19,
            slopeAngle: 4,
            distanceToRiver: 90,
          };
          useLocation(sampleLoc);
        }
      );
    } else {
      useLocation({ lat: 22.365, lng: 88.838, address: 'Approximate Sundarbans demo location', elevation: 4, slopeAngle: 1, distanceToRiver: 100 });
    }
  };

  // Selected item data accessor
  const selectedShelterData: Shelter | null =
    selectedMapItem?.type === 'shelter' ? (selectedMapItem.data as Shelter) : null;
  const selectedShelterHasCapacity = selectedShelterData
    && typeof selectedShelterData.capacityCurrent === 'number'
    && typeof selectedShelterData.capacityTotal === 'number';
  const selectedShelterOccupancy = selectedShelterHasCapacity
    ? Math.round((selectedShelterData.capacityCurrent! / selectedShelterData.capacityTotal!) * 100)
    : null;
  const selectedReportData: CitizenReport | null =
    selectedMapItem?.type === 'report' ? (selectedMapItem.data as CitizenReport) : null;
  const selectedSensorData: IoTSensor | null =
    selectedMapItem?.type === 'sensor' ? (selectedMapItem.data as IoTSensor) : null;
  const indexedNodes = Object.values(SUNDARBANS_GRAPH.nodeMap).filter((node) => {
    const edges = SUNDARBANS_GRAPH.adjacency[node.nodeId] || [];
    const available = edges.filter((edge) => edge.available).length;
    const searchMatch = !nodeSearch || `${node.displayName} ${node.nodeId}`.toLowerCase().includes(nodeSearch.toLowerCase());
    const activePath = (selectedMapItem?.type === 'report' ? step4Results[selectedMapItem.data.id]?.path : step4Results['scan-location']?.path) || [];
    const filterMatch = nodeFilter === 'ALL' || node.type === nodeFilter || (nodeFilter === 'BLOCKED' && available < edges.length && available > 0) || (nodeFilter === 'DETACHED' && available === 0) || (nodeFilter === 'ACTIVE' && activePath.includes(node.nodeId));
    return searchMatch && filterMatch;
  }).slice(0, 8);

  const focusGraphNode = (nodeId: string) => {
    const node = SUNDARBANS_GRAPH.nodeMap[nodeId];
    if (!node) return;
    setSelectedGraphNodeId(nodeId);
    mapInstanceRef.current?.flyTo([node.lat, node.lon], 13, { duration: 0.6 });
  };

  return (
    <div className="relative w-full h-[calc(100vh-8.5rem)] min-h-[520px] bg-slate-950 overflow-hidden flex flex-col md:flex-row">
      {/* Map Canvas */}
      <div className="relative flex-1 h-full">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Floating Map Controls Top-Left */}
        <div className={`absolute top-4 left-4 z-30 flex flex-col gap-2 max-w-[280px] ${hideFloatingCards ? 'hidden' : ''}`}>
          <div className="bg-slate-950/95 backdrop-blur-md border border-cyan-800/80 p-2.5 rounded-xl shadow-xl text-xs text-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-black text-cyan-200">SUNDARBANS RESPONSE NETWORK</div>
                <div className="text-[10px] text-slate-400">55 deterministic prototype nodes</div>
              </div>
              <button
                onClick={() => setShowStep4Graph((shown) => !shown)}
                className={`px-2 py-1 rounded text-[10px] font-bold ${showStep4Graph ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300'}`}
              >
                {showStep4Graph ? 'HIDE GRAPH' : 'SHOW GRAPH'}
              </button>
            </div>
            <div className="mt-2 flex gap-1.5">
              <button
                onClick={() => mapInstanceRef.current?.fitBounds(L.latLngBounds(sundarbansNodeCoordinates), { padding: [35, 35], maxZoom: 12, duration: 0.8 })}
                className="flex-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold"
              >
                FIT SUNDARBANS NETWORK
              </button>
              <button
                onClick={() => setShowGraphEdges((shown) => !shown)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold"
              >
                {showGraphEdges ? 'EDGES ON' : 'EDGES OFF'}
              </button>
            </div>
          </div>

          {/* Layer Filter Toggle Bar */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-2.5 rounded-xl shadow-xl text-xs space-y-2 text-slate-200">
            <div className="flex items-center justify-between font-bold text-slate-100 pb-1.5 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>GIS Disaster Layers</span>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono">LIVE GIS</span>
            </div>

            <div className="border-t border-slate-800 pt-2">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Risk heatmap</div>
              <div className="mb-1 text-[10px] text-cyan-300">Season: <strong>{selectedSeasonLabel}</strong> · engine + mapped historical/AI context</div>
              <div className="grid grid-cols-2 gap-1">
                {([['overall', 'Overall risk'], ['flood', 'Flood'], ['landslide', 'Landslide'], ['earthquake', 'Earthquake']] as const).map(([layer, label]) => (
                  <button key={layer} onClick={() => setRiskLayer(layer)} className={`rounded px-1.5 py-1 text-[10px] ${riskLayer === layer ? 'bg-cyan-800 text-white' : 'bg-slate-800 text-slate-400'}`}>{label}</button>
                ))}
              </div>
              {riskLayer === 'earthquake' && <div className="mt-1 text-[10px] text-slate-400">Earthquake exposure uses the existing seismic-PGA risk factor.</div>}
            </div>

            <div className="pt-1">
              <button
                onClick={() => setShowSensors(!showSensors)}
                className={`flex w-full items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  showSensors ? 'bg-purple-950 text-purple-200 border border-purple-700/60' : 'bg-slate-800/60 text-slate-400'
                }`}
              >
                <Radio className="w-3 h-3 text-purple-400" />
                <span>IoT ({sensors.length})</span>
              </button>
            </div>

            {/* Basemap Switcher */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Map Style:</span>
              <div className="flex gap-1">
                {(['dark', 'satellite', 'street'] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => setMapStyle(style)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${
                      mapStyle === style ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Floating Quick Action: Scan My Location & Hotspot Jumps */}
        <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
          <div className="w-56 rounded-xl border border-slate-700 bg-slate-950/95 p-2 shadow-lg">
            <input value={nodeSearch} onChange={(event) => setNodeSearch(event.target.value)} placeholder="Search location or node ID" className="w-full rounded bg-slate-800 px-2 py-1 text-xs text-white outline-none ring-cyan-500 focus:ring-1" />
            <div className="mt-1 flex flex-wrap gap-1">
              {(['ALL', 'LOCATION', 'GOVERNMENT_CENTER', 'BLOCKED', 'DETACHED', 'ACTIVE'] as const).map((filter) => <button key={filter} onClick={() => setNodeFilter(filter)} className={`rounded px-1 py-0.5 text-[9px] ${nodeFilter === filter ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-400'}`}>{filter === 'GOVERNMENT_CENTER' ? 'CENTERS' : filter}</button>)}
            </div>
            {(nodeSearch || nodeFilter !== 'ALL') && <div className="mt-1 max-h-36 overflow-auto">{indexedNodes.map((node) => <button key={node.nodeId} onClick={() => focusGraphNode(node.nodeId)} className="block w-full rounded px-1 py-1 text-left text-[10px] text-slate-300 hover:bg-slate-800"><strong>{node.displayName}</strong> ({node.nodeId.toUpperCase()}) · {node.type === 'LOCATION' ? 'Location' : 'Center'}</button>)}</div>}
          </div>
          <button
            onClick={handleGetLocation}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-950/60 border border-cyan-400/40 transition-all hover:scale-105"
          >
            <Crosshair className="w-4 h-4" />
            <span>Scan My Location Risk</span>
          </button>
          {userLocation && (() => {
            const nearestId = findNearestNode(SUNDARBANS_GRAPH, userLocation.lat, userLocation.lng);
            const nearest = nearestId ? SUNDARBANS_GRAPH.nodeMap[nearestId] : undefined;
            const distance = nearest ? haversineDistanceKm(userLocation.lat, userLocation.lng, nearest.lat, nearest.lon) : null;
            return <div className="w-56 rounded-xl border border-cyan-800 bg-slate-950/95 p-2 text-[11px] text-slate-300 shadow-lg">
              <div className="font-bold text-cyan-200">YOUR APPROXIMATE LOCATION</div>
              <div className="mt-1">Nearest Step 4 node: <strong>{nearest ? `${nearest.displayName} (${nearest.nodeId.toUpperCase()})` : 'Unavailable'}</strong></div>
              <div>Mapping distance: {distance?.toFixed(2) ?? '—'} km</div>
            </div>;
          })()}

          {/* Quick Hotspot Fly-To Pills */}
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-2 rounded-xl shadow-lg flex flex-col gap-1 max-w-[200px]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hotspots</span>
            {currentRegion.id === 'wb-north' && (
              <div className="flex flex-wrap gap-1">
                {[
                  { name: 'Teesta Bazar', coords: [27.018, 88.428], zoom: 14 },
                  { name: 'Paglajhora NH-10', coords: [26.864, 88.342], zoom: 14 },
                  { name: 'Gajoldoba Barrage', coords: [26.758, 88.534], zoom: 13 },
                  { name: 'Siliguri Hub', coords: [26.722, 88.428], zoom: 13 },
                  { name: 'Darjeeling Hills', coords: [27.042, 88.262], zoom: 13 },
                ].map((spot) => (
                  <button
                    key={spot.name}
                    onClick={() => mapInstanceRef.current?.flyTo(spot.coords as [number, number], spot.zoom)}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition-colors"
                  >
                    📍 {spot.name}
                  </button>
                ))}
              </div>
            )}
            {currentRegion.id === 'wb-south' && (
              <div className="flex flex-wrap gap-1">
                {[
                  { name: 'Gosaba Sundarbans', coords: [22.164, 88.815], zoom: 13 },
                  { name: 'Bali Island', coords: [22.498, 88.318], zoom: 14 },
                  { name: 'Jharkhali', coords: [22.545, 88.308], zoom: 14 },
                  { name: 'Kakdwip Port', coords: [21.875, 88.185], zoom: 13 },
                ].map((spot) => (
                  <button
                    key={spot.name}
                    onClick={() => mapInstanceRef.current?.flyTo(spot.coords as [number, number], spot.zoom)}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition-colors"
                  >
                    📍 {spot.name}
                  </button>
                ))}
              </div>
            )}
            {currentRegion.id === 'cascades' && (
              <div className="flex flex-wrap gap-1">
                {[
                  { name: 'Lower Basin', coords: [47.502, -121.845], zoom: 14 },
                  { name: 'North Ridge', coords: [47.525, -121.835], zoom: 14 },
                  { name: 'Civic High School', coords: [47.535, -121.875], zoom: 14 },
                ].map((spot) => (
                  <button
                    key={spot.name}
                    onClick={() => mapInstanceRef.current?.flyTo(spot.coords as [number, number], spot.zoom)}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition-colors"
                  >
                    📍 {spot.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Floating Map Legend Bottom-Left */}
        <div className={`absolute bottom-4 left-4 z-30 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3 py-2 rounded-xl shadow-lg text-[11px] text-slate-300 hidden sm:block ${hideFloatingCards ? 'sm:hidden' : ''}`}>
          <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>Step 4 visualization — select graph features for details</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-600"></span> P1 Critical</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500"></span> P2 High</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-600"></span> Shelter</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-purple-600"></span> IoT Node</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400 border-t border-slate-800 pt-1.5">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span> Location node</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Government center</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Partially blocked</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Detached</span>
            <span className="flex items-center gap-1"><span className="w-4 h-1 rounded bg-cyan-400"></span> Active route</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span> User location</span>
          </div>
        </div>

        {!hideFloatingCards && selectedGraphNodeId && (() => {
          const node = SUNDARBANS_GRAPH.nodeMap[selectedGraphNodeId];
          if (!node) return null;
          const edges = SUNDARBANS_GRAPH.adjacency[node.nodeId] || [];
          const available = edges.filter((edge) => edge.available).length;
          const status = available === 0 ? 'FULLY DETACHED' : available === edges.length ? 'CONNECTED' : 'PARTIALLY BLOCKED';
          return (
            <div className="absolute bottom-4 right-4 z-30 w-72 bg-slate-950/95 backdrop-blur-md border border-cyan-900 rounded-xl p-3 shadow-2xl text-xs text-slate-200">
              <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
                <div>
                  <div className="font-bold text-white">{node.displayName}</div>
                  <div className="text-[10px] text-cyan-300">{node.nodeId.toUpperCase()} · {node.type.replace('_', ' ')}</div>
                </div>
                <button onClick={() => setSelectedGraphNodeId(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                <div>GPS: <span className="font-mono text-slate-200">{node.lat.toFixed(4)}, {node.lon.toFixed(4)}</span></div>
                <div>Connections: <span className="text-slate-200">{edges.length} total / {available} available</span></div>
                <div>Status: <span className={status === 'CONNECTED' ? 'text-emerald-300' : status === 'PARTIALLY BLOCKED' ? 'text-amber-300' : 'text-red-300'}>{status}</span></div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ========================================================================= */}
      {/* RIGHT SLIDE-IN INSPECTION PANELS */}
      {/* ========================================================================= */}

      {/* 1. SELECTED SHELTER INSPECTION PANEL */}
      {selectedShelterData && (
        <div className="w-full md:w-96 bg-slate-900 border-l border-emerald-900/60 p-5 overflow-y-auto flex flex-col justify-between shadow-2xl z-30 max-h-[50vh] md:max-h-full space-y-4 animate-fadeIn">
          <div>
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500 flex items-center justify-center text-emerald-400">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">{selectedShelterData.name}</h3>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{selectedShelterData.isFloodSafe === undefined ? 'Map Location' : selectedShelterData.isFloodSafe ? 'Verified Flood-Safe Elevation' : 'Lowland Facility'}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (onClearSelectedItem) onClearSelectedItem();
                  if (onSelectShelter) onSelectShelter(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-md text-xs font-mono"
              >
                ✕
              </button>
            </div>

            {/* Address & Elevation Coordinates */}
            <div className="mt-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div className="text-slate-200 font-semibold">{selectedShelterData.location.address || 'Emergency Shelter Sector'}</div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                <div>
                  <span>Elevation:</span> <strong className="text-emerald-300 font-mono">{selectedShelterData.elevationM === undefined ? 'Not available' : `${selectedShelterData.elevationM} meters`}</strong>
                </div>
                <div>
                  <span>Status:</span> <strong className="text-emerald-400">{selectedShelterData.isOpen === undefined ? 'Map location' : selectedShelterData.isOpen ? '🟢 Operational' : '🔴 Closed'}</strong>
                </div>
                <div className="col-span-2">
                  <span>GPS:</span> <span className="font-mono text-slate-400">{selectedShelterData.location.lat.toFixed(4)}, {selectedShelterData.location.lng.toFixed(4)}</span>
                </div>
              </div>
            </div>

            {/* Occupancy & Live Capacity Card */}
            {selectedShelterHasCapacity && <div className="mt-3 bg-slate-950 p-3.5 rounded-xl border border-emerald-950/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Bed Capacity &amp; Occupancy</span>
                <span className="font-mono font-bold text-emerald-300">
                  {selectedShelterData.capacityCurrent} / {selectedShelterData.capacityTotal} Beds
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    selectedShelterOccupancy! > 85
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.min(100, selectedShelterOccupancy!)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                <span>Available Space:</span>
                <strong className="text-white">
                  {selectedShelterData.capacityTotal - selectedShelterData.capacityCurrent} free beds (
                  {selectedShelterOccupancy}% Full)
                </strong>
              </div>
            </div>}

            {/* Ration & Logistics Reserves */}
            {(selectedShelterData.facilities?.foodSuppliesDays !== undefined || selectedShelterData.facilities?.cleanWaterAvailable !== undefined) && <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300">
                <span className="text-[10px] text-slate-500 block">Food &amp; Water Rations</span>
                <strong className="text-emerald-400 text-sm font-mono">{selectedShelterData.facilities?.foodSuppliesDays} Days Reserve</strong>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300">
                <span className="text-[10px] text-slate-500 block">Drinking Water</span>
                <strong className="text-emerald-400 text-sm font-mono">
                  {selectedShelterData.facilities?.cleanWaterAvailable ? 'Potable Active' : 'Limited'}
                </strong>
              </div>
            </div>}

            {/* On-Site Facilities Badges */}
            <div className="mt-3 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Equipped Support Infrastructure</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedShelterData.facilities?.medicalUnit && (
                  <span className="px-2 py-1 rounded-lg bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-semibold flex items-center gap-1">
                    <Heart className="w-3 h-3" /> Medical Clinic
                  </span>
                )}
                {selectedShelterData.facilities?.backupPower && (
                  <span className="px-2 py-1 rounded-lg bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-semibold flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Generator Power
                  </span>
                )}
                {selectedShelterData.facilities?.petFriendly && (
                  <span className="px-2 py-1 rounded-lg bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-semibold flex items-center gap-1">
                    <Dog className="w-3 h-3" /> Pets Permitted
                  </span>
                )}
                {selectedShelterData.facilities?.wheelchairAccessible && (
                  <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold">
                    ♿ ADA Accessible
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            {selectedShelterData.contactNumber && <a
              href={`tel:${selectedShelterData.contactNumber}`}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Phone className="w-4 h-4" />
              <span>Call Emergency Hotline ({selectedShelterData.contactNumber})</span>
            </a>}

            <button
              onClick={() => {
                const assessment = assessLocationRisk(selectedShelterData.location, simState, sensors, shelters);
                setClickedAssessment(assessment);
              }}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-all"
            >
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              <span>Assess Micro-Hazards Near Shelter</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. SELECTED REPORT INSPECTION PANEL */}
      {!selectedShelterData && selectedReportData && (
        <div className="w-full md:w-96 bg-slate-900 border-l border-red-900/60 p-5 overflow-y-auto flex flex-col justify-between shadow-2xl z-30 max-h-[50vh] md:max-h-full space-y-4 animate-fadeIn">
          <div>
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-600/30 border border-red-500 flex items-center justify-center text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">{selectedReportData.title}</h3>
                  <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">
                    {selectedReportData.priorityTier.replace('_', ' ')} (Score: {selectedReportData.priorityScore}/100)
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  if (onClearSelectedItem) onClearSelectedItem();
                  if (onSelectReport) onSelectReport(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-md text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
              {selectedReportData.description}
            </p>

            <div className="mt-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <span className="font-bold text-white uppercase">{selectedReportData.category.replace('_', ' ')}</span>
              </div>
              {selectedReportData.trappedCount > 0 && (
                <div className="flex justify-between text-red-400 font-bold">
                  <span>Trapped Civilians:</span>
                  <span>{selectedReportData.trappedCount} Persons</span>
                </div>
              )}
              {selectedReportData.waterDepthCm && (
                <div className="flex justify-between text-cyan-300">
                  <span>Water Inundation:</span>
                  <span>{selectedReportData.waterDepthCm} cm</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Reporter:</span>
                <span className="text-slate-300">{selectedReportData.reporterName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="font-bold text-blue-400 uppercase">{selectedReportData.status}</span>
              </div>
            </div>

            {selectedReportData.aiVerification && (
              <div className="mt-3 bg-cyan-950/40 border border-cyan-800/60 p-3 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                  <Activity className="w-3.5 h-3.5" />
                  <span>AI Verification Engine ({Math.round(selectedReportData.aiVerification.confidence * 100)}% Confidence)</span>
                </div>
                <p className="text-[11px] text-slate-300">{selectedReportData.aiVerification.urgencyReasoning}</p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800">
            <button
              onClick={() => {
                const assessment = assessLocationRisk(selectedReportData.location, simState, sensors, shelters);
                setClickedAssessment(assessment);
              }}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Assess Micro-Hazards at Incident Site</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. CLICKED / SCANNED LOCATION RISK ASSESSMENT PANEL */}
      {!selectedShelterData && !selectedReportData && clickedAssessment && (
        <div className="w-full md:w-96 bg-slate-900 border-l border-slate-800 p-4 overflow-y-auto flex flex-col justify-between shadow-2xl z-30 max-h-[50vh] md:max-h-full">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-sm text-white">Location-Based Risk Engine</h3>
              </div>
              <button
                onClick={() => setClickedAssessment(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            {/* Coordinate Details */}
            <div className="mt-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
              <div className="text-slate-300 font-semibold">{clickedAssessment.location.address}</div>
              <div className="text-slate-400 mt-1 grid grid-cols-2 gap-1 text-[11px]">
                <span>Lat/Lng: {clickedAssessment.location.lat}, {clickedAssessment.location.lng}</span>
                <span>Elevation: <strong>{clickedAssessment.location.elevation}m</strong></span>
                <span>Terrain Slope: <strong>{clickedAssessment.location.slopeAngle}°</strong></span>
                <span>Dist to River: <strong>{clickedAssessment.location.distanceToRiver}m</strong></span>
              </div>
            </div>

            {/* Composite Risk Score Badge */}
            <div className="mt-3 p-3 rounded-xl border bg-gradient-to-br from-slate-950 to-slate-900 border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Composite Threat Score</span>
                  <div className="text-2xl font-black text-white flex items-baseline gap-1">
                    <span>{clickedAssessment.compositeRiskScore}</span>
                    <span className="text-xs text-slate-400 font-normal">/ 100</span>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                    clickedAssessment.compositeRiskTier === 'critical'
                      ? 'bg-red-600 text-white animate-pulse'
                      : clickedAssessment.compositeRiskTier === 'severe'
                      ? 'bg-amber-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {clickedAssessment.compositeRiskTier}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    clickedAssessment.compositeRiskScore > 75
                      ? 'bg-red-500'
                      : clickedAssessment.compositeRiskScore > 45
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${clickedAssessment.compositeRiskScore}%` }}
                />
              </div>
            </div>

            {/* Breakdown: Flood Risk Engine vs Landslide Risk Engine */}
            <div className="mt-3 space-y-2">
              {/* Flood Risk Sub-Card */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-cyan-900/40 text-xs">
                <div className="flex items-center justify-between text-cyan-300 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5" />
                    <span>Flood Risk Engine</span>
                  </div>
                  <span className="font-mono font-bold">{clickedAssessment.floodRisk.score}% ({clickedAssessment.floodRisk.tier.toUpperCase()})</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 space-y-0.5">
                  <div>Predicted Inundation: <strong className="text-cyan-200">{clickedAssessment.floodRisk.predictedInundationDepthCm} cm</strong></div>
                  {clickedAssessment.floodRisk.estimatedTimeToFloodMinutes && (
                    <div className="text-red-400">Est. Time to Inundation: <strong>{clickedAssessment.floodRisk.estimatedTimeToFloodMinutes} mins</strong></div>
                  )}
                </div>
              </div>

              {/* Landslide Risk Sub-Card */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-amber-900/40 text-xs">
                <div className="flex items-center justify-between text-amber-300 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <Mountain className="w-3.5 h-3.5" />
                    <span>Landslide Geotechnical Engine</span>
                  </div>
                  <span className="font-mono font-bold">{clickedAssessment.landslideRisk.score}% ({clickedAssessment.landslideRisk.tier.toUpperCase()})</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Factor of Safety (FoS):</span>
                    <strong className={clickedAssessment.landslideRisk.factorOfSafety < 1.0 ? 'text-red-400 animate-pulse font-mono' : 'text-emerald-400 font-mono'}>
                      {clickedAssessment.landslideRisk.factorOfSafety}
                    </strong>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>Failure Kinematics:</span>
                    <span className="text-amber-200 font-semibold">{clickedAssessment.landslideRisk.failureMode}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>Mohr-Coulomb Strength:</span>
                    <span className="font-mono text-slate-300">
                      {clickedAssessment.landslideRisk.criticalShearStrengthKPa} / {clickedAssessment.landslideRisk.drivingShearStressKPa} kPa
                    </span>
                  </div>
                  {clickedAssessment.landslideRisk.timeToSlopeFailureHours && (
                    <div className="text-red-400 font-semibold pt-0.5">
                      ⚠️ Predicted Shear Collapse Window: ~{clickedAssessment.landslideRisk.timeToSlopeFailureHours} hrs
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Nearest Shelter Evacuation Card */}
            {clickedAssessment.nearestShelter && (
              <div className="mt-3 bg-emerald-950/40 border border-emerald-800/60 p-2.5 rounded-lg text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Safe Evacuation Corridor</span>
                  </div>
                  <button
                    onClick={() => {
                      if (onSelectShelter && clickedAssessment.nearestShelter) {
                        onSelectShelter(clickedAssessment.nearestShelter);
                      }
                    }}
                    className="text-[10px] text-emerald-400 hover:text-emerald-200 underline font-bold"
                  >
                    View Shelter Info
                  </button>
                </div>
                <div className="mt-1 text-slate-200 font-bold">{clickedAssessment.nearestShelter.name}</div>
                <div className="text-[11px] text-emerald-400 mt-0.5">
                  Distance: <strong>{clickedAssessment.distanceToShelterKm} km</strong> • Elevation: {clickedAssessment.nearestShelter.elevationM}m (Flood-Protected)
                </div>
              </div>
            )}

            {/* Actionable Recommendations */}
            <div className="mt-3 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Citizen Directive</span>
              {clickedAssessment.actionableRecommendations.map((rec, idx) => (
                <div key={idx} className="text-[11px] text-slate-300 bg-slate-850 p-1.5 rounded border border-slate-800">
                  {rec}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
