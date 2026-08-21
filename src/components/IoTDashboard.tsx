import React, { useState } from 'react';
import {
  Radio,
  Activity,
  Plus,
  Battery,
  AlertTriangle,
  CheckCircle,
  Wifi,
  Sparkles,
  Layers,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { IoTSensor } from '../types';

interface IoTDashboardProps {
  sensors: IoTSensor[];
  onDeploySensor: (newSensor: IoTSensor) => void;
}

export const IoTDashboard: React.FC<IoTDashboardProps> = ({ sensors = [], onDeploySensor }) => {
  const [selectedSensorType, setSelectedSensorType] = useState<string>('ALL');
  const [showDeployModal, setShowDeployModal] = useState<boolean>(false);
  const [sensorName, setSensorName] = useState<string>('');
  const [sensorType, setSensorType] = useState<IoTSensor['type']>('piezometer');
  const [sensorAddress, setSensorAddress] = useState<string>('East Ravine Upper Ridge #5');

  const filteredSensors = sensors.filter(
    (s) => selectedSensorType === 'ALL' || s.type === selectedSensorType
  );

  const handleDeploy = (e: React.FormEvent) => {
    e.preventDefault();
    const newSensor: IoTSensor = {
      id: `sensor-${Date.now()}`,
      name: sensorName || `Future IoT ${sensorType.replace('_', ' ').toUpperCase()} Node`,
      type: sensorType,
      location: {
        lat: 47.519,
        lng: -121.832,
        address: sensorAddress,
        elevation: 110,
        slopeAngle: 32,
      },
      currentValue: sensorType === 'river_gauge' ? 4.5 : sensorType === 'piezometer' ? 28 : 55,
      unit: sensorType === 'river_gauge' ? 'm' : sensorType === 'piezometer' ? 'kPa' : 'mm/h',
      normalThreshold: sensorType === 'river_gauge' ? 3.0 : 20,
      warningThreshold: sensorType === 'river_gauge' ? 4.8 : 35,
      criticalThreshold: sensorType === 'river_gauge' ? 6.0 : 45,
      status: 'warning',
      lastUpdated: 'Just now',
      batteryPercent: 100,
      isFutureSensor: true,
      history: [
        { timestamp: '12:00', value: 10 },
        { timestamp: '13:00', value: 18 },
        { timestamp: '14:00', value: 24 },
        { timestamp: '15:00', value: 28 },
      ],
    };
    onDeploySensor(newSensor);
    setShowDeployModal(false);
    setSensorName('');
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-6 h-6 text-purple-400" />
            <h1 className="text-xl sm:text-2xl font-black text-white">IoT TELEMETRY SENSOR GRID</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-Time Edge Sensor Network • Catchment Hydrographs • Future Sensor Placement Optimizer
          </p>
        </div>

        <button
          onClick={() => setShowDeployModal(true)}
          className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-950/40"
        >
          <Plus className="w-4 h-4" />
          <span>Deploy Future IoT Sensor Node</span>
        </button>
      </div>

      {/* Future Sensor Impact Banner */}
      <div className="bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-900 border border-purple-800/60 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-sm text-white">Future IoT Sensor Integration Impact</h3>
          </div>
          <p className="text-xs text-purple-200 mt-1 max-w-2xl">
            Deploying high-frequency geotechnical piezometers and ultrasonic stage transducers in headwater tributaries expands early landslide/flood prediction lead time from <strong>22 minutes</strong> to over <strong>85 minutes</strong>.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-purple-900/60">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold">Prediction Lead Time</span>
            <div className="text-xl font-black text-purple-300">+63 mins (3.8x)</div>
          </div>
        </div>
      </div>

      {/* Sensor Type Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'ALL', label: 'All Sensors' },
          { id: 'river_gauge', label: 'River Gauges' },
          { id: 'piezometer', label: 'Slope Piezometers' },
          { id: 'inclinometer', label: 'Inclinometers' },
          { id: 'rain_gauge', label: 'Rain Telemetry' },
          { id: 'soil_moisture', label: 'Soil Saturation' },
          { id: 'seismic_node', label: 'Acoustic / Seismic' },
        ].map((type) => (
          <button
            key={type.id}
            onClick={() => setSelectedSensorType(type.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedSensorType === type.id
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Grid of IoT Sensor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSensors.map((sensor) => {
          const isCritical = sensor.status === 'critical';
          const isWarning = sensor.status === 'warning';

          return (
            <div
              key={sensor.id}
              className={`p-4 rounded-2xl border transition-all ${
                isCritical
                  ? 'bg-gradient-to-b from-red-950/40 to-slate-900 border-red-800/80 shadow-lg'
                  : isWarning
                  ? 'bg-gradient-to-b from-amber-950/30 to-slate-900 border-amber-800/60'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">{sensor.type.replace('_', ' ')}</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-100 mt-1">{sensor.name}</h4>
                  <div className="text-[11px] text-slate-400">{sensor.location.address}</div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    isCritical
                      ? 'bg-red-600 text-white animate-pulse'
                      : isWarning
                      ? 'bg-amber-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {sensor.status}
                </span>
              </div>

              {/* Live Telemetry Big Number */}
              <div className="mt-4 bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Current Telemetry</span>
                  <div className="text-2xl font-black text-white mt-0.5">
                    {sensor.currentValue} <span className="text-xs font-normal text-slate-400">{sensor.unit}</span>
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <div>Warning: {sensor.warningThreshold} {sensor.unit}</div>
                  <div className="text-red-400 font-semibold">Critical: {sensor.criticalThreshold} {sensor.unit}</div>
                </div>
              </div>

              {/* Sparkline Graph */}
              <div className="mt-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">5-Hour Trend Curve</span>
                <div className="h-14 bg-slate-950 rounded-lg p-2 flex items-end justify-between gap-1 border border-slate-800">
                  {sensor.history.map((pt, i) => {
                    const maxVal = Math.max(...sensor.history.map((h) => h.value), sensor.criticalThreshold * 1.1);
                    const heightPct = Math.min(100, Math.max(15, (pt.value / maxVal) * 100));
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <div
                          className={`w-full rounded-t transition-all ${
                            pt.value >= sensor.criticalThreshold
                              ? 'bg-red-500'
                              : pt.value >= sensor.warningThreshold
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[9px] text-slate-500">{pt.timestamp}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1">
                  <Battery className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Battery {sensor.batteryPercent}%</span>
                </div>
                <span>Updated {sensor.lastUpdated}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deploy Sensor Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Deploy Virtual IoT Sensor Node</h3>
              <button onClick={() => setShowDeployModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleDeploy} className="space-y-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Sensor Node Type</label>
                <select
                  value={sensorType}
                  onChange={(e) => setSensorType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs"
                >
                  <option value="piezometer">Pore Pressure Piezometer (Landslide shear)</option>
                  <option value="river_gauge">Ultrasonic River Stage Gauge (Flood level)</option>
                  <option value="seismic_node">Acoustic Vibration Accelerometer</option>
                  <option value="soil_moisture">Soil Saturation Moisture Array</option>
                  <option value="rain_gauge">Optical Rain Intensity Telemetry</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Node Identifier / Name</label>
                <input
                  type="text"
                  placeholder="e.g. East Valley Confluence Node #6"
                  value={sensorName}
                  onChange={(e) => setSensorName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Geographic Placement Sector</label>
                <input
                  type="text"
                  value={sensorAddress}
                  onChange={(e) => setSensorAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeployModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold"
                >
                  Initialize & Link Sensor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
