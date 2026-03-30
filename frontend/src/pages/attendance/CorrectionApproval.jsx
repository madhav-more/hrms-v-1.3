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
  const [remarks, setRemarks] = useState('');
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
    try {
      if (action === 'approve') {
        await api.patch(`/attendance/correction-approve/${id}`, { remark: remarks });
        toast.success('Correction approved');
      } else {
        await api.patch(`/attendance/correction-reject/${id}`, { remark: remarks });
        toast.success('Correction rejected');
      }
      setRemarks('');
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
      <div className="page-wrapper fade-in" style={{ padding: '32px' }}>
        <header style={{ marginBottom: '40px', display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-0.03em' }}>Attendance Corrections</h1>
            <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Review and approve employee-requested attendance adjustments</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
              <input 
                type="text" 
                placeholder="Search employee..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '40px', width: '250px' }}
              />
            </div>
          </div>
        </header>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
            <Loader2 className="animate-spin" size={48} color="var(--color-accent)" />
          </div>
        ) : (
          <div className="grid-container" style={{ display: 'grid', gap: '24px' }}>
            {filteredRequests.length > 0 ? (
              filteredRequests.map((req) => (
                <motion.div
                  key={req._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card"
                  style={{ padding: '24px', borderRadius: '24px', borderLeft: '6px solid var(--color-accent)' }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                    
                    {/* Employee Info */}
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'var(--color-surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={24} color="var(--color-accent)" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{req.employeeName}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>{req.employeeCode} · {req.department}</div>
                      </div>
                    </div>

                    {/* Date & Times */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '4px', fontWeight: 600 }}>
                        <Calendar size={16} /> {new Date(req.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--color-text-tertiary)' }}>Current:</span> {formatTime(req.inTime)} – {formatTime(req.outTime)}
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                        <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 600 }}>Requested:</span> {formatTime(req.requestedInTime)} – {formatTime(req.requestedOutTime)}
                      </div>
                    </div>

                    {/* Reason */}
                    <div style={{ flex: 2 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Reason</div>
                      <p style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>"{req.correctionReason}"</p>
                      {req.correctionProofUrl && (
                        <a href={req.correctionProofUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-accent)' }}>
                          View Proof <ExternalLink size={12} />
                        </a>
                      )}
                    </div>

                    {/* Stage */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        display: 'inline-block', 
                        padding: '6px 12px', 
                        borderRadius: '12px', 
                        background: 'rgba(59,130,246,0.1)', 
                        color: '#3B82F6', 
                        fontSize: '0.75rem', 
                        fontWeight: 800,
                        marginBottom: '12px'
                      }}>
                        STAGE: {req.correctionStatus.replace('Pending_', '')}
                      </div>

                      {/* Approval Actions */}
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <input 
                          type="text" 
                          placeholder="Remarks..." 
                          className="input-field" 
                          style={{ maxWidth: '180px', height: '40px', borderRadius: '12px', fontSize: '0.85rem' }} 
                          onChange={(e) => setRemarks(e.target.value)}
                        />
                        <button 
                          onClick={() => handleAction(req._id, 'approve')}
                          disabled={actionLoading === req._id}
                          className="btn-primary"
                          style={{ padding: '8px 16px', borderRadius: '12px', background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                        >
                          {actionLoading === req._id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Approve
                        </button>
                        <button 
                          onClick={() => handleAction(req._id, 'reject')}
                          disabled={actionLoading === req._id}
                          className="btn-primary"
                          style={{ padding: '8px 16px', borderRadius: '12px', background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                        >
                          {actionLoading === req._id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Reject
                        </button>
                      </div>
                    </div>

                  </div>
                </motion.div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '100px', color: 'var(--color-text-tertiary)' }}>
                <CheckCircle2 size={64} style={{ opacity: 0.1, marginBottom: '20px', margin: '0 auto' }} />
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>All catch up!</h3>
                <p>No pending attendance correction requests found.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default CorrectionApproval;
