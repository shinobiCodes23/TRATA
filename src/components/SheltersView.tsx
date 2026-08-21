import React from 'react';
import {
  Home,
  ShieldCheck,
  Phone,
  Compass,
} from 'lucide-react';
import { Shelter } from '../types';

interface SheltersViewProps {
  shelters: Shelter[];
  onSelectShelterOnMap?: (shelter: Shelter) => void;
}

export const SheltersView: React.FC<SheltersViewProps> = ({ shelters = [], onSelectShelterOnMap }) => {
  const sheltersWithCapacity = shelters.filter(
    (s) => typeof s.capacityTotal === 'number' && typeof s.capacityCurrent === 'number',
  );
  const totalCapacity = sheltersWithCapacity.reduce((acc, s) => acc + s.capacityTotal!, 0);
  const totalOccupancy = sheltersWithCapacity.reduce((acc, s) => acc + s.capacityCurrent!, 0);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Home className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl sm:text-2xl font-black text-white">EMERGENCY SHELTER DIRECTORY</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-Time Capacity Monitoring, Flood-Safe High Elevation Verification, & Resource Logistics
          </p>
        </div>

        {/* Global Capacity Metric */}
        <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl flex items-center gap-4">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold">Total Shelter Occupancy</span>
            <div className="text-lg font-black text-white">
              {totalCapacity > 0
                ? <>{totalOccupancy} <span className="text-xs font-normal text-slate-400">/ {totalCapacity} beds</span></>
                : <span className="text-xs font-normal text-slate-400">Capacity data unavailable</span>}
            </div>
          </div>
          <div className="w-20 bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${totalCapacity > 0 ? (totalOccupancy / totalCapacity) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Shelters Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shelters.map((shelter) => {
          const hasCapacity = typeof shelter.capacityTotal === 'number' && typeof shelter.capacityCurrent === 'number';
          const percentFull = hasCapacity ? Math.round((shelter.capacityCurrent! / shelter.capacityTotal!) * 100) : null;
          const isNearFull = percentFull > 85;

          return (
            <div
              key={shelter.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                      <ShieldCheck className="w-4 h-4" />
                      <span>{shelter.isFloodSafe === undefined ? 'Map Location' : shelter.isFloodSafe ? 'Verified Flood-Safe Elevation' : 'Lowland Facility'}</span>
                    </div>
                    <h3 className="font-bold text-base text-white mt-1">{shelter.name}</h3>
                    <div className="text-xs text-slate-400">{shelter.location.address}</div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase ${
                      isNearFull
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    {shelter.isOpen === undefined || percentFull === null ? 'Map Location' : shelter.isOpen ? `${percentFull}% Occupied` : 'Closed'}
                  </span>
                </div>

                {/* Occupancy Progress */}
                {hasCapacity && (
                  <div className="mt-4 bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Available Beds:</span>
                      <strong className="text-white font-mono">
                        {shelter.capacityTotal! - shelter.capacityCurrent!} beds left ({shelter.capacityCurrent}/{shelter.capacityTotal})
                      </strong>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isNearFull ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${percentFull}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Elevation & Resources Feature Pills */}
                {(shelter.elevationM !== undefined || shelter.facilities?.foodSuppliesDays !== undefined) && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {shelter.elevationM !== undefined && <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-slate-300"><span className="text-[10px] text-slate-500 block">Elevation Above Sea Level</span><strong>{shelter.elevationM} meters</strong></div>}
                    {shelter.facilities?.foodSuppliesDays !== undefined && <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-slate-300"><span className="text-[10px] text-slate-500 block">Food / Ration Reserves</span><strong>{shelter.facilities.foodSuppliesDays} Days Stock</strong></div>}
                  </div>
                )}

              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                {shelter.contactNumber && <a
                  href={`tel:${shelter.contactNumber}`}
                  className="text-xs text-slate-300 hover:text-white flex items-center gap-1 font-medium"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{shelter.contactNumber}</span>
                </a>}

                {onSelectShelterOnMap && (
                  <button
                    onClick={() => onSelectShelterOnMap(shelter)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>View on Map</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
