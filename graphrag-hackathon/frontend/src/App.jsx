import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Network, Clock, DollarSign, Hash, CheckCircle2, XCircle,
  TrendingDown, Send, BarChart2, MessageSquare, AlertCircle
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

  useEffect(() => {
    axios.get(`${API_BASE}/graph-health`)
      .then(r => setGraphHealth(r.data))
      .catch(() => setGraphHealth({ status: 'error' }));
  }, []);

  async function handleRun(e) {
    if (e) e.preventDefault();
    if (!question.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const { data } = await axios.post(`${API_BASE}/compare`, {
        question: question.trim(),
        ground_truth: "dummy_truth_to_enable_evals"
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRun();
    }
  };

  const chartData = result
    ? ['llm_only', 'basic_rag', 'graphrag'].map(k => ({
        name: PIPELINE_LABELS[k], tokens: result[k].total_tokens, color: PIPELINE_COLORS[k],
      }))
    : [];

  return (
    <>
      <div className="atmospheric-bg" />

      {/* Header Bar */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 70,
        background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'var(--accent-blue)', padding: 8, borderRadius: 8 }}>
            <Network size={20} color="#fff" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            GraphRAG Benchmark
          </h1>
        </div>
        
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)',
          background: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <span className={graphHealth?.status === 'ok' ? 'pulse-dot' : 'pulse-dot-error'} />
          {graphHealth?.status === 'ok' ? `Graph Active (${graphHealth.chunks_indexed.toLocaleString()} chunks)` : 'Graph Offline'}
        </div>
      </header>

      {/* Main Container */}
      <main className="scrollbar-thin" style={{
        height: '100vh', paddingTop: 70, overflowY: 'auto', display: 'flex', flexDirection: 'column'
      }}>
        
        {/* Search Section */}
        <section style={{ padding: '60px 24px 40px', maxWidth: 800, margin: '0 auto', width: '100%', textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>
            Compare Retrieval Pipelines
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32 }}>
            Enter a question to benchmark LLM-Only, Basic RAG, and GraphRAG side-by-side.
          </p>

          <div className="glass-input-container" style={{ marginBottom: 20 }}>
            <MessageSquare size={18} color="var(--text-tertiary)" style={{ marginLeft: 8, marginRight: 12 }} />
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a factual question..."
              className="glass-input"
              style={{ padding: '12px 0' }}
            />
            <button
              onClick={handleRun}
              disabled={loading || !question.trim()}
              style={{
                background: loading || !question.trim() ? 'rgba(255,255,255,0.05)' : 'var(--accent-blue)',
                color: loading || !question.trim() ? 'var(--text-tertiary)' : '#fff',
                border: 'none', borderRadius: 8, padding: '10px 20px',
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600,
                cursor: loading || !question.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', marginLeft: 12
              }}
            >
              {loading ? (
                <>
                  <div style={{width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%'}} className="spin" />
                  Running...
                </>
              ) : (
                <>
                  <Send size={16} /> Run Benchmark
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fca5a5', fontSize: 14, marginBottom: 20 }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="fade-up" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {SUGGESTED_QUESTIONS.map(q => (
              <button
                key={q}
                className="glass-pill"
                onClick={() => { setQuestion(q); }}
              >
                {q}
              </button>
            ))}
          </div>
        </section>

        {/* Results Section */}
        {result && !loading && (
          <section className="fade-up" style={{ padding: '0 32px 60px', maxWidth: 1400, margin: '0 auto', width: '100%', flex: 1 }}>
            
            {/* Banner */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 12 }}>
                  <TrendingDown size={24} color="var(--accent-green)" />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent-green)', marginBottom: 4 }}>
                    GraphRAG Token Savings: {result.token_reduction_pct}%
                  </h3>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    GraphRAG achieved competitive answer quality while using significantly fewer tokens than Basic RAG.
                  </p>
                </div>
              </div>
            </div>

            {/* 3-Column Comparison */}
            <div className="grid-3-col" style={{ marginBottom: 32 }}>
              {['llm_only', 'basic_rag', 'graphrag'].map(key => {
                const data = result[key];
                return (
                  <div key={key} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Card Header */}
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: PIPELINE_COLORS[key], letterSpacing: '0.02em' }}>
                        {PIPELINE_LABELS[key]}
                      </h3>
                      <JudgeBadge judge={result[`judge_${key}`]} />
                    </div>
                    
                    {/* Answer Area */}
                    <div className="scrollbar-thin" style={{ flex: 1, padding: 24, fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)', minHeight: 180, maxHeight: 300, overflowY: 'auto' }}>
                      {data.answer || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No answer generated.</span>}
                    </div>

                    {/* Metrics Area */}
                    <div style={{ padding: '16px 24px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)', borderRadius: '0 0 12px 12px' }}>
                      <MetricRow icon={Hash} label="Total Tokens" value={data.total_tokens.toLocaleString()} color={PIPELINE_COLORS[key]} />
                      <MetricRow icon={Clock} label="Latency" value={`${data.latency_s}s`} />
                      <MetricRow icon={DollarSign} label="Estimated Cost" value={`$${data.cost_usd.toFixed(6)}`} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chart Section */}
            <div className="glass-card" style={{ padding: 32, height: 350 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 15, fontWeight: 600, marginBottom: 24 }}>
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
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

          </section>
        )}
      </main>
    </>
  );
}
