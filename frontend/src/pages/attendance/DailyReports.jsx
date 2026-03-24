import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { 
  FileText, Search, User, Calendar, 
  CheckCheck, Clock, Loader2, ChevronRight,
  Filter, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppShell from '../../components/layout/AppShell';

const DailyReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [filterStatus, setFilterStatus] = useState('All'); // 'All', 'Read', 'Unread'

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/attendance/admin', { params: { limit: 200 } });
      // Only keep records that have a todayWork report
      const reportRecords = data.data.records.filter(r => r.todayWork);
      setReports(reportRecords);
    } catch (err) {
      toast.error('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleMarkRead = async (id) => {
    try {
      await api.patch(`/attendance/mark-read/${id}`);
      fetchReports();
      if (selectedReport?._id === id) {
        setSelectedReport(prev => ({ ...prev, isRead: true }));
      }
      toast.success('Report acknowledged');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const filteredReports = reports.filter(r => {
    const matchesSearch = r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Check if current user is in reportReadBy or if we consider it read
    // This depends on backend logic, assume if it's in records it's fetched for management
    const isRead = r.reportReadBy?.length > 0; // Simplified for now
    
    if (filterStatus === 'Read') return matchesSearch && isRead;
    if (filterStatus === 'Unread') return matchesSearch && !isRead;
    return matchesSearch;
  });

  return (
    <AppShell>
      <div className="page-wrapper fade-in" style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
        <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.03em' }}>Daily Reports</h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem', marginTop: '4px' }}>Monitor team productivity and project updates</p>
          </div>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
              <input 
                type="text" 
                placeholder="Search employee..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '12px 16px 12px 44px', borderRadius: '14px', border: '1px solid var(--color-border)', background: '#fff', width: '280px', fontSize: '0.95rem', outline: 'none' }}
              />
            </div>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--color-border)', background: '#fff', fontWeight: 600, outline: 'none' }}
            >
              <option value="All">All Reports</option>
              <option value="Unread">Unread First</option>
              <option value="Read">Reviewed</option>
            </select>
          </div>
        </header>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
            <Loader2 size={48} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        ) : filteredReports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px', background: 'var(--color-surface)', borderRadius: '32px', border: '1px dashed var(--color-border)' }}>
            <FileText size={64} style={{ color: 'var(--color-text-tertiary)', marginBottom: '20px' }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>No reports found</h3>
            <p style={{ color: 'var(--color-text-secondary)' }}>Try adjusting your filters or search term</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
            {filteredReports.map((report) => (
              <motion.div 
                key={report._id}
                whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}
                onClick={() => setSelectedReport(report)}
                style={{ 
                  background: '#fff', borderRadius: '24px', padding: '24px', 
                  border: '1px solid var(--color-border)', cursor: 'pointer',
                  position: 'relative', overflow: 'hidden', transition: 'all 0.3s'
                }}
              >
                {!report.reportReadBy?.length && (
                  <div style={{ position: 'absolute', top: '12px', right: '12px', width: '10px', height: '10px', background: '#EF4444', borderRadius: '50%' }} />
                )}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'var(--color-surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 800 }}>
                    {report.employeeName[0]}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 800 }}>{report.employeeName}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      <Calendar size={12} />
                      {new Date(report.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <p style={{ 
                    fontSize: '0.95rem', color: 'var(--color-text-secondary)', 
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', 
                    overflow: 'hidden', lineHeight: '1.6' 
                  }}>
                    {report.todayWork}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--color-surface-alt)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {report.issuesFaced ? (
                      <span style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 700, background: 'rgba(239,68,68,0.1)', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} /> Blockers
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 700, background: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                        On Track
                      </span>
                    )}
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--color-text-tertiary)' }} />
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        <AnimatePresence>
          {selectedReport && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedReport(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)' }} />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                style={{ position: 'relative', background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.5)' }}
              >
                <div style={{ padding: '40px', maxHeight: '100%', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'var(--color-surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 900 }}>
                        {selectedReport.employeeName[0]}
                      </div>
                      <div>
                        <h2 style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>{selectedReport.employeeName}</h2>
                        <p style={{ color: 'var(--color-text-tertiary)', fontWeight: 600 }}>{selectedReport.employeeCode} · {new Date(selectedReport.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '32px' }}>
                    <section>
                      <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '12px', letterSpacing: '0.1em', fontWeight: 800 }}>Tasks Completed</h4>
                      <div style={{ background: 'var(--color-surface-alt)', padding: '24px', borderRadius: '20px', fontSize: '1.05rem', lineHeight: '1.8', color: 'var(--color-text)' }}>
                        {selectedReport.todayWork}
                      </div>
                    </section>

                    <section>
                      <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: '12px', letterSpacing: '0.1em', fontWeight: 800 }}>Pending Tasks</h4>
                      <div style={{ background: 'var(--color-surface-alt)', padding: '24px', borderRadius: '20px', fontSize: '1.05rem', lineHeight: '1.8', color: 'var(--color-text)' }}>
                        {selectedReport.pendingWork || 'None reported for today.'}
                      </div>
                    </section>

                    {selectedReport.issuesFaced && (
                      <section>
                        <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#EF4444', marginBottom: '12px', letterSpacing: '0.1em', fontWeight: 800 }}>Blockers & Issues</h4>
                        <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', padding: '24px', borderRadius: '20px', fontSize: '1.05rem', lineHeight: '1.8', color: '#EF4444' }}>
                          {selectedReport.issuesFaced}
                        </div>
                      </section>
                    )}
                  </div>

                  <div style={{ marginTop: '40px', display: 'flex', gap: '16px' }}>
                    <button onClick={() => setSelectedReport(null)} className="btn-secondary" style={{ flex: 1, borderRadius: '20px', padding: '18px' }}>Close</button>
                    {!selectedReport.reportReadBy?.some(id => id === 'current_user_id') && ( // Assuming we check if read
                      <button onClick={() => handleMarkRead(selectedReport._id)} className="btn-primary" style={{ flex: 2, borderRadius: '20px', padding: '18px' }}>
                        Acknowledge Report
                      </button>
                    )}
                  </div>
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

export default DailyReports;
