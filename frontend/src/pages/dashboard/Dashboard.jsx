import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import {
  Clock, Calendar, CheckCircle, XCircle, Timer,
  TrendingUp, ArrowRight, Zap, Users, Activity,
  Sun, Sunset, Sunrise, ChevronRight, MapPin,
} from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { motion } from 'framer-motion';

/* ── Mini radial progress ring ─────────────────────────────── */
const Ring = ({ value, max, color, size = 64 }) => {
  const r = (size / 2) - 6;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / (max || 1), 1);
  const dash = circ * pct;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
};

/* ── Animated stat card ─────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, sub, gradient, ringMax }) => (
  <motion.div
    whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
    style={{
      background: '#fff',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      padding: '22px 20px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.3s',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    }}
  >
    {/* top gradient bar */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: gradient, borderRadius: '4px 4px 0 0' }} />
    {/* glow blob */}
    <div style={{ position: 'absolute', bottom: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: gradient, opacity: 0.06, filter: 'blur(20px)' }} />
    
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <p style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>{label}</p>
        <p style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--color-text)', lineHeight: 1, letterSpacing: '-0.04em' }}>{value ?? '—'}</p>
        {sub && <p style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)', marginTop: '4px', fontWeight: 500 }}>{sub}</p>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative' }}>
        <Ring value={value ?? 0} max={ringMax ?? 31} color={gradient.match(/#[A-Fa-f0-9]{6}/)?.[0] ?? '#2563EB'} size={56} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} style={{ color: gradient.match(/#[A-Fa-f0-9]{6}/)?.[0] ?? '#2563EB', opacity: 0.8 }} />
        </div>
      </div>
    </div>
  </motion.div>
);

/* ── Greeting icon by hour ──────────────────────────────────── */
const getGreeting = (h) => {
  if (h < 12) return { text: 'Good Morning', Icon: Sunrise };
  if (h < 17) return { text: 'Good Afternoon', Icon: Sun };
  return { text: 'Good Evening', Icon: Sunset };
};

const Dashboard = () => {
  const { user } = useAuth();
  const [todayRecord, setTodayRecord] = useState(null);
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0, weekOff: 0, totalHours: 0 });
  const [teamStats, setTeamStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  const isManagement = ['SuperUser', 'HR', 'Director', 'VP', 'GM', 'Manager'].includes(user?.role);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [todayRes, summaryRes] = await Promise.all([
          api.get('/attendance/today'),
          api.get('/attendance/my-summary'),
        ]);
        setTodayRecord(todayRes.data.data.record);
        setSummary(summaryRes.data.data.summary);
      } catch (_) {}

      // Try team stats for management
      if (isManagement) {
        try {
          const { data } = await api.get('/attendance/admin', { params: { limit: 5 } });
          setTeamStats(data.data);
        } catch (_) {}
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  const formatTime = (d) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const formatDate = (d) =>
    d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtT = (s) =>
    s ? new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

  const hr = currentTime.getHours();
  const { text: greeting, Icon: GreetIcon } = getGreeting(hr);

  const isCheckedIn = !!todayRecord?.inTime;
  const isCheckedOut = !!todayRecord?.outTime;

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <AppShell>
      <div className="page-wrapper fade-in">

        {/* ── Hero Header ───────────────────────────────────────── */}
        <motion.div
          variants={containerVariants} initial="hidden" animate="visible"
          style={{ marginBottom: '32px' }}
        >
          <motion.div variants={itemVariants} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: 'var(--radius-lg)',
                  background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid #FDE68A',
                }}>
                  <GreetIcon size={22} color="#D97706" />
                </div>
                <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
                  {greeting},{' '}
                  <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
                  &thinsp;👋
                </h1>
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', fontWeight: 500, paddingLeft: '56px' }}>
                {formatDate(currentTime)}
              </p>
            </div>

            {/* Live clock chip */}
            <div style={{
              background: 'linear-gradient(145deg, #0F172A, #1E2D3D)',
              borderRadius: 'var(--radius-xl)',
              padding: '14px 20px',
              color: '#fff',
              display: 'flex', alignItems: 'center', gap: '12px',
              boxShadow: '0 8px 24px rgba(15,23,42,0.2)',
              flexShrink: 0,
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 0 3px rgba(16,185,129,0.25)', animation: 'pulse 2s infinite' }} />
              <div>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '2px' }}>Live Time</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{formatTime(currentTime)}</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Today's Attendance Status ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: 'linear-gradient(145deg, #0F172A 0%, #162032 100%)',
            borderRadius: 'var(--radius-2xl)',
            padding: 'clamp(20px, 4vw, 32px)',
            marginBottom: '28px',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(15,23,42,0.25)',
          }}
        >
          {/* mesh background */}
          <div style={{ position: 'absolute', inset: 0, opacity: 0.4, backgroundImage: 'radial-gradient(ellipse at 80% 20%, rgba(37,99,235,0.25) 0%, transparent 60%), radial-gradient(ellipse at 10% 80%, rgba(16,185,129,0.15) 0%, transparent 50%)' }} />

          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', alignItems: 'center' }}>
            
            {/* Status */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Activity size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)' }}>
                  Today's Status
                </span>
              </div>

              {loading ? (
                <div className="skeleton" style={{ height: '48px', background: 'rgba(255,255,255,0.08)' }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '3px' }}>Check In</p>
                      <p style={{ fontSize: '1.3rem', fontWeight: 800, color: isCheckedIn ? '#34D399' : 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                        {isCheckedIn ? fmtT(todayRecord.inTime) : 'Not yet'}
                      </p>
                    </div>
                    {isCheckedOut && (
                      <div>
                        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '3px' }}>Check Out</p>
                        <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#60A5FA', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                          {fmtT(todayRecord.outTime)}
                        </p>
                      </div>
                    )}
                    {todayRecord?.totalHours > 0 && (
                      <div>
                        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '3px' }}>Total Hours</p>
                        <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#A78BFA', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                          {todayRecord.totalHours.toFixed(1)}h
                        </p>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {!isCheckedIn && (
                      <button
                        className="btn-primary"
                        onClick={() => navigate('/attendance')}
                        style={{ fontSize: '0.85rem', padding: '10px 18px', borderRadius: 'var(--radius-lg)' }}
                      >
                        <Clock size={15} /> Mark Attendance
                      </button>
                    )}
                    {isCheckedIn && !isCheckedOut && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 'var(--radius-full)', padding: '6px 14px' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34D399', animation: 'pulse 2s infinite' }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#34D399' }}>Session Active</span>
                      </div>
                    )}
                    {isCheckedOut && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 'var(--radius-full)', padding: '6px 14px' }}>
                        <CheckCircle size={14} color="#60A5FA" />
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#60A5FA' }}>Day Complete</span>
                      </div>
                    )}
                    {todayRecord?.isLate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: 'var(--radius-full)', padding: '6px 14px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FB923C' }}>⚠ Late by {todayRecord.lateMinutes}m</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* CTA */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <NanoAction label="My Attendance" sub="View history" icon={Calendar} onClick={() => navigate('/attendance/summary')} />
              <NanoAction label="Attendance Clock" sub="Check in/out" icon={Clock} onClick={() => navigate('/attendance')} accent />
            </div>
          </div>
        </motion.div>

        {/* ── Monthly Stats ─────────────────────────────────────── */}
        <div className="section-title" style={{ marginBottom: '16px' }}>This Month's Summary</div>

        {loading ? (
          <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '32px' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: '130px', borderRadius: 'var(--radius-xl)' }} />
            ))}
          </div>
        ) : (
          <motion.div
            className="stat-grid-4"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '32px' }}
            variants={containerVariants} initial="hidden" animate="visible"
          >
            <motion.div variants={itemVariants}>
              <StatCard icon={CheckCircle} label="Present" value={summary.present} sub="working days" gradient="linear-gradient(135deg,#10B981,#059669)" ringMax={26} />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard icon={XCircle} label="Absent" value={summary.absent} sub="missed days" gradient="linear-gradient(135deg,#EF4444,#B91C1C)" ringMax={26} />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard icon={Timer} label="Late Ins" value={summary.late} sub="late arrivals" gradient="linear-gradient(135deg,#F59E0B,#D97706)" ringMax={26} />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatCard icon={TrendingUp} label="Avg Hours" value={summary.present ? (summary.totalHours / summary.present).toFixed(1) + 'h' : '—'} sub="per working day" gradient="linear-gradient(135deg,#8B5CF6,#6366F1)" ringMax={9} />
            </motion.div>
          </motion.div>
        )}

        {/* ── Management Quick Insights ─────────────────────────── */}
        {isManagement && (
          <>
            <div className="section-title" style={{ marginBottom: '16px' }}>Quick Actions</div>
            <motion.div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', marginBottom: '12px' }}
              variants={containerVariants} initial="hidden" animate="visible"
            >
              {[
                { label: 'Team Attendance', sub: 'View reports', icon: Users, path: '/attendance/admin', bg: 'linear-gradient(135deg,#2563EB,#0EA5E9)' },
                { label: 'Daily Reports', sub: 'Review EOD updates', icon: Activity, path: '/attendance/reports', bg: 'linear-gradient(135deg,#7C3AED,#6366F1)' },
                { label: 'Corrections', sub: 'Pending approvals', icon: CheckCircle, path: '/attendance/corrections', bg: 'linear-gradient(135deg,#10B981,#059669)' },
              ].map((q, i) => {
                const Q = q.icon;
                return (
                  <motion.div
                    key={i}
                    variants={itemVariants}
                    onClick={() => navigate(q.path)}
                    whileHover={{ y: -4, boxShadow: '0 16px 32px rgba(0,0,0,0.12)' }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      background: '#fff', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-xl)', padding: '20px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px',
                      transition: 'all 0.25s', position: 'relative', overflow: 'hidden',
                    }}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: q.bg }} />
                    <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-lg)', background: q.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Q size={20} color="#fff" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.label}</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{q.sub}</p>
                    </div>
                    <ChevronRight size={16} color="var(--color-text-tertiary)" />
                  </motion.div>
                );
              })}
            </motion.div>
          </>
        )}

      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (max-width: 640px) {
          .stat-grid-4 { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>
    </AppShell>
  );
};

/* Tiny action card used in the dark hero section */
const NanoAction = ({ label, sub, icon: Icon, onClick, accent }) => (
  <motion.button
    whileHover={{ scale: 1.04 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      background: accent ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.06)',
      border: `1px solid ${accent ? 'rgba(37,99,235,0.4)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 'var(--radius-lg)', padding: '12px 18px',
      cursor: 'pointer', color: '#fff', textAlign: 'left',
    }}
  >
    <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: accent ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={18} />
    </div>
    <div>
      <p style={{ fontWeight: 700, fontSize: '0.88rem' }}>{label}</p>
      <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: '1px' }}>{sub}</p>
    </div>
    <ArrowRight size={14} style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 'auto', flexShrink: 0 }} />
  </motion.button>
);

export default Dashboard;
