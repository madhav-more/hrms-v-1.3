import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import AppShell from '../../components/layout/AppShell';
import { 
  CheckCircle2, XCircle, Clock, Filter, Search, 
  ExternalLink, Loader2, AlertCircle, User, Calendar
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const CorrectionApproval = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [remarks, setRemarks] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRequests = requests.filter(req => 
    req.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    req.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/attendance/corrections/pending');
      setRequests(data.data);
    } catch (err) {
      toast.error('Failed to fetch pending corrections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleAction = async (id, action) => {
    setActionLoading(id);
    const remark = remarks[id] || '';
    try {
      if (action === 'approve') {
        await api.patch(`/attendance/correction-approve/${id}`, { remark });
        toast.success('Correction approved');
      } else {
        await api.patch(`/attendance/correction-reject/${id}`, { remark });
        toast.success('Correction rejected');
      }
      setRemarks(prev => ({ ...prev, [id]: '' }));
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const formatTime = (dateStr) =>
    dateStr ? new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';

  return (
    <AppShell>
      <div className="page-wrapper fade-in">
        <header style={{ marginBottom: '40px', display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--color-text)' }}>Attendance Corrections</h1>
            <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500, marginTop: '4px' }}>Review and approve employee-requested attendance adjustments</p>
          </div>
          <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
            <input 
              type="text" 
              placeholder="Search employee..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '44px' }}
            />
          </div>
        </header>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
            <Loader2 className="animate-spin" size={48} color="var(--color-primary)" />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '24px' }}>
            <AnimatePresence>
              {filteredRequests.length > 0 ? (
                filteredRequests.map((req) => (
                  <motion.div
                    key={req._id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                    className="card"
                    style={{ 
                      padding: '24px', 
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--color-primary)' }} />
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {/* Top Row: Employee & Stage */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={28} color="var(--color-primary)" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--color-text)' }}>{req.employeeName}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>{req.employeeCode} &middot; {req.department}</div>
                          </div>
                        </div>

                        <div style={{ 
                          padding: '6px 14px', 
                          borderRadius: 'var(--radius-full)', 
                          background: 'var(--color-info-light)', 
                          color: '#0284C7', 
                          fontSize: '0.75rem', 
                          fontWeight: 800,
                          border: '1px solid #BAE6FD',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Clock size={14} /> STAGE: {req.correctionStatus.replace('Pending_', '')}
                        </div>
                      </div>

                      <div className="divider" />

                      {/* Middle Row: Details Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
                        
                        {/* Time Comparison */}
                        <div>
                          <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} />
                            {new Date(req.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          
                          <div style={{ display: 'flex', gap: '24px' }}>
                            <div>
                               <p style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>CURRENT</p>
                               <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-secondary)', textDecoration: 'line-through' }}>
                                 {formatTime(req.inTime)} – {formatTime(req.outTime)}
                               </p>
                            </div>
                            <div>
                               <p style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: '4px' }}>REQUESTED</p>
                               <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                                 {formatTime(req.requestedInTime)} – {formatTime(req.requestedOutTime)}
                               </p>
                            </div>
                          </div>
                        </div>

                        {/* Reason & Proof */}
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Reason</div>
                          <p style={{ fontSize: '0.9rem', color: 'var(--color-text)', background: 'var(--color-surface-alt)', padding: '12px', borderRadius: 'var(--radius-md)', fontStyle: 'italic', border: '1px solid var(--color-border)' }}>
                            "{req.correctionReason}"
                          </p>
                          {req.correctionProofUrl && (
                            <a href={req.correctionProofUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-accent)', textDecoration: 'none', background: 'var(--color-accent-light)', padding: '6px 12px', borderRadius: 'var(--radius-full)' }}>
                              View Supporting Proof <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: Actions */}
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px', paddingTop: '16px', borderTop: '1px dashed var(--color-border)' }}>
                        <input 
                          type="text" 
                          placeholder="Add remarks (optional)..." 
                          className="input-field" 
                          style={{ flex: 1, minWidth: '200px', maxWidth: '350px' }} 
                          value={remarks[req._id] || ''}
                          onChange={(e) => setRemarks(prev => ({ ...prev, [req._id]: e.target.value }))}
                        />
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button 
                            onClick={() => handleAction(req._id, 'reject')}
                            disabled={actionLoading === req._id}
                            className="btn-danger"
                            style={{ padding: '12px 24px', fontSize: '0.9rem' }}
                          >
                            {actionLoading === req._id ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />} Reject
                          </button>
                          <button 
                            onClick={() => handleAction(req._id, 'approve')}
                            disabled={actionLoading === req._id}
                            style={{ padding: '12px 24px', fontSize: '0.9rem', background: 'var(--gradient-success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-colored-green)', transition: 'all 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                          >
                            {actionLoading === req._id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Approve
                          </button>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--color-text-tertiary)', background: 'var(--color-surface)', borderRadius: 'var(--radius-2xl)', border: '1px dashed var(--color-border)' }}
                >
                  <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'var(--color-surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <CheckCircle2 size={40} style={{ color: 'var(--color-success)' }} />
                  </div>
                  <h3 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--color-text)', marginBottom: '8px' }}>All caught up!</h3>
                  <p style={{ fontSize: '1.05rem' }}>No pending attendance correction requests found.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default CorrectionApproval;
