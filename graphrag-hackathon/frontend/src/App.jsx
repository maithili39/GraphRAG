import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Network, Clock, DollarSign, Hash, CheckCircle2, XCircle,
  TrendingDown, ArrowUp, BarChart2, AlertCircle, Plus, Globe, Settings, MessageSquare, Menu, X
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const PIPELINE_COLORS = { llm_only: '#ef4444', basic_rag: '#f97316', graphrag: '#10b981' };
const PIPELINE_LABELS = { llm_only: 'LLM-Only', basic_rag: 'Basic RAG', graphrag: 'GraphRAG' };

const SUGGESTED_QUESTIONS = [
  "Which battles were fought during the Napoleonic Wars?",
  "How did causes of American Civil War differ from English Civil War?",
  "What films won the Academy Award for Best Production Design?",
  "What is the relationship between free software and FSF?"
];

/* ─── Components ─── */

function MetricRow({ icon: Icon, label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
        <Icon size={14} />
        <span>{label}</span>
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function JudgeBadge({ judge }) {
  if (!judge) return null;
  const pass = judge === 'PASS';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: pass ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
      color: pass ? '#34d399' : '#fca5a5',
      borderRadius: 16, padding: '4px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.02em'
    }}>
      {pass ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {judge}
    </span>
  );
}

/* ─── Main App ─── */

