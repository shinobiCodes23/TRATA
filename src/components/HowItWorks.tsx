import React from 'react';
import { CheckCircle2, Route, Truck } from 'lucide-react';

const workflow = [
  ['1. Observe risk', 'Simulation inputs, IoT telemetry, and disaster-risk calculations support affected-region identification and map awareness.'],
  ['2. Report incidents', 'Citizen reports, including SOS-style reports, enter the application with location, hazard, and priority information.'],
  ['3. Batch and prioritize', 'Incoming incidents enter the intake buffer, then move into the persistent Priority Queue, which orders them by the existing upstream priority score.'],
  ['4. Produce a response', 'PriorityResponse evaluates personnel needs and maps the incident to the deterministic Sundarbans graph for A* routing to reachable government centers.'],
  ['5. Assign resources', 'The authority workflow selects an eligible center-associated fleet when a feasible route and sufficient personnel are available.'],
  ['6. Track response states', 'Authority Command shows incident review, route results, fleet status, operational messages, and public-alert controls; the Citizen Portal provides safety and location tools.'],
  ['7. Recover capacity', 'After service, fleets transition through return and recovery before becoming available again. Resource-pending incidents can then be retried.'],
];

export const HowItWorks: React.FC = () => (
  <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 text-slate-100">
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-cyan-950 p-2.5"><Route className="w-6 h-6 text-cyan-300" /></div>
        <div>
          <h1 className="text-xl font-black text-white sm:text-2xl">How This Website Works</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">TRATA connects risk analysis, citizen input, priority response, routing, and fleet availability through one application workflow.</p>
        </div>
      </div>
    </section>

    <section className="space-y-3">
      {workflow.map(([title, description]) => (
        <div key={title} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
          <CheckCircle2 className="mt-0.5 w-5 h-5 shrink-0 text-cyan-400" />
          <div><h2 className="font-bold text-white">{title}</h2><p className="mt-1 text-sm leading-relaxed text-slate-300">{description}</p></div>
        </div>
      ))}
    </section>

    <section className="flex items-start gap-3 rounded-xl border border-amber-900 bg-amber-950/20 p-4 text-sm text-slate-300">
      <Truck className="mt-0.5 w-5 h-5 shrink-0 text-amber-300" />
      <p>A* routing uses the project’s deterministic prototype graph. Route states can indicate a found route, unavailable routing, or an airlift requirement when no feasible path exists.</p>
    </section>
  </div>
);
