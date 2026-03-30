import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import AppShell from '../../components/layout/AppShell';
import { 
  DollarSign, Download, Users, Briefcase, Calendar, 
  Search, Filter, Loader2, CheckCircle, CheckCircle2, AlertCircle, FileText, Plus, ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const PayrollDashboard = () => {
  const { user } = useAuth();
  
  // Default range: 21st of last month to 20th of current month
  const getDefaultRange = () => {
    const today = new Date();
    const currMonth = today.getMonth();
    const currYear = today.getFullYear();
    
    const start = new Date(currYear, currMonth - 1, 21);
    const end = new Date(currYear, currMonth, 20);
    
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  };

  const [dateRange, setDateRange] = useState(getDefaultRange());
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genForm, setGenForm] = useState({ 
    employeeId: '', 
    startDate: dateRange.startDate, 
    endDate: dateRange.endDate 
  });
  const [employees, setEmployees] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsData, setDetailsData] = useState({ title: '', records: [] });

  const fetchPayrolls = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/payroll/list', { 
        params: { startDate: dateRange.startDate, endDate: dateRange.endDate } 
      });
      setPayrolls(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      toast.error('Failed to fetch payrolls');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchEmployees = useCallback(async () => {
    try {
      const { data } = await api.get('/employees');
      // The API returns { employees: [...], total: ... } inside data.data
      const empList = data.data?.employees || (Array.isArray(data.data) ? data.data : []);
      setEmployees(empList);
    } catch (err) {
      setEmployees([]);
    }
  }, []);

  useEffect(() => {
    fetchPayrolls();
    fetchEmployees();
  }, [fetchPayrolls, fetchEmployees]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!genForm.employeeId || !genForm.startDate || !genForm.endDate) {
      return toast.error('Please fill all fields');
    }
    if (new Date(genForm.startDate) > new Date(genForm.endDate)) {
      return toast.error('Start date cannot be after end date');
    }

    setActionLoading(true);
    try {
      await api.post('/payroll/generate', genForm);
      toast.success('Payroll generated successfully');
      setShowGenerateModal(false);
      fetchPayrolls();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessAll = async () => {
    if (!window.confirm(`Are you sure you want to process payroll for all active employees for the period ${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}?`)) return;
    
    setActionLoading(true);
    try {
      await api.post('/payroll/generate-all', { 
        startDate: dateRange.startDate, 
        endDate: dateRange.endDate 
      });
      toast.success('Bulk payroll processing completed');
      fetchPayrolls();
    } catch (err) {
      toast.error('Bulk generation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (payrolls.length === 0) {
      return toast.error('No payroll data to export');
    }
    const excelData = payrolls.map(p => ({
      'Emp Code': p.employeeCode,
      'Name': p.employeeName,
      'Working Days': p.totalDaysInMonth,
      'Half Days': p.halfDays,
      'Absent Days': p.absentDays,
      'Paid Days': p.paidDays,
      'Basic Salary': p.baseSalary,
      'Gross Salary': p.grossEarnings,
      'Deduction': p.professionalTax, // add other deductions if any
      'Net Salary': p.netSalary,
      'Bank Name': p.employeeId?.bankName || 'N/A',
      'Account No': p.employeeId?.accountNumber || 'N/A',
      'IFSC Code': p.employeeId?.ifsc || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PayrollData');
    XLSX.writeFile(wb, `Payroll_Export_${dateRange.startDate}_${dateRange.endDate}.xlsx`);
  };

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

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <AppShell>
      <div className="page-wrapper fade-in" style={{ padding: '32px' }}>
        <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-0.03em' }}>Payroll Management</h1>
            <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Cycle-based salary processing (21st - 20th)</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleExportExcel}
              className="btn-secondary"
              style={{ padding: '12px 24px', borderRadius: '16px', gap: '8px' }}
            >
              <FileText size={20} /> Export Excel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleProcessAll}
              className="btn-primary"
              style={{ padding: '12px 24px', borderRadius: '16px', gap: '8px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />} Process All
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setGenForm({ ...genForm, startDate: dateRange.startDate, endDate: dateRange.endDate });
                setShowGenerateModal(true);
              }}
              className="btn-secondary"
              style={{ padding: '12px 24px', borderRadius: '16px', gap: '8px' }}
            >
              <Plus size={20} /> Process Single
            </motion.button>
          </div>
        </header>

        {/* Filters */}
        <div className="card" style={{ padding: '20px', marginBottom: '24px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Calendar size={18} color="var(--color-accent)" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="date" 
                className="input-field" 
                value={dateRange.startDate} 
                onChange={e => setDateRange({...dateRange, startDate: e.target.value})} 
                style={{ width: '160px' }}
              />
              <ArrowRight size={16} color="var(--color-text-tertiary)" />
              <input 
                type="date" 
                className="input-field" 
                value={dateRange.endDate} 
                onChange={e => setDateRange({...dateRange, endDate: e.target.value})}
                style={{ width: '160px' }}
              />
            </div>
          </div>
          <button onClick={fetchPayrolls} className="btn-secondary" style={{ padding: '8px 20px', borderRadius: '12px' }}>Filter</button>
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}><Loader2 className="animate-spin" size={40} color="var(--color-accent)" /></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Period</th>
                  <th>Paid Days</th>
                  <th>Absents</th>
                  <th>Half Days</th>
                  <th>Gross Salary</th>
                  <th>PT</th>
                  <th>Net Payable</th>
                  <th>Slip</th>
                </tr>
              </thead>
              <tbody>
                {!Array.isArray(employees) || employees.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '60px' }}>
                      <div style={{ opacity: 0.5, marginBottom: '12px' }}><Search size={48} style={{ margin: '0 auto' }} /></div>
                      <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--color-text-secondary)' }}>No employees found</div>
                    </td>
                  </tr>
                ) : employees.map(emp => {
                  const p = payrolls.find(pay => pay.employeeId === emp._id || pay.employeeId?._id === emp._id);
                  const isProcessed = !!p;

                  return (
                    <tr key={emp._id} style={{ opacity: isProcessed ? 1 : 0.7 }}>
                      <td>
                        <div style={{ fontWeight: 800 }}>{emp.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{emp.employeeCode}</div>
                      </td>
                      <td style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {isProcessed ? (
                          `${formatDate(p.fromDate)} - ${formatDate(p.toDate)}`
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)' }}>{formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {isProcessed ? `${p.paidDays} / ${p.totalDaysInMonth}` : '-'}
                      </td>
                      <td>
                        {isProcessed ? (
                          <button 
                            onClick={() => {
                              setDetailsData({ title: `Absents for ${emp.name}`, records: p.absentDayDetails || [] });
                              setShowDetailsModal(true);
                            }}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: 'none', padding: '4px 12px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}
                          >
                            {p.absentDays}
                          </button>
                        ) : '-'}
                      </td>
                      <td>
                        {isProcessed ? (
                          <button 
                            onClick={() => {
                              setDetailsData({ title: `Half Days for ${emp.name}`, records: p.halfDayDetails || [] });
                              setShowDetailsModal(true);
                            }}
                            style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', border: 'none', padding: '4px 12px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' }}
                          >
                            {p.halfDays}
                          </button>
                        ) : '-'}
                      </td>
                      <td>{isProcessed ? `₹${p.grossEarnings.toLocaleString()}` : '-'}</td>
                      <td style={{ color: '#EF4444' }}>{isProcessed ? `₹${p.professionalTax}` : '-'}</td>
                      <td style={{ fontWeight: 900, color: isProcessed ? 'var(--color-accent)' : 'var(--color-text-tertiary)', fontSize: '1rem' }}>
                        {isProcessed ? `₹${p.netSalary.toLocaleString()}` : 'Not Generated'}
                      </td>
                      <td>
                        {isProcessed ? (
                          <button onClick={() => downloadSlip(p._id, emp.name)} className="btn-icon" title="Download Slip">
                            <Download size={18} />
                          </button>
                        ) : (
                          <button 
                            onClick={() => {
                              setGenForm({ employeeId: emp._id, startDate: dateRange.startDate, endDate: dateRange.endDate });
                              setShowGenerateModal(true);
                            }}
                            className="btn-icon" 
                            style={{ color: 'var(--color-accent)' }}
                            title="Generate Now"
                          >
                            <Plus size={18} />
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

        {/* Generate Modal */}
        <AnimatePresence>
          {showGenerateModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowGenerateModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)' }} />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} style={{ position: 'relative', background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '440px', padding: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '24px' }}>Process Payroll</h2>
                <form onSubmit={handleGenerate} style={{ display: 'grid', gap: '20px' }}>
                  <div>
                    <label className="form-label">Employee</label>
                    <select className="input-field" required value={genForm.employeeId} onChange={e => setGenForm({...genForm, employeeId: e.target.value})}>
                      <option value="">Select Employee</option>
                      {employees.map(e => <option key={e._id} value={e._id}>{e.name} ({e.employeeCode})</option>)}
                    </select>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label className="form-label">Start Date</label>
                      <input 
                        type="date" 
                        className="input-field" 
                        value={genForm.startDate} 
                        onChange={e => setGenForm({...genForm, startDate: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="form-label">End Date</label>
                      <input 
                        type="date" 
                        className="input-field" 
                        value={genForm.endDate} 
                        onChange={e => setGenForm({...genForm, endDate: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div style={{ padding: '16px', background: 'rgba(59,130,246,0.05)', borderRadius: '16px', border: '1px solid rgba(59,130,246,0.1)' }}>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '0.85rem', color: 'var(--color-accent)', fontWeight: 600, lineHeight: '1.4' }}>
                      <AlertCircle size={18} style={{ flexShrink: 0 }} />
                      <div>
                        Paid days will be calculated based on attendance from {formatDate(genForm.startDate)} to {formatDate(genForm.endDate)}.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowGenerateModal(false)}>Cancel</button>
                    <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={actionLoading}>
                      {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Process Now'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Details Modal (For Absents and Half Days) */}
        <AnimatePresence>
          {showDetailsModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDetailsModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)' }} />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} style={{ position: 'relative', background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '400px', padding: '24px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', color: 'var(--color-text)' }}>{detailsData.title}</h3>
                
                <div style={{ overflowY: 'auto', flex: 1, paddingRight: '10px' }}>
                  {detailsData.records.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {detailsData.records.map((r, i) => (
                        <div key={i} style={{ padding: '12px', background: 'var(--color-surface-alt)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-accent)' }}>
                            {formatDate(r.date)}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', background: '#fff', padding: '4px 8px', borderRadius: '8px', fontWeight: 600 }}>
                            {r.reason || 'No Reason Provided'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-tertiary)' }}>
                      No records found
                    </div>
                  )}
                </div>

                <button onClick={() => setShowDetailsModal(false)} className="btn-secondary" style={{ marginTop: '20px', width: '100%' }}>Close</button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
};

export default PayrollDashboard;