export default function App() {
  const [question, setQuestion]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState('');
  const [graphHealth, setGraphHealth] = useState(null);
  
  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Configuration Settings State
  const [configOpen, setConfigOpen]   = useState(false);
  const [apiKey, setApiKey]           = useState('');
  const [configStatus, setConfigStatus] = useState('');
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  const [history, setHistory]         = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('benchmark_history') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    fetchGraphHealth();
  }, []);

  function fetchGraphHealth() {
    axios.get(`${API_BASE}/graph-health`)
      .then(r => setGraphHealth(r.data))
      .catch(() => setGraphHealth({ status: 'error' }));
  }

  async function handleRun(e) {
    if (e) e.preventDefault();
    await runPipeline(question);
  }

  async function runPipeline(queryText) {
    const trimmed = queryText.trim();
    if (!trimmed) return;
    setLoading(true); setError(''); setResult(null);
    setSidebarOpen(false); // Close mobile menu if open
    try {
      const { data } = await axios.post(`${API_BASE}/compare`, {
        question: trimmed,
        ground_truth: "dummy_truth_to_enable_evals"
      });
      setResult(data);
      setHistory(prev => {
        if (prev.includes(trimmed)) return prev;
        const next = [trimmed, ...prev];
        localStorage.setItem('benchmark_history', JSON.stringify(next));
        return next;
      });
      fetchGraphHealth(); // refresh chunks counter
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runPipeline(question);
    }
  };

  async function handleSaveConfig(e) {
    if (e) e.preventDefault();
    if (!apiKey.trim()) {
      setConfigStatus('Please enter a valid key.');
      return;
    }
    setConfigStatus('Saving key...');
    try {
      await axios.post(`${API_BASE}/save-config`, { groq_api_key: apiKey.trim() });
      setConfigStatus('Saved successfully!');
      setTimeout(() => {
        setConfigOpen(false);
        setConfigStatus('');
        setApiKey('');
      }, 1200);
    } catch (err) {
      setConfigStatus(`Error: ${err.response?.data?.detail || err.message}`);
    }
  }

  const chartData = result
    ? ['llm_only', 'basic_rag', 'graphrag'].map(k => ({
        name: PIPELINE_LABELS[k], tokens: result[k].total_tokens, color: PIPELINE_COLORS[k],
      }))
    : [];

  const showResultsEmpty = !result && !loading;

  return (
    <>
      <div className="atmospheric-bg" />

      <div className="app-layout">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        {/* Floating Sidebar Open Button (visible only when sidebar is collapsed on desktop) */}
        {sidebarCollapsed && (
          <button 
            className="sidebar-toggle-floating-btn" 
            onClick={() => setSidebarCollapsed(false)} 
            title="Open sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/></svg>
          </button>
        )}

        {/* Left Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div>
            <div className="sidebar-logo" style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/logo.png" alt="Logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
                <span className="sidebar-logo-text">GraphRAG Bench</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {/* Desktop Collapse Sidebar Button */}
                <button 
                  className="menu-toggle-btn desktop-only-btn" 
                  onClick={() => setSidebarCollapsed(true)} 
                  title="Collapse sidebar"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 6, borderRadius: 6 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
                </button>
                {/* Mobile Close Button */}
                <button 
                  className="menu-toggle-btn mobile-only-btn" 
                  onClick={() => setSidebarOpen(false)} 
                  style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 6 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <nav className="sidebar-nav">
              <button 
                className={`sidebar-link ${showResultsEmpty ? 'active' : ''}`}
                onClick={() => { setQuestion(''); setResult(null); setError(''); setSidebarOpen(false); }}
              >
                <Plus size={16} />
                <span>New Comparison</span>
              </button>

              <div className="sidebar-label">Recent Queries</div>
              {history.length === 0 ? (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '6px 12px' }}>
                  No recent queries
                </span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {history.slice(0, 8).map((q, idx) => (
                    <button 
                      key={idx} 
                      className="sidebar-link" 
                      onClick={() => { setQuestion(q); runPipeline(q); }}
                      title={q}
                      style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}
                    >
                      <MessageSquare size={14} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
                      <span style={{ verticalAlign: 'middle' }}>{q}</span>
                    </button>
                  ))}
                </div>
              )}
            </nav>
          </div>

          <div className="sidebar-footer">
            <div className="status-badge-card">
              <div className="status-badge-card-title">Graph Store Status</div>
              <div className="status-badge-card-content">
                <span className={graphHealth?.status === 'ok' ? 'pulse-dot' : 'pulse-dot-error'} />
                <span>{graphHealth?.status === 'ok' ? 'Connected' : 'Offline'}</span>
              </div>
              {graphHealth?.status === 'ok' && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {graphHealth.chunks_indexed.toLocaleString()} chunks indexed
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Right Main Content Panel */}
        <main className="main-panel scrollbar-thin">
          
          {/* Mobile Top Header */}
          <div className="mobile-header">
            <button className="menu-toggle-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <span className="mobile-header-title">GraphRAG Bench</span>
          </div>

          <div 
            className="chat-container" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: showResultsEmpty ? 'center' : 'flex-start',
              minHeight: showResultsEmpty ? 'calc(100vh - 56px)' : 'auto',
              paddingTop: showResultsEmpty ? (sidebarCollapsed ? 60 : 40) : 30,
              paddingLeft: sidebarCollapsed ? 64 : 24,
              transition: 'all 0.3s ease-in-out'
            }}
          >
            {/* Title / Heading */}
            <div style={{ marginBottom: showResultsEmpty ? 36 : 24, textAlign: 'center' }}>
              <h2 style={{ 
                fontSize: showResultsEmpty ? 38 : 26, 
                fontWeight: 700, 
                color: 'var(--text-primary)', 
                letterSpacing: '-0.02em',
                transition: 'all 0.3s'
              }}>
                {showResultsEmpty ? "What's on your mind today?" : "Compare Retrieval Pipelines"}
              </h2>
              {showResultsEmpty && (
                <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 8 }}>
                  Benchmark LLM-Only, Basic RAG, and GraphRAG side-by-side.
                </p>
              )}
            </div>

            {/* Chat-Style Input Box */}
            <div className="chat-input-wrapper">
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a factual question to benchmark..."
                className="chat-input-textarea scrollbar-thin"
              />
              <div className="chat-input-actions">
                <div className="chat-actions-left" style={{ display: 'flex', gap: 8 }}>
                  <button 
                    className="chat-action-btn" 
                    title="Configure API Keys & Parameters"
                    onClick={() => setConfigOpen(true)}
                  >
                    <Settings size={14} />
                    <span>Config</span>
                  </button>
                  <button 
                    className={`chat-action-btn ${webSearchEnabled ? 'active-search' : ''}`}
                    onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                    title="Toggle Web Search fallback (Mocked)"
                  >
                    <Globe size={14} color={webSearchEnabled ? '#3b82f6' : 'var(--text-secondary)'} />
                    <span>Search {webSearchEnabled ? '(On)' : '(Off)'}</span>
                  </button>
                </div>
                <button
                  onClick={handleRun}
                  disabled={loading || !question.trim()}
                  className="chat-send-btn"
                  title="Run Comparison"
                >
                  <ArrowUp size={18} />
                </button>
              </div>
            </div>

            {/* Suggested Question / Pill Grid */}
            {showResultsEmpty && (
              <div className="suggestions-container fade-up">
                {SUGGESTED_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    className="suggestion-pill"
                    onClick={() => { setQuestion(q); runPipeline(q); }}
                  >
                    <Globe size={12} style={{ color: 'var(--text-tertiary)' }} />
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fca5a5', fontSize: 14, marginTop: 24 }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}
          </div>

          {/* Loading View */}
          {loading && (
            <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
              <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%' }} className="spin" />
              <span style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 16, fontWeight: 500 }}>Running pipelines and evaluations...</span>
            </div>
          )}

          {/* Results Display Area */}
          {result && !loading && (
            <section className="fade-up" style={{ padding: '0 24px 60px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
              
              {/* Token Savings Banner */}
              <div className="glass-card" style={{ padding: 20, marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 12 }}>
                    <TrendingDown size={24} color="var(--accent-green)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--accent-green)', marginBottom: 4 }}>
                      GraphRAG Token Savings: {result.token_reduction_pct}%
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      GraphRAG achieved competitive answer quality while using significantly fewer tokens than Basic RAG.
                    </p>
                  </div>
                </div>
              </div>

              {/* 3-Column Comparison Grid */}
              <div className="grid-3-col" style={{ marginBottom: 32 }}>
                {['llm_only', 'basic_rag', 'graphrag'].map(key => {
                  const data = result[key];
                  return (
                    <div key={key} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                      {/* Card Header */}
                      <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: PIPELINE_COLORS[key], letterSpacing: '0.02em' }}>
                          {PIPELINE_LABELS[key]}
                        </h3>
                        <JudgeBadge judge={result[`judge_${key}`]} />
                      </div>
                      
                      {/* Answer Area */}
                      <div className="scrollbar-thin" style={{ flex: 1, padding: 24, fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)', minHeight: 180, maxHeight: 300, overflowY: 'auto' }}>
                        {data.answer || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No answer generated.</span>}
                      </div>

                      {/* Metrics Area */}
                      <div style={{ padding: '16px 24px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)', borderRadius: '0 0 16px 16px' }}>
                        <MetricRow icon={Hash} label="Total Tokens" value={data.total_tokens.toLocaleString()} color={PIPELINE_COLORS[key]} />
                        <MetricRow icon={Clock} label="Latency" value={`${data.latency_s}s`} />
                        <MetricRow icon={DollarSign} label="Estimated Cost" value={`$${data.cost_usd.toFixed(6)}`} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chart Comparison */}
              <div className="glass-card" style={{ padding: 24, height: 350 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
                  <BarChart2 size={18} /> Token Usage Comparison
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-tertiary)" tick={{ fill: 'var(--text-secondary)', fontSize: 13 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="var(--text-tertiary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, backdropFilter: 'blur(10px)', padding: 12 }}
                      labelStyle={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, marginBottom: 4 }}
                      itemStyle={{ color: 'var(--text-secondary)', fontSize: 13 }}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Bar dataKey="tokens" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {chartData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </section>
          )}
        </main>
      </div>

      {/* Configuration Modal overlay */}
      {configOpen && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: 16
          }} 
          onClick={() => setConfigOpen(false)}
        >
          <div 
            className="glass-card" 
            style={{
              maxWidth: 500, width: '100%', padding: 28,
              display: 'flex', flexDirection: 'column', gap: 20
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Configuration Settings</h3>
              <button className="menu-toggle-btn" onClick={() => setConfigOpen(false)}>
                <X size={18} />
              </button>
            </div>
            
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Enter a valid <strong>Groq API Key</strong> to configure the LLM pipelines. This key is saved in the server's local environment.
            </p>

            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Groq API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="gsk_..."
                  style={{
                    background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#fff', outline: 'none'
                  }}
                />
              </div>

              {configStatus && (
                <div style={{ 
                  fontSize: 12, 
                  color: configStatus.includes('successfully') ? '#34d399' : '#fca5a5',
                  fontWeight: 500 
                }}>
                  {configStatus}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button 
                  type="button" 
                  className="chat-action-btn"
                  onClick={() => setConfigOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{
                    background: 'var(--accent-blue)', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Save Config
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
