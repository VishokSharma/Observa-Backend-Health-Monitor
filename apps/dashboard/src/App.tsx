import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import Home from './pages/Dashboard';
import ProjectDashboard from './pages/ProjectDashboard';
import ServiceMetricsPage from './pages/ServiceMetricsPage';
import ApiInfoPage from './pages/ApiInfoPage';
import PricingPage from './pages/PricingPage';
import DocumentationPage from './pages/DocumentationPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home-landing" element={<HomePage />} />
        <Route path="/home" element={<Home />} />
        <Route path="/dashboard/:projectId" element={<ProjectDashboard />} />
        <Route path="/dashboard/:projectId/service/:serviceName" element={<ServiceMetricsPage />} />
        <Route path="/docs" element={<DocumentationPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/api" element={<ApiInfoPage />} />
        <Route path="/dashboard" element={<Navigate to="/home" replace />} />
      </Routes>
    </Router>
  );
}

export default App;