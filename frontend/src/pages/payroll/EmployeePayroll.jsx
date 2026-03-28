import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import AppShell from '../../components/layout/AppShell';
import { 
  Download, FileText, Loader2, DollarSign, Calendar, TrendingUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const EmployeePayroll = () => {
  const { user } = useAuth();
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMyPayrolls = useCallback(async () => {
    try {
      const { data } = await api.get('/payroll/list'); 
      setPayrolls(data.data);
    } catch (err) {
      toast.error('Failed to fetch salary history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMyPayrolls(); }, [fetchMyPayrolls]);

  const downloadSlip = async (id, name) => {
    try {
      const response = await api.get(`/payroll/salary-slip/${id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `SalarySlip_${name}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Failed to download slip');
    }
  };

  return (
    <AppShell>
      <div className="page-wrapper fade-in" style={{ padding: '32px' }}>
        <header style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-0.03em' }}>My Pay Slips</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>View and download your monthly salary statements</p>
        </header>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="animate-spin" size={40} color="var(--color-accent)" /></div>
        ) : (
          <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {payrolls.length > 0 ? (
              payrolls.map((p) => (
                <motion.div
                  key={p._id}
                  whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
                  className="card"
                  style={{ padding: '24px', borderRadius: '24px', border: '1px solid var(--color-border)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div style={{ background: 'var(--color-surface-alt)', padding: '12px', borderRadius: '16px' }}>
                      <Calendar size={24} color="var(--color-accent)" />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 900 }}>{new Date(p.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(p.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                      <div style={{ color: 'var(--color-text-tertiary)', fontWeight: 700 }}>{p.year}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Net Salary</span>
                      <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-accent)' }}>₹{p.netSalary.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--color-text-tertiary)' }}>Paid Days</span>
                      <span>{p.paidDays} / {p.totalDaysInMonth}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => downloadSlip(p._id, `${p.month}_${p.year}`)}
                    className="btn-primary" 
                    style={{ width: '100%', borderRadius: '12px', gap: '8px', padding: '10px 0' }}
                  >
                    <Download size={18} /> Download PDF
                  </button>
                </motion.div>
              ))
            ) : (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px', background: 'var(--color-surface-alt)', borderRadius: '32px' }}>
                <DollarSign size={64} style={{ opacity: 0.1, marginBottom: '20px' }} />
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>No payroll records found</h3>
                <p>Your salary slips will appear here once processed by HR.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default EmployeePayroll;
