import React from 'react';
import { Link } from 'react-router-dom';

const DocumentationPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-4xl font-black uppercase tracking-tight">Documentation</h1>
          <Link
            to="/"
            className="bg-ink text-white px-4 py-2 border-2 border-ink font-bold text-sm uppercase tracking-wide"
          >
            Back
          </Link>
        </div>

        <section className="bg-white border-2 border-ink shadow-hard p-6 mb-6">
          <h2 className="text-xl font-black uppercase mb-3">Step 1: Install SDK</h2>
          <pre className="bg-paper border border-ink p-3 text-xs overflow-x-auto">pnpm add backend-monitoring-sdk</pre>
        </section>

        <section className="bg-white border-2 border-ink shadow-hard p-6 mb-6">
          <h2 className="text-xl font-black uppercase mb-3">Step 2: Import in Express</h2>
          <pre className="bg-paper border border-ink p-3 text-xs overflow-x-auto">{`import express from "express";
import { monitorMiddleware, startSystemMetrics } from "backend-monitoring-sdk";`}</pre>
        </section>

        <section className="bg-white border-2 border-ink shadow-hard p-6 mb-6">
          <h2 className="text-xl font-black uppercase mb-3">Step 3: Configure + use API key</h2>
          <pre className="bg-paper border border-ink p-3 text-xs overflow-x-auto">{`const config = {
  serviceName: "orders-service",
  collectorUrl: "http://localhost:4000/collect",
  apiKey: process.env.BM_API_KEY || "",
};

app.use(monitorMiddleware(config));
startSystemMetrics(config, 10000);`}</pre>
          <p className="text-sm text-ink/70 mt-3">
            Create API keys from the dashboard by creating a project first, then use the key in <span className="font-mono">BM_API_KEY</span>.
          </p>
        </section>

        <section className="bg-white border-2 border-ink shadow-hard p-6">
          <h2 className="text-xl font-black uppercase mb-3">Step 4: Monitor on dashboard</h2>
          <p className="text-sm text-ink/70 leading-relaxed">
            Open Home, pick your project, and inspect latency, request counts, error rates, CPU, and memory charts.
          </p>
        </section>
      </div>
    </div>
  );
};

export default DocumentationPage;
