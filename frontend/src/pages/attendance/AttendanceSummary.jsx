import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import AppShell from '../../components/layout/AppShell';
import { Calendar, ChevronLeft, ChevronRight, Clock, AlertCircle, Loader2, X, Send, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const STATUS_LABELS = {
  P: 'Present', A: 'Absent', WO: 'Week Off', L: 'Leave', Coff: 'Comp Off', AUTO: 'Partial', H: 'Holiday',
};

const StatusBadge = ({ status }) => {
  if (!status) return null;
  return (
    <span className={`badge status-${status}`}>{STATUS_LABELS[status] || status}</span>
  );
};

const AttendanceSummary = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ present: 0, absent: 0, weekOff: 0, late: 0, totalHours: 0 });
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  // Correction Modal States
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [correctionForm, setCorrectionForm] = useState({
    requestedInTime: '',
    requestedOutTime: '',
    reason: '',
    proofUrl: ''
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      const from = start.toISOString().split('T')[0];
      const to = end.toISOString().split('T')[0];
      const { data } = await api.get('/attendance/my-summary', { params: { from, to } });
      setRecords(data.data.records);
      setSummary(data.data.summary);
    } catch (_) {}
    setLoading(false);
  }, [month, year]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const monthName = new Date(year, month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const formatTime = (dateStr) =>
    dateStr ? new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';

  const handleOpenCorrection = (record) => {
    setSelectedRecord(record);
    const dateStr = new Date(record.date).toISOString().split('T')[0];
    setCorrectionForm({
      requestedInTime: record.inTime ? new Date(record.inTime).toTimeString().slice(0, 5) : '09:30',
      requestedOutTime: record.outTime ? new Date(record.outTime).toTimeString().slice(0, 5) : '18:00',
      reason: '',
      proofUrl: ''
    });
    setShowCorrectionModal(true);
  };

  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const date = new Date(selectedRecord.date).toISOString().split('T')[0];
      const payload = {
        reason: correctionForm.reason,
        requestedInTime: `${date}T${correctionForm.requestedInTime}:00`,
        requestedOutTime: `${date}T${correctionForm.requestedOutTime}:00`,
        proofUrl: correctionForm.proofUrl
      };
      await api.post(`/attendance/correction/${selectedRecord._id}`, payload);
      toast.success('Correction request submitted!');
      setShowCorrectionModal(false);
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit request');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="page-wrapper fade-in" style={{ padding: '28px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>My Attendance</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>{user?.name} · {user?.employeeCode}</p>

        {/* Month Navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <button onClick={prevMonth} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex' }}>
            <ChevronLeft size={18} color="var(--color-text-secondary)" />
          </button>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', minWidth: '180px', textAlign: 'center' }}>{monthName}</div>
          <button onClick={nextMonth} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex' }}>
            <ChevronRight size={18} color="var(--color-text-secondary)" />
          </button>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Present', value: summary.present, color: '#10B981' },
            { label: 'Absent', value: summary.absent, color: '#EF4444' },
            { label: 'Late', value: summary.late, color: '#F59E0B' },
            { label: 'Week Off', value: summary.weekOff, color: '#3B82F6' },
            { label: 'Avg Hours', value: summary.present ? (summary.totalHours / summary.present).toFixed(1) + 'h' : '--', color: '#8B5CF6' },
          ].map((s) => (
            <div key={s.label} className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600, marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Records Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px' }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: '48px', marginBottom: '8px' }} />
              ))}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Hours</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-tertiary)' }}>No records found</td></tr>
                ) : records.map((r, i) => {
                  const date = new Date(r.date);
                  const isWeekend = date.getDay() === 0;
                  const canCorrect = r.status && !['A', 'H', 'WO'].includes(r.status);
                  
                  return (
                    <tr key={i} style={{ background: isWeekend ? 'rgba(59,130,246,0.03)' : 'transparent' }}>
                      <td style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                        {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                        {date.toLocaleDateString('en-IN', { weekday: 'short' })}
                      </td>
                      <td style={{ fontWeight: r.inTime ? 600 : 400, color: r.inTime ? '#059669' : 'var(--color-text-tertiary)', fontSize: '0.88rem' }}>
                        {r.isWeekOff || r.isAbsent ? '—' : formatTime(r.inTime)}
                      </td>
                      <td style={{ fontWeight: r.outTime ? 600 : 400, color: r.outTime ? '#2076C7' : 'var(--color-text-tertiary)', fontSize: '0.88rem' }}>
                        {r.isWeekOff || r.isAbsent ? '—' : formatTime(r.outTime)}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        {r.totalHours ? `${r.totalHours.toFixed(1)}h` : '—'}
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                        {r.isLate && !r.isWeekOff && (
                          <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: '#D97706', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '99px', fontWeight: 600 }}>
                            Late {r.lateMinutes}m
                          </span>
                        )}
                        {r.correctionRequested && (
                          <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: '#2076C7', background: 'rgba(32,118,199,0.1)', padding: '2px 6px', borderRadius: '99px', fontWeight: 600 }}>
                            Correction {r.correctionStatus.split('_')[1] || 'Pending'}
                          </span>
                        )}
                      </td>
                      <td>
                        {canCorrect && !r.correctionRequested && (
                          <button 
                            onClick={() => handleOpenCorrection(r)}
                            className="btn-text" 
                            style={{ color: 'var(--color-accent)', fontSize: '0.8rem', fontWeight: 700 }}
                          >
                            Correct
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Correction Modal */}
        <AnimatePresence>
          {showCorrectionModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCorrectionModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)' }} />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} style={{ position: 'relative', background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '450px', padding: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Request Correction</h2>
                  <button onClick={() => setShowCorrectionModal(false)} className="btn-icon"><X size={20} /></button>
                </div>
                <form onSubmit={handleCorrectionSubmit} style={{ display: 'grid', gap: '20px' }}>
                  <div style={{ background: 'var(--color-surface-alt)', padding: '12px 16px', borderRadius: '16px', fontSize: '0.9rem' }}>
                    <div style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Date</div>
                    <div style={{ fontWeight: 800 }}>{new Date(selectedRecord.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label className="form-label">Correct In-Time</label>
                      <input type="time" className="input-field" value={correctionForm.requestedInTime} onChange={e => setCorrectionForm({...correctionForm, requestedInTime: e.target.value})} required />
                    </div>
                    <div>
                      <label className="form-label">Correct Out-Time</label>
                      <input type="time" className="input-field" value={correctionForm.requestedOutTime} onChange={e => setCorrectionForm({...correctionForm, requestedOutTime: e.target.value})} required />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Reason for Correction</label>
                    <textarea className="input-field" rows={3} placeholder="Describe why you need this correction..." required value={correctionForm.reason} onChange={e => setCorrectionForm({...correctionForm, reason: e.target.value})} />
                  </div>
                  <div>
                    <label className="form-label">Upload Proof (PDF/Image)</label>
                    <div style={{ position: 'relative' }}>
                      <input type="text" className="input-field" placeholder="Proof URL (or select file)" value={correctionForm.proofUrl} onChange={e => setCorrectionForm({...correctionForm, proofUrl: e.target.value})} />
                      <Camera size={18} style={{ position: 'absolute', right: '12px', top: '14px', opacity: 0.3 }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowCorrectionModal(false)}>Cancel</button>
                    <button type="submit" className="btn-primary" style={{ flex: 2, gap: '8px' }} disabled={actionLoading}>
                      {actionLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={18} />}
                      Submit Request
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
};

export default AttendanceSummary;
