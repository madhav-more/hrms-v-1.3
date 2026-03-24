import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { 
  CheckCircle, Clock, MapPin, 
  Search, Eye, User, FileText, 
  ChevronDown, AlertTriangle, CheckCheck, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';

const StatusBadge = ({ status }) => {
  const labels = { P: 'Present', A: 'Absent', WO: 'Week Off', L: 'Leave' };
  return <span className={`badge status-${status}`}>{labels[status] || status}</span>;
};

const AdminAttendance = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [filter, setFilter] = useState('SharedWithMe'); // 'All' or 'SharedWithMe'

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/attendance/admin', { params: { limit: 100 } });
      setRecords(data.data.records);
    } catch (err) {
      toast.error('Failed to fetch attendance records');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleMarkAsRead = async (id) => {
    try {
      await api.patch(`/attendance/mark-read/${id}`);
      toast.success('Report marked as read');
      fetchRecords(); // Refresh
      if (selectedReport?._id === id) {
        setSelectedReport(prev => ({ ...prev, reportReadBy: [...prev.reportReadBy, user._id] }));
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  // Filter records: records where I am a participant OR show all if filter is 'All'
  const filteredRecords = records.filter(r => {
    if (filter === 'SharedWithMe') {
      return r.reportParticipants?.includes(user._id);
    }
    return true;
  });

  const formatTime = (dateStr) =>
    dateStr ? new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';

  return (
    <AppShell>
      <div className="page-wrapper fade-in" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--color-text)' }}>Team Attendance</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Review team reports and acknowledge updates</p>
        </header>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <button 
            onClick={() => setFilter('SharedWithMe')}
            style={{ 
              padding: '10px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              background: filter === 'SharedWithMe' ? 'var(--color-text)' : 'var(--color-surface)',
              color: filter === 'SharedWithMe' ? '#fff' : 'var(--color-text-secondary)',
              fontWeight: 600, boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s'
            }}
          >
            Shared with me
          </button>
          <button 
            onClick={() => setFilter('All')}
            style={{ 
              padding: '10px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              background: filter === 'All' ? 'var(--color-text)' : 'var(--color-surface)',
              color: filter === 'All' ? '#fff' : 'var(--color-text-secondary)',
              fontWeight: 600, boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s'
            }}
          >
            All Records
          </button>
        </div>

        <div className="card" style={{ overflow: 'hidden', borderRadius: '24px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>In / Out</th>
                <th>Report</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" /></td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-tertiary)' }}>No reports found</td></tr>
              ) : filteredRecords.map((r) => (
                <tr key={r._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                        {r.employeeName?.[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.employeeName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{r.employeeCode}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: 700 }}>{formatTime(r.inTime)}</span>
                      <span style={{ fontSize: '0.8rem', color: '#3B82F6', fontWeight: 700 }}>{formatTime(r.outTime)}</span>
                    </div>
                  </td>
                  <td>
                    {r.todayWork ? (
                      <button 
                        onClick={() => setSelectedReport(r)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-accent)11', color: 'var(--color-accent)', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        <FileText size={14} /> View Report
                      </button>
                    ) : <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8rem' }}>No Report</span>}
                  </td>
                  <td>
                    {r.reportReadBy?.includes(user._id) ? (
                      <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                        <CheckCheck size={14} /> Read
                      </span>
                    ) : r.todayWork ? (
                      <span style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                        <Clock size={14} /> Unread
                      </span>
                    ) : <StatusBadge status={r.status} />}
                  </td>
                  <td>
                    {r.todayWork && !r.reportReadBy?.includes(user._id) && (
                      <button 
                        onClick={() => handleMarkAsRead(r._id)}
                        style={{ background: 'var(--color-text)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                      >
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Report Detail Modal */}
        <AnimatePresence>
          {selectedReport && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedReport(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ position: 'relative', background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '500px', padding: '32px', boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Daily Work Report</h2>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>By {selectedReport.employeeName} on {new Date(selectedReport.date).toLocaleDateString()}</p>
                </div>

                <div style={{ display: 'grid', gap: '20px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '8px', letterSpacing: '0.1em' }}>Today's Work</h4>
                    <p style={{ fontSize: '0.95rem', color: 'var(--color-text)', background: 'var(--color-surface-alt)', padding: '12px', borderRadius: '12px' }}>{selectedReport.todayWork}</p>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '8px', letterSpacing: '0.1em' }}>Pending Work</h4>
                    <p style={{ fontSize: '0.95rem', color: 'var(--color-text)', background: 'var(--color-surface-alt)', padding: '12px', borderRadius: '12px' }}>{selectedReport.pendingWork || 'None'}</p>
                  </div>
                  {selectedReport.issuesFaced && (
                    <div>
                      <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '8px', letterSpacing: '0.1em' }}>Issues Faced</h4>
                      <p style={{ fontSize: '0.95rem', color: '#EF4444', background: 'rgba(239,68,68,0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.1)' }}>{selectedReport.issuesFaced}</p>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
                  <button className="btn-secondary" style={{ flex: 1, borderRadius: '14px' }} onClick={() => setSelectedReport(null)}>Close</button>
                  {selectedReport.todayWork && !selectedReport.reportReadBy?.includes(user._id) && (
                    <button className="btn-primary" style={{ flex: 1, borderRadius: '14px' }} onClick={() => handleMarkAsRead(selectedReport._id)}>Mark as Read</button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <style>{`
          .animate-spin { animation: spin 1s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </AppShell>
  );
};

export default AdminAttendance;
