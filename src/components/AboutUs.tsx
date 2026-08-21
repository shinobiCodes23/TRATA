import React from 'react';
import { MapPinned, ShieldAlert, Users } from 'lucide-react';

export const AboutUs: React.FC = () => (
  <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 text-slate-100">
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-cyan-950 p-2.5"><ShieldAlert className="w-6 h-6 text-cyan-300" /></div>
        <div>
          <h1 className="text-xl font-black text-white sm:text-2xl">About TRATA</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">
            TRATA is a disaster-management and emergency-response prototype for situational awareness, incident prioritization, and coordinated response workflows.
          </p>
        </div>
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
        <MapPinned className="w-5 h-5 text-cyan-400" />
        <h2 className="mt-3 font-bold text-white">Purpose</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          The platform brings together citizen incident reporting, risk assessment, map-based awareness, rescue-unit coordination, public-alert workflows, and graph-based priority response in one prototype application.
        </p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
        <ShieldAlert className="w-5 h-5 text-amber-400" />
        <h2 className="mt-3 font-bold text-white">Operational concept</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          In the Sundarbans prototype context, incoming reports can be assessed, prioritized, matched with available resources, and evaluated against a deterministic routing network to support an authority dispatch workflow.
        </p>
      </div>
    </section>

    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
      <h2 className="font-bold text-white">Major modules</h2>
      <div className="mt-3 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
        <p>Citizen reporting and location-based risk assessment</p>
        <p>Authority incident review, fleet coordination, and public alerts</p>
        <p>Map visualization for reports, sensors, shelters, hazard zones, and rescue units</p>
        <p>Risk, simulation, historical, IoT, and operational-intelligence views</p>
      </div>
    </section>

    <section className="flex items-center gap-3 rounded-xl border border-cyan-900 bg-cyan-950/30 p-5">
      <Users className="w-5 h-5 text-cyan-300" />
      <div><div className="text-xs font-bold uppercase tracking-wider text-cyan-300">Team</div><div className="font-bold text-white">ACTIVFLY</div></div>
    </section>

    <p className="text-xs text-slate-500">This application is intended for demonstration, academic, and prototype use. Its routing network is deterministic sample data, not a live emergency dispatch or road-navigation service.</p>
  </div>
);
