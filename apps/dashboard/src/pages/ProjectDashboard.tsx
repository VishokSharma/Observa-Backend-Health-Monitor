import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { logout, getCurrentUser, isAuthenticated } from '../services/auth';
import {
  createProjectApiKey,
  createService,
  getProjectDetails,
  getProjectServices,
  Project,
  Service,
} from '../services/project';

const SERVICE_STATUS_OPTIONS = ['ACTIVE', 'DEGRADED', 'INACTIVE'];

const ProjectDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const user = getCurrentUser();

  const [project, setProject] = useState<Project | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [serviceStatus, setServiceStatus] = useState('ACTIVE');
  const [serviceUptime, setServiceUptime] = useState('99.9');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [apiKeyError, setApiKeyError] = useState('');
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState<string | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/');
      return;
    }

    if (!projectId) {
      navigate('/home');
      return;
    }

    loadProjectData(projectId);
  }, [navigate, projectId]);

  const loadProjectData = async (id: string) => {
    try {
      setLoading(true);
      setError('');

      const [projectData, serviceData] = await Promise.all([
        getProjectDetails(id),
        getProjectServices(id),
      ]);

      setProject(projectData);
      setServices(serviceData);
    } catch (err: any) {
      setError(err.message || 'Failed to load project dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    setCreateError('');
    setCreating(true);

    try {
      const created = await createService({
        projectId,
        serviceName: serviceName.trim(),
        status: serviceStatus,
        uptime: Number(serviceUptime),
      });
      setServices((prev) => [created, ...prev]);
      setServiceName('');
      setServiceStatus('ACTIVE');
      setServiceUptime('99.9');
      setShowCreateModal(false);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create service');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!projectId) return;

    try {
      setApiKeyError('');
      setGeneratingApiKey(true);
      await createProjectApiKey(projectId);

      const refreshedProject = await getProjectDetails(projectId);
      setProject(refreshedProject);
    } catch (err: any) {
      setApiKeyError(err.message || 'Failed to create API key');
    } finally {
      setGeneratingApiKey(false);
    }
  };

  const handleCopyApiKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedApiKey(key);
    } catch {
      setApiKeyError('Failed to copy API key. Please copy it manually.');
    }
  };

  const toggleApiKeyVisibility = (apiKeyId: string) => {
    setVisibleApiKeys((prev) => ({
      ...prev,
      [apiKeyId]: !prev[apiKeyId],
    }));
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 12) return key;
    return `${key.slice(0, 8)}...${key.slice(-8)}`;
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex">
      <aside className="w-64 bg-white border-r-4 border-ink flex flex-col">
        <div className="p-6 border-b-2 border-ink">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-ink text-paper border-2 border-ink">
              <span className="text-sm font-bold">BM</span>
            </div>
            <span className="text-xl font-black uppercase tracking-tight">BackendMonitor</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => navigate('/home')}
            className="w-full text-left px-4 py-3 bg-white hover:bg-paper border-2 border-ink font-bold text-sm uppercase tracking-wide transition-colors"
          >
            Home
          </button>
          <button className="w-full text-left px-4 py-3 bg-primary text-white border-2 border-ink shadow-hard font-bold text-sm uppercase tracking-wide">
            Dashboard
          </button>
        </nav>

        <div className="p-4 border-t-2 border-ink">
          <div className="flex items-center justify-between p-3 bg-paper border-2 border-ink">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary text-white flex items-center justify-center border-2 border-ink font-bold text-xs">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-bold truncate max-w-[120px]">{user?.email || 'User'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-ink/60 hover:text-ink font-bold"
              title="Logout"
            >
              ↗
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b-4 border-ink px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="mb-3 px-4 py-2 border-2 border-ink bg-white hover:bg-paper text-ink font-bold text-xs uppercase tracking-wide shadow-hard transition-colors"
              >
                API Keys
              </button>
              <h1 className="text-3xl font-black uppercase tracking-tight mb-1">
                {project?.name || 'Project'} Dashboard
              </h1>
              <p className="text-sm text-ink/60 font-mono">Services under this project</p>
              {project && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-mono">
                  <span className="px-2 py-1 border border-ink bg-paper">Region: {project.region}</span>
                  <span className="px-2 py-1 border border-ink bg-paper">Status: {project.status}</span>
                  {project.description && (
                    <span className="px-2 py-1 border border-ink bg-paper">{project.description}</span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary text-white px-6 py-3 border-2 border-ink shadow-hard font-bold text-sm uppercase tracking-wide hover:bg-primary-bright transition-colors"
            >
              + New Service
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block w-12 h-12 border-4 border-ink border-t-primary animate-spin"></div>
                <p className="mt-4 text-sm font-bold uppercase tracking-wide text-ink/60">Loading Dashboard...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-white border-2 border-ink p-6 max-w-xl">
              <p className="text-sm font-bold text-red-600">{error}</p>
              <button
                onClick={() => navigate('/home')}
                className="mt-4 px-4 py-2 border-2 border-ink bg-paper hover:bg-white font-bold text-xs uppercase tracking-wide"
              >
                Back to Home
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white border-2 border-ink shadow-hard">
                <div className="border-b-2 border-ink p-5 bg-paper flex items-center justify-between">
                  <h2 className="text-lg font-black uppercase tracking-tight">Services</h2>
                  <span className="text-xs font-bold uppercase tracking-wide text-ink/60">
                    Total: {services.length}
                  </span>
                </div>

                {services.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-ink/60 mb-4">No services created yet.</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-6 py-3 border-2 border-ink bg-primary text-white font-bold text-sm uppercase tracking-wide shadow-hard hover:bg-primary-bright transition-colors"
                    >
                      Create First Service
                    </button>
                  </div>
                ) : (
                  <div className="divide-y-2 divide-ink">
                    <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-paper text-[11px] font-bold uppercase tracking-wide text-ink/70">
                      <div className="col-span-1">#</div>
                      <div className="col-span-3">Name</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-2">Uptime</div>
                      <div className="col-span-2">ID</div>
                      <div className="col-span-2 text-right">Date</div>
                    </div>
                    {services.map((service, index) => (
                      <button
                        key={service.id}
                        onClick={() => navigate(`/dashboard/${projectId}/service/${encodeURIComponent(service.name)}`)}
                        className="w-full text-left grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-paper transition-colors"
                      >
                        <div className="col-span-1 text-xs font-mono text-ink/60">{index + 1}</div>
                        <div className="col-span-3 text-sm font-bold uppercase tracking-wide">{service.name}</div>
                        <div className="col-span-2 text-xs font-mono text-ink/60">{service.status}</div>
                        <div className="col-span-2 text-xs font-mono text-ink/60">{service.uptime.toFixed(1)}%</div>
                        <div className="col-span-2 text-xs font-mono text-ink/60">ID: {service.id.slice(0, 8)}...</div>
                        <div className="col-span-2 text-xs font-mono text-ink/60 text-right">
                          {new Date(service.createdAt).toLocaleDateString()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-ink shadow-hard-lg max-w-md w-full">
            <div className="border-b-4 border-ink p-6 bg-paper">
              <h2 className="text-2xl font-black uppercase tracking-tight">Create New Service</h2>
              <p className="text-xs text-ink/60 mt-2">Add a service under this project</p>
            </div>

            <div className="p-6">
              <label className="block mb-2 text-xs font-bold uppercase tracking-wide text-ink/60">
                Service Name
              </label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g., User API"
                className="w-full px-4 py-3 border-2 border-ink shadow-hard text-sm font-mono focus:outline-none focus:border-primary mb-4"
                autoFocus
              />

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block mb-2 text-xs font-bold uppercase tracking-wide text-ink/60">
                    Status
                  </label>
                  <select
                    value={serviceStatus}
                    onChange={(e) => setServiceStatus(e.target.value)}
                    className="w-full px-3 py-3 border-2 border-ink bg-white text-sm font-mono focus:outline-none focus:border-primary"
                  >
                    {SERVICE_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 text-xs font-bold uppercase tracking-wide text-ink/60">
                    Uptime (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={serviceUptime}
                    onChange={(e) => setServiceUptime(e.target.value)}
                    className="w-full px-3 py-3 border-2 border-ink shadow-hard text-sm font-mono focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {createError && (
                <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500">
                  <p className="text-xs text-red-600 font-bold">{createError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setServiceName('');
                    setServiceStatus('ACTIVE');
                    setServiceUptime('99.9');
                    setCreateError('');
                  }}
                  disabled={creating}
                  className="flex-1 px-4 py-3 border-2 border-ink bg-white hover:bg-paper text-ink font-bold text-sm uppercase tracking-wide transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateService}
                  disabled={
                    creating ||
                    !serviceName.trim() ||
                    !serviceUptime ||
                    Number(serviceUptime) < 0 ||
                    Number(serviceUptime) > 100
                  }
                  className="flex-1 px-4 py-3 border-2 border-ink bg-primary hover:bg-primary-bright text-white font-bold text-sm uppercase tracking-wide shadow-hard transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showApiKeyModal && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-ink shadow-hard-lg max-w-2xl w-full">
            <div className="border-b-4 border-ink p-6 bg-paper flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">API Keys</h2>
                <p className="text-xs text-ink/60 mt-2">View existing keys or create a new key</p>
              </div>
              <button
                onClick={handleCreateApiKey}
                disabled={generatingApiKey}
                className="px-4 py-2 border-2 border-ink bg-primary hover:bg-primary-bright text-white font-bold text-xs uppercase tracking-wide shadow-hard transition-colors disabled:opacity-50"
              >
                {generatingApiKey ? 'Creating...' : '+ New API Key'}
              </button>
            </div>

            <div className="p-6">
              {apiKeyError && (
                <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500">
                  <p className="text-xs text-red-600 font-bold">{apiKeyError}</p>
                </div>
              )}

              <div className="space-y-3 max-h-[340px] overflow-auto pr-1">
                {project?.apiKeys && project.apiKeys.length > 0 ? (
                  project.apiKeys.map((apiKey) => {
                    const isVisible = !!visibleApiKeys[apiKey.id];

                    return (
                      <div key={apiKey.id} className="border-2 border-ink p-3 bg-paper">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-ink/70">
                            {apiKey.isActive ? 'Active' : 'Disabled'}
                          </span>
                          <span className="text-[11px] font-mono text-ink/60">
                            {new Date(apiKey.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={isVisible ? apiKey.key : maskApiKey(apiKey.key)}
                            className="flex-1 px-3 py-2 border border-ink bg-white text-xs font-mono"
                          />
                          <button
                            onClick={() => toggleApiKeyVisibility(apiKey.id)}
                            className="px-3 py-2 border-2 border-ink bg-white hover:bg-paper text-ink font-bold text-xs uppercase tracking-wide"
                          >
                            {isVisible ? 'Hide' : 'View'}
                          </button>
                          <button
                            onClick={() => handleCopyApiKey(apiKey.key)}
                            className="px-3 py-2 border-2 border-ink bg-white hover:bg-paper text-ink font-bold text-xs uppercase tracking-wide"
                          >
                            {copiedApiKey === apiKey.key ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-ink/60">No API keys available.</p>
                )}
              </div>

              <div className="mt-5">
                <button
                  onClick={() => setShowApiKeyModal(false)}
                  className="w-full px-4 py-3 border-2 border-ink bg-white hover:bg-paper text-ink font-bold text-sm uppercase tracking-wide transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDashboard;
