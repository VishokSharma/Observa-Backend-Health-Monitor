import React from 'react';
import { Link } from 'react-router-dom';

const ApiInfoPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-black uppercase tracking-tight">BackendMonitor API</h1>
          <Link
            to="/"
            className="bg-ink text-white px-4 py-2 border-2 border-ink font-bold text-sm uppercase tracking-wide"
          >
            Back
          </Link>
        </div>

        <div className="bg-white border-2 border-ink shadow-hard p-6 mb-6">
          <h2 className="text-xl font-black uppercase mb-3">What this API does</h2>
          <p className="text-sm text-ink/70 leading-relaxed">
            The API handles auth, project setup, API key management, and metric ingestion from SDK clients.
            SDK clients send request and system telemetry to <span className="font-mono">POST /collect</span>.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-white border-2 border-ink p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-3">Core endpoints</h3>
            <ul className="space-y-2 text-sm font-mono">
              <li>POST /auth/signup</li>
              <li>POST /auth/signin</li>
              <li>POST /create/project</li>
              <li>POST /create/apikey/:projectId</li>
              <li>POST /collect (x-api-key required)</li>
            </ul>
          </section>

          <section className="bg-white border-2 border-ink p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-3">SDK package</h3>
            <p className="text-sm text-ink/70 mb-2">Install:</p>
            <pre className="bg-paper border border-ink p-3 text-xs overflow-x-auto">pnpm add backend-monitoring-sdk</pre>
            <p className="text-sm text-ink/70 mt-4 mb-2">Imports:</p>
            <pre className="bg-paper border border-ink p-3 text-xs overflow-x-auto">{`import { monitorMiddleware, startSystemMetrics } from "backend-monitoring-sdk";`}</pre>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ApiInfoPage;
