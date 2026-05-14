import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { handleGoogleAuthCallbackFromUrl, login, signup, startGoogleAuth } from "../services/auth";

const LandingPage: React.FC = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const completedGoogleAuth = handleGoogleAuthCallbackFromUrl();
      if (completedGoogleAuth) {
        navigate('/home', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Google authentication failed');
      setShowAuthModal(true);
      setIsLogin(true);
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      await login(email, password);
      setShowAuthModal(false);
      navigate('/home');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      await signup(email, password, name);
      setShowAuthModal(false);
      navigate('/home');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-paper text-ink font-display antialiased overflow-x-hidden selection:bg-primary/20">
      <nav className="sticky top-0 z-50 w-full bg-paper border-b border-ink/10">
        <div className="mx-auto max-w-[1400px] px-6 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center bg-ink text-paper">
              <span className="text-sm font-bold">BM</span>
            </div>
            <span className="text-lg font-bold tracking-tight uppercase">
              BackendMonitor
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => navigate('/docs')} className="text-sm font-semibold uppercase tracking-wider hover:text-primary transition-colors cursor-pointer">
              Documentation
            </button>
            <button onClick={() => navigate('/pricing')} className="text-sm font-semibold uppercase tracking-wider hover:text-primary transition-colors cursor-pointer">
              Pricing
            </button>
            <button onClick={() => navigate('/api')} className="text-sm font-semibold uppercase tracking-wider hover:text-primary transition-colors cursor-pointer">
              API Ref
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setIsLogin(true);
                setShowAuthModal(true);
              }}
              className="text-sm font-semibold underline hover:text-primary transition-colors cursor-pointer"
            >
              Log In
            </button>
            <button 
              onClick={() => {
                setIsLogin(false);
                setShowAuthModal(true);
              }}
              className="bg-primary text-white px-6 py-2.5 text-sm font-bold uppercase tracking-wide hover:bg-primary/90 transition-colors"
            >
              Start Blueprint
            </button>
          </div>
        </div>
      
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary-bright to-primary"></div>
      </nav>

    
      <header className="relative w-full border-b border-ink bg-grid-pattern">
        <div className="mx-auto max-w-[1400px] grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
          
          <div className="lg:col-span-7 flex flex-col justify-center px-6 py-20 lg:border-r border-ink bg-paper/90">
            
            <div className="inline-flex items-center gap-2 mb-6 border border-ink px-3 py-1 w-fit bg-white shadow-hard-sm">
              <span className="w-2 h-2 bg-primary-bright rounded-full animate-pulse"></span>
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-ink">
                All Systems Operational
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-ink leading-[0.9] tracking-tighter mb-8 uppercase">
              Real-Time Backend <br />
              <span className="text-primary underline decoration-4 underline-offset-4">
                Observability
              </span>
            </h1>

            <p className="text-lg md:text-xl font-medium text-ink/80 max-w-xl leading-relaxed mb-10 border-l-4 border-primary pl-6">
              Monitor API latency, success rates, error spikes, and infrastructure
              health in real-time. Built for scalable microservices and distributed systems.
            </p>

            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => navigate('/home')}
                className="bg-ink text-white px-8 py-4 text-base font-bold uppercase tracking-wide shadow-hard hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
              >
                View Home
              </button>
              <button 
                onClick={() => navigate('/api')}
                className="bg-white text-ink px-8 py-4 text-base font-bold uppercase tracking-wide shadow-hard border-2 border-ink hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
              >
                Explore API
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 relative flex items-center justify-center p-10 bg-paper">
            <div className="relative w-full max-w-lg bg-white border-4 border-ink shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] p-8 rotate-2 hover:rotate-0 transition-transform duration-300">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-ink">
                <div>
                  <h3 className="font-bold uppercase text-lg tracking-tight">
                    System Topology
                  </h3>
                  <p className="text-xs text-ink/60 font-mono mt-1">
                    ID: #MONITOR-{Math.random().toString(36).substr(2, 6).toUpperCase()}
                  </p>
                </div>
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary-bright"></div>
                  <div className="w-2 h-2 rounded-full bg-primary-bright"></div>
                  <div className="w-2 h-2 rounded-full bg-primary-bright"></div>
                </div>
              </div>

              {/* SDK Integration Node */}
              <div className="mb-6 flex justify-center">
                <div className="border-2 border-ink bg-primary/10 px-6 py-3 shadow-hard-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📊</span>
                    <span className="font-bold text-sm">Backend Monitor SDK</span>
                  </div>
                  <div className="text-xs text-ink/60 font-mono mt-1 text-center">
                    Collecting Metrics
                  </div>
                </div>
              </div>

              {/* Connection Line */}
              <div className="flex justify-center mb-6">
                <div className="border-l-2 border-dashed border-ink h-8"></div>
              </div>

              {/* Metrics Collection Nodes */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="border-2 border-ink bg-white p-4">
                  <div className="font-bold text-sm mb-2">📈 Request Metrics</div>
                  <div className="text-xs text-primary-bright font-mono font-bold">
                    Latency: 45ms
                  </div>
                  <div className="text-xs text-ink/60 font-mono mt-1">
                    Success: 99.2%
                  </div>
                </div>
                <div className="border-2 border-ink bg-white p-4">
                  <div className="font-bold text-sm mb-2">⚙️ System Metrics</div>
                  <div className="text-xs text-primary-bright font-mono font-bold">
                    CPU: 42%
                  </div>
                  <div className="text-xs text-ink/60 font-mono mt-1">
                    Memory: 1.2GB
                  </div>
                </div>
              </div>

              {/* Connection Line */}
              <div className="flex justify-center mb-6">
                <div className="border-l-2 border-dashed border-ink h-8"></div>
              </div>

              {/* API Health Panel */}
              <div className="bg-ink text-white p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-paper/60">&gt; API_HEALTH</span>
                  <span className="text-primary-bright font-bold">HEALTHY</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-paper/60">&gt; AVG_LATENCY</span>
                  <span className="text-primary-bright font-bold">45ms</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-paper/60">&gt; ERROR_RATE</span>
                  <span className="text-primary-bright font-bold">0.8%</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-paper/60">&gt; THROUGHPUT</span>
                  <span className="text-primary-bright font-bold">2.4k/min</span>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-ink/20 flex justify-between items-center text-xs text-ink/60 font-mono">
                <span>SCALE: 1:1</span>
                <span>REV: 3.2.0</span>
              </div>

            </div>
          </div>

        </div>
      </header>

      <section className="border-b border-ink bg-ink text-paper py-8">
        <div className="mx-auto max-w-[1400px] px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          
          <div className="flex flex-col border-l border-paper/20 pl-4">
            <span className="text-primary-bright font-mono text-3xl font-bold">12ms</span>
            <span className="text-xs uppercase tracking-widest text-paper/60">
              Avg Latency
            </span>
          </div>

          <div className="flex flex-col border-l border-paper/20 pl-4">
            <span className="text-primary-bright font-mono text-3xl font-bold">5.1k</span>
            <span className="text-xs uppercase tracking-widest text-paper/60">
              Requests / Sec
            </span>
          </div>

          <div className="flex flex-col border-l border-paper/20 pl-4">
            <span className="text-primary-bright font-mono text-3xl font-bold">0.02%</span>
            <span className="text-xs uppercase tracking-widest text-paper/60">
              Error Rate
            </span>
          </div>

          <div className="flex flex-col border-l border-paper/20 pl-4">
            <span className="text-primary-bright font-mono text-3xl font-bold">3 Regions</span>
            <span className="text-xs uppercase tracking-widest text-paper/60">
              Active
            </span>
          </div>

        </div>
      </section>

      <main className="mx-auto max-w-[1400px] border-x border-ink bg-paper">
        
        <div className="p-10 border-b border-ink">
          <h2 className="text-3xl font-bold uppercase tracking-tight max-w-2xl">
            Core Monitoring Modules <br />
            <span className="text-primary text-xl normal-case font-serif italic font-medium">
              Built for scale & reliability
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-ink">

          <article className="p-8 hover:bg-white transition-colors">
            <h3 className="text-xl font-bold mb-3">API Health Tracking</h3>
            <p className="text-ink/70 text-sm">
              Capture request counts, status codes, and latency per route.
              Detect failure spikes instantly.
            </p>
          </article>

          <article className="p-8 hover:bg-white transition-colors">
            <h3 className="text-xl font-bold mb-3">Cron-Based Aggregation</h3>
            <p className="text-ink/70 text-sm">
              Aggregate minute-level logs into hourly and daily buckets
              for long-term analytics and dashboards.
            </p>
          </article>

          <article className="p-8 hover:bg-white transition-colors">
            <h3 className="text-xl font-bold mb-3">Alert Engine</h3>
            <p className="text-ink/70 text-sm">
              Trigger Email and Slack notifications when latency,
              error-rate, or downtime thresholds are breached.
            </p>
          </article>

        </div>
      </main>
      <footer className="bg-ink text-paper border-t-4 border-primary">
        <div className="mx-auto max-w-[1400px] px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            
            {/* Brand Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center bg-paper text-ink shadow-hard-sm">
                  <span className="text-xl font-bold">BM</span>
                </div>
                <span className="text-xl font-black tracking-tight uppercase">
                  BackendMonitor
                </span>
              </div>
              <p className="text-sm text-paper/60 max-w-xs leading-relaxed">
                Engineering-grade visualization tools for the modern backend architect. 
                Built for precision and scale.
              </p>
            </div>

            {/* Platform Links */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-paper/40">
                Platform
              </h3>
              <ul className="space-y-3">
                <li>
                  <a href="/docs" className="text-sm text-paper/80 hover:text-primary-bright transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="/api" className="text-sm text-paper/80 hover:text-primary-bright transition-colors">
                    API Reference
                  </a>
                </li>
                <li>
                  <a href="/pricing" className="text-sm text-paper/80 hover:text-primary-bright transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-paper/80 hover:text-primary-bright transition-colors">
                    Integrations
                  </a>
                </li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-paper/40">
                Company
              </h3>
              <ul className="space-y-3">
                <li>
                  <a href="#" className="text-sm text-paper/80 hover:text-primary-bright transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-paper/80 hover:text-primary-bright transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-paper/80 hover:text-primary-bright transition-colors">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-paper/80 hover:text-primary-bright transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Newsletter */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-paper/40">
                Stay Updated
              </h3>
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="email@company.com"
                  className="w-full px-4 py-2.5 bg-paper/10 border border-paper/20 text-paper text-sm placeholder:text-paper/40 focus:outline-none focus:border-primary-bright transition-colors"
                />
                <button className="w-full bg-paper text-ink px-4 py-2.5 text-sm font-bold uppercase tracking-wide hover:bg-primary-bright hover:text-paper transition-colors">
                  Subscribe
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-16 pt-8 border-t border-paper/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-paper/40">
            <p>© 2026 BackendMonitor Systems Inc. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-paper/80 transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-paper/80 transition-colors">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && (
        <div
          onClick={() => setShowAuthModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white border-4 border-ink shadow-[12px_12px_0px_0px_rgba(15,23,42,1)] max-w-sm w-full p-6 animate-in"
          >
            
            {/* Close Button */}
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-ink hover:text-primary transition-colors"
            >
              <span className="text-2xl font-bold">×</span>
            </button>

            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-10 w-10 items-center justify-center bg-ink text-paper">
                  <span className="text-lg font-bold">BM</span>
                </div>
                <span className="text-xl font-bold tracking-tight uppercase">
                  BackendMonitor
                </span>
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tight">
                {isLogin ? 'Welcome Back' : 'Get Started'}
              </h2>
              <p className="text-sm text-ink/60 mt-2">
                {isLogin 
                  ? 'Log in to access your monitoring dashboard' 
                  : 'Create an account to start monitoring'}
              </p>
            </div>

            {/* Google Sign In Button */}
            <button 
              onClick={() => {
                setError('');
                startGoogleAuth(isLogin ? 'signin' : 'signup');
              }}
              className="w-full bg-ink text-white px-6 py-4 text-sm font-bold uppercase tracking-wide shadow-hard hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all mb-6 flex items-center justify-center gap-3"
            >
              <span className="text-xl">G</span>
              {isLogin ? 'Sign in with Google' : 'Sign up with Google'}
            </button>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-ink/10"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-4 text-ink/60 font-bold tracking-wider">
                  Or continue with email
                </span>
              </div>
            </div>

            {/* Form */}
            <form 
              className="space-y-4"
              onSubmit={isLogin ? handleLogin : handleSignup}
            >
              {error && (
                <div className="bg-red-50 border-2 border-red-500 p-3">
                  <p className="text-xs text-red-700 font-semibold">{error}</p>
                </div>
              )}

              {!isLogin && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-ink/80">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-ink text-ink text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-ink/80">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border-2 border-ink text-ink text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-ink/80">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border-2 border-ink text-ink text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              {isLogin && (
                <div className="flex justify-end">
                  <a href="#" className="text-xs font-semibold underline text-ink/60 hover:text-primary transition-colors">
                    Forgot password?
                  </a>
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white px-6 py-4 text-sm font-bold uppercase tracking-wide shadow-hard border-2 border-ink hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'PROCESSING...' : (isLogin ? 'Log In' : 'Create Account')}
              </button>
            </form>

            {/* Toggle */}
            <div className="mt-6 text-center text-sm">
              <span className="text-ink/60">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
              </span>
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="font-bold underline text-primary hover:text-primary/80 transition-colors"
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;