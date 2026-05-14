import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, getCurrentUser, isAuthenticated } from '../services/auth';
import {
  getProjects,
  createProject,
  deleteProject,
  updateProjectStatus,
  Project,
} from '../services/project';

const PROJECT_STATUS_OPTIONS = ['ACTIVE', 'DEGRADED', 'INACTIVE'];
const PROJECT_REGION_OPTIONS = ['US-EAST-1', 'US-WEST-2', 'EU-WEST-1', 'AP-SOUTH-1'];

const Home: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectRegion, setNewProjectRegion] = useState('US-EAST-1');
  const [newProjectStatus, setNewProjectStatus] = useState('ACTIVE');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdApiKey, setCreatedApiKey] = useState('');
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(null);
  const [actionProjectId, setActionProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'collaborator' | 'documentation'>('home');

  useEffect(() => {
    if (!openMenuProjectId) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const menuRoot = target.closest(`[data-project-menu="${openMenuProjectId}"]`);

      if (!menuRoot) {
        setOpenMenuProjectId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [openMenuProjectId]);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/');
      return;
    }
    loadProjects();
  }, [navigate]);

  const loadProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);

    try {
      const createdProject = await createProject({
        name: newProjectName.trim(),
        description: newProjectDescription.trim(),
        region: newProjectRegion,
        status: newProjectStatus,
      });
      setCreatedApiKey(createdProject.apiKey || '');
      setCopiedApiKey(false);
      setNewProjectName('');
      setNewProjectDescription('');
      setNewProjectRegion('US-EAST-1');
      setNewProjectStatus('ACTIVE');
      await loadProjects();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectRegion('US-EAST-1');
    setNewProjectStatus('ACTIVE');
    setCreateError('');
    setCreatedApiKey('');
    setCopiedApiKey(false);
  };

  const handleCopyApiKey = async () => {
    try {
      await navigator.clipboard.writeText(createdApiKey);
      setCopiedApiKey(true);
    } catch {
      setCreateError('Failed to copy API key. Please copy it manually.');
    }
  };

  const handleDisableProject = async (projectId: string) => {
    try {
      setActionProjectId(projectId);
      await updateProjectStatus(projectId, 'INACTIVE');
      setOpenMenuProjectId(null);
      await loadProjects();
    } catch (error) {
      console.error('Failed to disable project:', error);
    } finally {
      setActionProjectId(null);
    }
  };

  const handleEnableProject = async (projectId: string) => {
    try {
      setActionProjectId(projectId);
      await updateProjectStatus(projectId, 'ACTIVE');
      setOpenMenuProjectId(null);
      await loadProjects();
    } catch (error) {
      console.error('Failed to enable project:', error);
    } finally {
      setActionProjectId(null);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const confirmed = window.confirm('Delete this project? This action cannot be undone.');
    if (!confirmed) return;

    try {
      setActionProjectId(projectId);
      await deleteProject(projectId);
      setOpenMenuProjectId(null);
      await loadProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      setActionProjectId(null);
    }
  };

  const getProjectStats = (project: Project) => {
    return {
      activeServices: project._count?.services ?? project.services?.length ?? 0,
    };
  };

  const filteredProjects = projects.filter(p => 
    `${p.name} ${p.description ?? ''}`.toLowerCase().includes(filterText.toLowerCase())
  );

  const pageTitle =
    activeTab === 'home'
      ? 'Home'
      : activeTab === 'collaborator'
      ? 'Add Collaborator'
      : 'Documentation';

  const pageSubtitle =
    activeTab === 'home'
      ? 'Manage and monitor your backend services'
      : activeTab === 'collaborator'
      ? 'Invite teammates to collaborate on projects'
      : 'SDK setup and dashboard usage guide';

  return (
    <div className="min-h-screen bg-paper text-ink flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r-4 border-ink flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b-2 border-ink">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-ink text-paper border-2 border-ink">
              <span className="text-sm font-bold">BM</span>
            </div>
            <span className="text-xl font-black uppercase tracking-tight">
              BackendMonitor
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`w-full text-left px-4 py-3 border-2 border-ink font-bold text-sm uppercase tracking-wide transition-colors ${
              activeTab === 'home'
                ? 'bg-primary text-white shadow-hard'
                : 'bg-white hover:bg-paper'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => setActiveTab('collaborator')}
            className={`w-full text-left px-4 py-3 border-2 border-ink font-bold text-sm uppercase tracking-wide transition-colors ${
              activeTab === 'collaborator'
                ? 'bg-primary text-white shadow-hard'
                : 'bg-white hover:bg-paper'
            }`}
          >
            Add Collaborator
          </button>
          <button
            onClick={() => setActiveTab('documentation')}
            className={`w-full text-left px-4 py-3 border-2 border-ink font-bold text-sm uppercase tracking-wide transition-colors ${
              activeTab === 'documentation'
                ? 'bg-primary text-white shadow-hard'
                : 'bg-white hover:bg-paper'
            }`}
          >
            Documentation
          </button>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t-2 border-ink">
          <div className="flex items-center justify-between p-3 bg-paper border-2 border-ink">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary text-white flex items-center justify-center border-2 border-ink font-bold text-xs">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-bold truncate max-w-[120px]">
                {user?.email || 'User'}
              </span>
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="bg-white border-b-4 border-ink px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight mb-1">{pageTitle}</h1>
              <p className="text-sm text-ink/60 font-mono">
                {pageSubtitle}
              </p>
            </div>
            {activeTab === 'home' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-primary text-white px-6 py-3 border-2 border-ink shadow-hard font-bold text-sm uppercase tracking-wide hover:bg-primary-bright transition-colors"
              >
                + New Project
              </button>
            )}
          </div>

          {/* Search/Filter Bar */}
          {activeTab === 'home' && (
            <div className="mt-6">
              <input
                type="text"
                placeholder="Search projects..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full px-4 py-3 border-2 border-ink shadow-hard text-sm font-mono focus:outline-none focus:border-primary"
              />
            </div>
          )}
        </header>

        {/* Projects Grid */}
        <main className="flex-1 overflow-auto p-8">
          {activeTab === 'home' && (loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block w-12 h-12 border-4 border-ink border-t-primary animate-spin"></div>
                <p className="mt-4 text-sm font-bold uppercase tracking-wide text-ink/60">
                  Loading Projects...
                </p>
              </div>
            </div>
          ) : filteredProjects.length === 0 && filterText === '' ? (
            // Empty State
            <div className="flex items-center justify-center h-64">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 bg-paper border-4 border-ink mx-auto mb-6 flex items-center justify-center">
                  <span className="text-4xl">📦</span>
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight mb-2">
                  No Projects Yet
                </h2>
                <p className="text-sm text-ink/60 mb-6">
                  Create your first project to start monitoring your backend services
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-primary text-white px-8 py-3 border-2 border-ink shadow-hard font-bold text-sm uppercase tracking-wide hover:bg-primary-bright transition-colors"
                >
                  Create First Project
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Project Cards */}
              {filteredProjects.map((project) => {
                const stats = getProjectStats(project);
                return (
                  <div
                    key={project.id}
                    className="bg-white border-2 border-ink shadow-hard hover:shadow-hard-lg transition-all"
                  >
                    {/* Card Header */}
                    <div className="border-b-2 border-ink p-5 bg-paper">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-2">
                          <h3 className="text-lg font-black uppercase tracking-tight">
                            {project.name}
                          </h3>
                          <div className="relative" data-project-menu={project.id}>
                            <button
                              onClick={() => setOpenMenuProjectId(openMenuProjectId === project.id ? null : project.id)}
                              className="w-7 h-7 border-2 border-ink bg-white text-ink font-black text-sm leading-none hover:bg-paper"
                              title="Project options"
                            >
                              ⋮
                            </button>
                            {openMenuProjectId === project.id && (
                              <div className="absolute left-full ml-2 top-0 w-36 bg-white border-2 border-ink shadow-hard z-20">
                                {project.status === 'INACTIVE' ? (
                                  <button
                                    onClick={() => handleEnableProject(project.id)}
                                    disabled={actionProjectId === project.id}
                                    className="w-full text-left px-3 py-2 text-xs font-bold uppercase tracking-wide border-b border-ink hover:bg-paper disabled:opacity-60"
                                  >
                                    Enable
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleDisableProject(project.id)}
                                    disabled={actionProjectId === project.id}
                                    className="w-full text-left px-3 py-2 text-xs font-bold uppercase tracking-wide border-b border-ink hover:bg-paper disabled:opacity-60"
                                  >
                                    Disable
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteProject(project.id)}
                                  disabled={actionProjectId === project.id}
                                  className="w-full text-left px-3 py-2 text-xs font-bold uppercase tracking-wide hover:bg-paper disabled:opacity-60"
                                >
                                  Delete Project
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <span
                          className={`w-4 h-4 rounded-full border-2 border-ink ${
                            project.status === 'ACTIVE'
                              ? 'bg-primary-bright'
                              : project.status === 'DEGRADED'
                              ? 'bg-yellow-400'
                              : 'bg-ink/30'
                          }`}
                        ></span>
                      </div>
                      <p className="text-xs font-mono text-ink/60">
                        ID: {project.id.slice(0, 8)}...
                      </p>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-ink/60">
                        <span>Region</span>
                        <span className="font-mono text-ink">{project.region}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-ink/60">
                        <span>Status</span>
                        <span className="font-mono text-ink">{project.status}</span>
                      </div>
                      {project.description && (
                        <p className="text-xs text-ink/70 border border-ink/20 bg-paper px-3 py-2">
                          {project.description}
                        </p>
                      )}
                      {/* Active Services */}
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wide text-ink/60">
                            Active Services
                          </span>
                          <span className="text-2xl font-black font-mono">
                            {stats.activeServices}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="border-t-2 border-ink p-3 bg-paper">
                      <button
                        onClick={() => navigate(`/dashboard/${project.id}`)}
                        className="w-full bg-ink text-paper px-4 py-3 text-xs font-bold uppercase tracking-wide hover:bg-primary transition-colors"
                      >
                        View Dashboard
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Initialize New Card */}
              <div
                onClick={() => setShowCreateModal(true)}
                className="bg-white border-2 border-dashed border-ink hover:border-primary hover:bg-paper transition-all cursor-pointer p-6 flex flex-col items-center justify-center min-h-[240px] group"
              >
                <div className="w-14 h-14 border-4 border-ink border-dashed rounded-full flex items-center justify-center mb-3 group-hover:border-primary transition-colors">
                  <span className="text-2xl font-bold text-ink/40 group-hover:text-primary transition-colors">+</span>
                </div>
                <h3 className="text-base font-black uppercase tracking-tight mb-2">
                  Initialize New
                </h3>
                <p className="text-xs text-ink/60 text-center">
                  Create a new project to track
                </p>
              </div>
            </div>
          ))}

          {activeTab === 'collaborator' && (
            <div className="max-w-3xl mx-auto">
              <section className="bg-white border-2 border-ink shadow-hard p-8 text-center">
                <h2 className="text-2xl font-black uppercase tracking-tight mb-3">Add Collaborator</h2>
                <p className="text-sm text-ink/70 font-mono">Feature building soon.</p>
              </section>
            </div>
          )}

          {activeTab === 'documentation' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <section className="bg-white border-2 border-ink shadow-hard p-6">
                <h2 className="text-xl font-black uppercase mb-3">Step 1: Install SDK</h2>
                <pre className="bg-paper border border-ink p-3 text-xs overflow-x-auto">pnpm add backend-monitoring-sdk</pre>
              </section>

              <section className="bg-white border-2 border-ink shadow-hard p-6">
                <h2 className="text-xl font-black uppercase mb-3">Step 2: Import in Express</h2>
                <pre className="bg-paper border border-ink p-3 text-xs overflow-x-auto">{`import express from "express";\nimport { monitorMiddleware, startSystemMetrics } from "backend-monitoring-sdk";`}</pre>
              </section>

              <section className="bg-white border-2 border-ink shadow-hard p-6">
                <h2 className="text-xl font-black uppercase mb-3">Step 3: Configure API key</h2>
                <pre className="bg-paper border border-ink p-3 text-xs overflow-x-auto">{`const config = {\n  serviceName: "orders-service",\n  collectorUrl: "http://localhost:4000/collect",\n  apiKey: process.env.BM_API_KEY || "",\n};\n\napp.use(monitorMiddleware(config));\nstartSystemMetrics(config, 10000);`}</pre>
              </section>

              <section className="bg-white border-2 border-ink shadow-hard p-6">
                <h2 className="text-xl font-black uppercase mb-3">Step 4: Monitor on dashboard</h2>
                <p className="text-sm text-ink/70 leading-relaxed">
                  Create a project, copy API key, send traffic from your service, then open project dashboards to monitor request and system metrics.
                </p>
              </section>
            </div>
          )}
        </main>

        {/* Global Stats Footer */}
        <footer className="bg-ink text-paper border-t-4 border-primary px-8 py-6">
          <div className="grid grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-paper/60 mb-2">
                Total API Requests
              </p>
              <p className="text-2xl font-black font-mono">1.2M</p>
              <p className="text-xs text-primary-bright font-bold mt-1">↑ 12%</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-paper/60 mb-2">
                Avg Global Latency
              </p>
              <p className="text-2xl font-black font-mono">45ms</p>
              <p className="text-xs text-primary-bright font-bold mt-1">↓ 8%</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-paper/60 mb-2">
                Active Integrations
              </p>
              <p className="text-2xl font-black font-mono">{projects.length}</p>
              <p className="text-xs text-paper/60 mt-1">projects</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-paper/60 mb-2">
                System Status
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="w-3 h-3 bg-primary-bright rounded-full animate-pulse"></span>
                <span className="text-sm font-bold uppercase">All Systems Operational</span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-ink shadow-hard-lg max-w-md w-full">
            {/* Modal Header */}
            <div className="border-b-4 border-ink p-6 bg-paper">
              <h2 className="text-2xl font-black uppercase tracking-tight">
                {createdApiKey ? 'Project Created' : 'Create New Project'}
              </h2>
              <p className="text-xs text-ink/60 mt-2">
                {createdApiKey
                  ? 'Copy and save this API key now. You may not see it again.'
                  : 'Set up a new monitoring project for your backend service'}
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {!createdApiKey ? (
                <>
                  <label className="block mb-2 text-xs font-bold uppercase tracking-wide text-ink/60">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g., Production API"
                    className="w-full px-4 py-3 border-2 border-ink shadow-hard text-sm font-mono focus:outline-none focus:border-primary mb-4"
                    autoFocus
                  />

                  <label className="block mb-2 text-xs font-bold uppercase tracking-wide text-ink/60">
                    Description
                  </label>
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="e.g., Handles production traffic for core APIs"
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-ink shadow-hard text-sm font-mono focus:outline-none focus:border-primary mb-4 resize-none"
                  />

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block mb-2 text-xs font-bold uppercase tracking-wide text-ink/60">
                        Region
                      </label>
                      <select
                        value={newProjectRegion}
                        onChange={(e) => setNewProjectRegion(e.target.value)}
                        className="w-full px-3 py-3 border-2 border-ink bg-white text-sm font-mono focus:outline-none focus:border-primary"
                      >
                        {PROJECT_REGION_OPTIONS.map((region) => (
                          <option key={region} value={region}>
                            {region}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block mb-2 text-xs font-bold uppercase tracking-wide text-ink/60">
                        Status
                      </label>
                      <select
                        value={newProjectStatus}
                        onChange={(e) => setNewProjectStatus(e.target.value)}
                        className="w-full px-3 py-3 border-2 border-ink bg-white text-sm font-mono focus:outline-none focus:border-primary"
                      >
                        {PROJECT_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <label className="block mb-2 text-xs font-bold uppercase tracking-wide text-ink/60">
                    API Key
                  </label>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={createdApiKey}
                      readOnly
                      className="flex-1 px-4 py-3 border-2 border-ink bg-paper text-sm font-mono"
                    />
                    <button
                      onClick={handleCopyApiKey}
                      className="px-4 py-3 border-2 border-ink bg-white hover:bg-paper text-ink font-bold text-xs uppercase tracking-wide transition-colors"
                    >
                      {copiedApiKey ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </>
              )}

              {createError && (
                <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500">
                  <p className="text-xs text-red-600 font-bold">{createError}</p>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex gap-3">
                {createdApiKey ? (
                  <button
                    onClick={handleCloseCreateModal}
                    className="w-full px-4 py-3 border-2 border-ink bg-primary hover:bg-primary-bright text-white font-bold text-sm uppercase tracking-wide shadow-hard transition-colors"
                  >
                    Okay
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleCloseCreateModal}
                      disabled={creating}
                      className="flex-1 px-4 py-3 border-2 border-ink bg-white hover:bg-paper text-ink font-bold text-sm uppercase tracking-wide transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateProject}
                      disabled={creating || !newProjectName.trim() || !newProjectDescription.trim()}
                      className="flex-1 px-4 py-3 border-2 border-ink bg-primary hover:bg-primary-bright text-white font-bold text-sm uppercase tracking-wide shadow-hard transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creating ? 'Creating...' : 'Create'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
