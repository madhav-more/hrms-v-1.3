import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/axios';
import AppShell from '../../components/layout/AppShell';
import {
  Calendar, ChevronLeft, ChevronRight, Clock, Loader2,
  X, Send, Camera, CheckCircle, TrendingUp,
  AlertCircle, BarChart2, Filter,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const STATUS_LABELS = {
  P: 'Present', A: 'Absent', WO: 'Week Off', L: 'Leave',
  Coff: 'Comp Off', AUTO: 'Partial', H: 'Holiday',
};

const StatusBadge = ({ status }) =>
  status ? <span className={`badge status-${status}`}>{STATUS_LABELS[status] || status}</span> : null;

/* ── Summary mini-stat ───────────────────────────────────────── */
const MiniStat = ({ label, value, color, icon: Icon }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xl)', padding: '18px 12px',
    position: 'relative', overflow: 'hidden', gap: '6px',
  }}>
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: color }} />
    <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={16} style={{ color: color.match(/#[A-Fa-f0-9]{6}/)?.[0] || color }} />
    </div>
    <p style={{ fontSize: '1.7rem', fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.04em', lineHeight: 1 }}>{value ?? '—'}</p>
    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
  </div>
);

/* ── Row in mobile card view ─────────────────────────────────── */
const MobileRow = ({ date, day, inT, outT, hours, status, isLate, lateMin, corrReq, corrStatus, canCorrect, onCorrect }) => (
  <div className="card" style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center' }}>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <p style={{ fontWeight: 800, fontSize: '0.95rem' }}>{date}</p>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{day}</span>
        <StatusBadge status={status} />
        {isLate && (
          <span style={{ fontSize: '0.72rem', color: 'var(--color-warning)', background: 'var(--color-warning-light)', padding: '2px 7px', borderRadius: 'var(--radius-full)', fontWeight: 700, border: '1px solid #FDE68A' }}>
            Late {lateMin}m
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {[{ l: 'In', v: inT, c: 'var(--color-success)' }, { l: 'Out', v: outT, c: 'var(--color-primary)' }, ...(hours ? [{ l: 'Hours', v: hours, c: 'var(--color-accent)' }] : [])].map(m => (
          <div key={m.l}>
            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', marginBottom: '2px' }}>{m.l}</p>
            <p style={{ fontWeight: 700, fontSize: '0.9rem', color: m.c }}>{m.v}</p>
          </div>
        ))}
      </div>
      {corrReq && (
        <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.72rem', color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
          Correction {corrStatus?.split('_')[1] || 'Pending'}
        </span>
      )}
    </div>
    {canCorrect && !corrReq && (
      <button onClick={onCorrect} className="btn-text" style={{ fontSize: '0.78rem', flexShrink: 0 }}>Correct</button>
    )}
  </div>
);

const AttendanceSummary = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ present: 0, absent: 0, weekOff: 0, late: 0, totalHours: 0 });
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [showMobile, setShowMobile] = useState(window.innerWidth < 768);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [correctionForm, setCorrectionForm] = useState({ requestedInTime: '', requestedOutTime: '', reason: '', proofUrl: '' });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const onResize = () => setShowMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(year, month, 1), end = new Date(year, month + 1, 0);
      const { data } = await api.get('/attendance/my-summary', {
        params: { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] },
      });
      setRecords(data.data.records);
      setSummary(data.data.summary);
    } catch (_) {}
    setLoading(false);
  }, [month, year]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const fmtT = (s) => s ? new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
  const monthName = new Date(year, month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const handleOpenCorrection = (record) => {
    setSelectedRecord(record);
    setCorrectionForm({
      requestedInTime: record.inTime ? new Date(record.inTime).toTimeString().slice(0, 5) : '09:30',
      requestedOutTime: record.outTime ? new Date(record.outTime).toTimeString().slice(0, 5) : '18:00',
      reason: '', proofUrl: '',
    });
    setShowCorrectionModal(true);
  };

  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const date = new Date(selectedRecord.date).toISOString().split('T')[0];
      await api.post(`/attendance/correction/${selectedRecord._id}`, {
        reason: correctionForm.reason,
        requestedInTime: `${date}T${correctionForm.requestedInTime}:00`,
        requestedOutTime: `${date}T${correctionForm.requestedOutTime}:00`,
        proofUrl: correctionForm.proofUrl,
      });
      toast.success('Correction request submitted!');
      setShowCorrectionModal(false);
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally { setActionLoading(false); }
  };

  const avgHours = summary.present > 0 ? (summary.totalHours / summary.present).toFixed(1) : '—';

  return (
    <AppShell>
      <div className="page-wrapper">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--color-text)', marginBottom: '4px' }}>
            My Attendance
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
            {user?.name} &middot; {user?.employeeCode}
          </p>
        </div>

        {/* ── Month Navigator ──────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <button className="btn-icon" onClick={prevMonth}><ChevronLeft size={16} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={18} color="var(--color-primary)" />
            <span style={{ fontWeight: 800, fontSize: '1.05rem', minWidth: '170px' }}>{monthName}</span>
          </div>
          <button className="btn-icon" onClick={nextMonth}><ChevronRight size={16} /></button>
        </div>

        {/* ── Summary Stats ────────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}>
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: '110px', borderRadius: 'var(--radius-xl)' }} />)}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}
            className="stat-grid-5"
          >
            <MiniStat icon={CheckCircle} label="Present" value={summary.present} color="linear-gradient(135deg,#10B981,#059669)" />
            <MiniStat icon={AlertCircle} label="Absent" value={summary.absent} color="linear-gradient(135deg,#EF4444,#DC2626)" />
            <MiniStat icon={Clock} label="Late Ins" value={summary.late} color="linear-gradient(135deg,#F59E0B,#D97706)" />
            <MiniStat icon={Calendar} label="Week Off" value={summary.weekOff} color="linear-gradient(135deg,#3B82F6,#2563EB)" />
            <MiniStat icon={TrendingUp} label="Avg Hours" value={avgHours !== '—' ? avgHours + 'h' : avgHours} color="linear-gradient(135deg,#8B5CF6,#7C3AED)" />
          </motion.div>
        )}

        {/* ── Records View ─────────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: '56px', borderRadius: 'var(--radius-lg)' }} />)}
          </div>
        ) : showMobile ? (
          /* Mobile Cards */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {records.length === 0
              ? <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-tertiary)' }}>No records found</div>
              : records.map((r, i) => {
                const date = new Date(r.date);
                const canCorrect = r.status && !['A', 'H', 'WO'].includes(r.status);
                return (
                  <MobileRow
                    key={i}
                    date={date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    day={date.toLocaleDateString('en-IN', { weekday: 'short' })}
                    inT={r.isWeekOff || r.isAbsent ? '—' : fmtT(r.inTime)}
                    outT={r.isWeekOff || r.isAbsent ? '—' : fmtT(r.outTime)}
                    hours={r.totalHours ? `${r.totalHours.toFixed(1)}h` : null}
                    status={r.status}
                    isLate={r.isLate && !r.isWeekOff}
                    lateMin={r.lateMinutes}
                    corrReq={r.correctionRequested}
                    corrStatus={r.correctionStatus}
                    canCorrect={canCorrect}
                    onCorrect={() => handleOpenCorrection(r)}
                  />
                );
              })}
          </div>
        ) : (
          /* Desktop Table */
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="card"
            style={{ overflow: 'hidden', borderRadius: 'var(--radius-xl)' }}
          >
            <table className="data-table">
              <thead>
                <tr>
                  {['Date', 'Day', 'In', 'Out', 'Hours', 'Status', 'Action'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-tertiary)' }}>No records found for this month</td></tr>
                ) : records.map((r, i) => {
                  const date = new Date(r.date);
                  const isWkend = date.getDay() === 0;
                  const canCorrect = r.status && !['A', 'H', 'WO'].includes(r.status);
                  return (
                    <tr key={i} style={{ background: isWkend ? 'rgba(59,130,246,0.02)' : 'transparent' }}>
                      <td style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                        {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                        {date.toLocaleDateString('en-IN', { weekday: 'short' })}
                      </td>
                      <td style={{ fontWeight: r.inTime ? 700 : 400, color: r.inTime ? 'var(--color-success)' : 'var(--color-text-tertiary)', fontSize: '0.88rem' }}>
                        {r.isWeekOff || r.isAbsent ? '—' : fmtT(r.inTime)}
                      </td>
                      <td style={{ fontWeight: r.outTime ? 700 : 400, color: r.outTime ? 'var(--color-primary)' : 'var(--color-text-tertiary)', fontSize: '0.88rem' }}>
                        {r.isWeekOff || r.isAbsent ? '—' : fmtT(r.outTime)}
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
                        {r.totalHours ? `${r.totalHours.toFixed(1)}h` : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <StatusBadge status={r.status} />
                          {r.isLate && !r.isWeekOff && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-warning)', background: 'var(--color-warning-light)', padding: '2px 7px', borderRadius: 'var(--radius-full)', fontWeight: 700, border: '1px solid #FDE68A' }}>
                              Late {r.lateMinutes}m
                            </span>
                          )}
                          {r.correctionRequested && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                              {r.correctionStatus?.split('_')[1] || 'Pending'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {canCorrect && !r.correctionRequested && (
                          <button onClick={() => handleOpenCorrection(r)} className="btn-text" style={{ fontSize: '0.8rem' }}>
                            Request Correction
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* ── Correction Modal Logic ── */}
        {createPortal(
          <AnimatePresence>
            {showCorrectionModal && (
              <div className="modal-backdrop" style={{ zIndex: 1000 }}>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setShowCorrectionModal(false)}
                  style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                />
                <motion.div
                  initial={{ scale: 0.92, opacity: 0, y: 24 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.92, opacity: 0 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                  style={{
                    position: 'relative',
                    background: 'var(--color-surface)',
                    borderRadius: 'var(--radius-2xl)',
                    width: 'calc(100% - 32px)',
                    maxWidth: '460px',
                    maxHeight: '90dvh',
                    overflow: 'auto',
                    boxShadow: 'var(--shadow-2xl)',
                    zIndex: 1001,
                  }}
                >
                  <div style={{ padding: '28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                      <div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '4px', color: 'var(--color-text)' }}>Request Correction</h2>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', fontWeight: 500 }}>
                          {selectedRecord && new Date(selectedRecord.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <button className="btn-icon" onClick={() => setShowCorrectionModal(false)}><X size={18} /></button>
                    </div>

                    <form onSubmit={handleCorrectionSubmit} style={{ display: 'grid', gap: '20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label className="form-label">Correct In-Time</label>
                          <input type="time" className="input-field" value={correctionForm.requestedInTime}
                            onChange={e => setCorrectionForm({ ...correctionForm, requestedInTime: e.target.value })} required />
                        </div>
                        <div>
                          <label className="form-label">Correct Out-Time</label>
                          <input type="time" className="input-field" value={correctionForm.requestedOutTime}
                            onChange={e => setCorrectionForm({ ...correctionForm, requestedOutTime: e.target.value })} required />
                        </div>
                      </div>

                      <div>
                        <label className="form-label">Reason for Correction *</label>
                        <textarea className="input-field" rows={3} placeholder="Please provide a valid reason..."
                          required value={correctionForm.reason}
                          onChange={e => setCorrectionForm({ ...correctionForm, reason: e.target.value })} />
                      </div>

                      <div>
                        <label className="form-label">Supporting Proof (URL)</label>
                        <div style={{ position: 'relative' }}>
                          <input type="text" className="input-field" style={{ paddingRight: '44px' }}
                            placeholder="Link to document or image"
                            value={correctionForm.proofUrl}
                            onChange={e => setCorrectionForm({ ...correctionForm, proofUrl: e.target.value })} />
                          <Camera size={18} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
                        <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowCorrectionModal(false)}>Cancel</button>
                        <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={actionLoading}>
                          {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                          Submit Request
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </div>

      <style>{`
        .stat-grid-5 { grid-template-columns: repeat(5, 1fr) !important; }
        @media (max-width: 900px) { .stat-grid-5 { grid-template-columns: repeat(3, 1fr) !important; } }
        @media (max-width: 640px) { .stat-grid-5 { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>
    </AppShell>
  );
};

export default AttendanceSummary;
