import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  Clock, MapPin, CheckCircle, LogOut, Loader2,
  AlertCircle, ChevronRight, Send, UserCircle, X,
  FileText, AlertTriangle, Users, Camera, Wifi, WifiOff,
  Shield, Zap,
} from 'lucide-react';
import * as faceapi from 'face-api.js';
import { motion, AnimatePresence } from 'framer-motion';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/* ── Geo status pill ─────────────────────────────────────────── */
const GeoStatus = ({ status, distance }) => {
  const map = {
    checking: { color: '#D97706', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', Icon: Wifi,    text: 'Verifying…' },
    valid:    { color: '#059669', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', Icon: CheckCircle, text: `Within Zone · ${distance}m` },
    invalid:  { color: '#DC2626', bg: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.3)', Icon: WifiOff,   text: `Out of Range · ${distance}m` },
    error:    { color: '#DC2626', bg: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.3)', Icon: WifiOff,   text: 'GPS Denied' },
  };
  const c = map[status] || map.checking;
  const CIcon = c.Icon;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px',
        background: c.bg, color: c.color,
        padding: '8px 16px', borderRadius: 'var(--radius-full)',
        fontSize: '0.8rem', fontWeight: 700,
        border: `1px solid ${c.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <CIcon size={13} />
      {c.text}
    </motion.div>
  );
};

/* ── Time display box ────────────────────────────────────────── */
const TimeBox = ({ label, value, color }) => (
  <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.08)', minWidth: '80px' }}>
    <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>{label}</p>
    <p style={{ fontSize: '1.1rem', fontWeight: 800, color: color || '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</p>
  </div>
);

const AttendancePage = () => {
  const { user, refreshProfile } = useAuth();
  const [todayRecord, setTodayRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [geoStatus, setGeoStatus] = useState('checking');
  const [geoDistance, setGeoDistance] = useState(0);
  const [coords, setCoords] = useState(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [isOvertime, setIsOvertime] = useState(false);
  const [officeSettings, setOfficeSettings] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState({ todayWork: '', pendingWork: '', issuesFaced: '', reportParticipants: [] });
  const [managementEmployees, setManagementEmployees] = useState([]);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [verifyingFace, setVerifyingFace] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceOp, setFaceOp] = useState(null);
  const videoRef = useRef();

  const loadModels = async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
      setModelsLoaded(true);
    } catch (err) {
      toast.error('Failed to load face verification models');
    }
  };

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: {} })
      .then(s => { if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(() => toast.error('Webcam access denied'));
  };

  const stopVideo = () => {
    if (videoRef.current?.srcObject)
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
  };

  const handleVerifyFaceAndProceed = async () => {
    if (!videoRef.current) return;
    setVerifyingFace(true);
    try {
      if (!user.faceDescriptor?.length) {
        toast.error('Face ID not registered. Visit your Profile to set it up.');
        setVerifyingFace(false);
        return;
      }
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) { toast.error('No face detected. Reposition yourself.'); setVerifyingFace(false); return; }

      const dist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(user.faceDescriptor));
      if (dist > 0.6) { toast.error('Face mismatch. Try again.'); setVerifyingFace(false); return; }

      toast.success('Identity Verified ✓');
      setShowFaceModal(false);
      stopVideo();
      if (faceOp === 'checkin') await proceedWithCheckIn();
      else if (faceOp === 'checkout') setShowReportModal(true);
    } catch (err) {
      toast.error('Face verification failed');
    } finally { setVerifyingFace(false); }
  };

  // Live timer
  useEffect(() => {
    refreshProfile();
    if (!todayRecord?.inTime || todayRecord?.outTime) return;
    const inTime = new Date(todayRecord.inTime);
    const shiftMs = (inTime.getDay() === 6 ? 7 : 8.5) * 3600000;
    const tick = () => {
      const worked = Date.now() - inTime.getTime();
      const rem = shiftMs - worked;
      setIsOvertime(rem < 0);
      setRemainingMs(Math.abs(rem));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [todayRecord]);

  const fetchGeo = useCallback((office) => {
    if (!office || !navigator.geolocation) { setGeoStatus('error'); return; }
    setGeoStatus('checking');
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => {
        setCoords({ latitude, longitude });
        const R = 6371000, tr = v => (v * Math.PI) / 180;
        const dLat = tr(latitude - office.lat), dLng = tr(longitude - office.lng);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(tr(office.lat)) * Math.cos(tr(latitude)) * Math.sin(dLng / 2) ** 2;
        const d = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        setGeoDistance(d);
        setGeoStatus(d <= office.radius ? 'valid' : 'invalid');
      },
      () => setGeoStatus('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const fetchToday = useCallback(async () => {
    try {
      const { data } = await api.get('/attendance/today');
      setTodayRecord(data.data.record);
      if (data.data.office) { setOfficeSettings(data.data.office); fetchGeo(data.data.office); }
    } catch (_) {}
    setLoading(false);
  }, [fetchGeo]);

  const fetchManagement = useCallback(async () => {
    try {
      const { data } = await api.get('/employees/management');
      setManagementEmployees(data.data);
    } catch (_) {}
  }, []);

  useEffect(() => { fetchToday(); fetchManagement(); }, [fetchToday, fetchManagement]);

  const handleCheckIn = async () => {
    if (!coords) { toast.error('Location not available'); return; }
    if (geoStatus === 'invalid') { toast.error(`Out of Zone: ${geoDistance}m away.`); return; }
    if (!user.faceDescriptor?.length) { toast.error('Register Face ID from Profile first!'); return; }
    if (!modelsLoaded) await loadModels();
    setFaceOp('checkin');
    setShowFaceModal(true);
    setTimeout(startVideo, 100);
  };

  const proceedWithCheckIn = async () => {
    setActionLoading(true);
    try {
      await api.post('/attendance/check-in', { latitude: coords.latitude, longitude: coords.longitude });
      toast.success('Checked In Successfully!');
      fetchToday();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-in failed');
    } finally { setActionLoading(false); }
  };

  const handleCheckOutSubmit = async () => {
    if (!reportData.todayWork.trim()) { toast.error("Describe today's work first"); return; }
    setActionLoading(true);
    try {
      const { data } = await api.post('/attendance/check-out', { latitude: coords.latitude, longitude: coords.longitude, ...reportData });
      const { overtimeMinutes, shortfallMinutes } = data.data;
      if (overtimeMinutes > 0) toast.success(`Checked out! Overtime: ${overtimeMinutes}m`);
      else if (shortfallMinutes > 0) toast(`Checked out ${shortfallMinutes}m early`, { icon: '⚠️' });
      else toast.success('Checked Out Successfully!');
      setShowReportModal(false);
      fetchToday();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-out failed');
    } finally { setActionLoading(false); }
  };

  const toggleParticipant = (id) =>
    setReportData(p => ({
      ...p,
      reportParticipants: p.reportParticipants.includes(id)
        ? p.reportParticipants.filter(x => x !== id)
        : [...p.reportParticipants, id],
    }));

  const isCheckedIn = !!todayRecord?.inTime;
  const isCheckedOut = !!todayRecord?.outTime;
  const fmtT = (s) => s ? new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
  const canAct = geoStatus === 'valid' && !actionLoading && coords;

  return (
    <AppShell>
      <div className="page-wrapper fade-in">

        {/* ── Page Header ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--color-text)', marginBottom: '4px' }}>
              Attendance
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <GeoStatus status={geoStatus} distance={geoDistance} />
            <button className="btn-icon" onClick={() => fetchGeo(officeSettings)} title="Refresh Location">
              <MapPin size={16} />
            </button>
          </div>
        </div>

        {/* ── Main Grid ───────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: '20px' }}>

          {/* ── Central Action Card ──────────────────────────────── */}
          <div style={{
            background: 'linear-gradient(145deg, #0F172A 0%, #162035 60%, #1A2647 100%)',
            borderRadius: 'var(--radius-2xl)',
            padding: 'clamp(28px, 6vw, 52px)',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '360px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 24px 60px rgba(15,23,42,0.3)',
          }}>
            {/* decorative blobs */}
            <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '280px', height: '280px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)', filter: 'blur(40px)' }} />
            <div style={{ position: 'absolute', bottom: '-40px', left: '-20px', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)', filter: 'blur(32px)' }} />

            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%' }}>
              {loading ? (
                <Loader2 size={40} className="animate-spin" style={{ color: 'rgba(255,255,255,0.25)' }} />
              ) : (
                <AnimatePresence mode="wait">
                  {/* ── Timer (active session) ── */}
                  {isCheckedIn && !isCheckedOut && (
                    <motion.div key="timer" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} style={{ marginBottom: '36px' }}>
                      <p style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: isOvertime ? '#FCD34D' : 'rgba(255,255,255,0.45)', marginBottom: '10px' }}>
                        {isOvertime ? '⏱ Overtime Running' : 'Shift Time Remaining'}
                      </p>
                      <div style={{ fontSize: 'clamp(2.5rem, 10vw, 4.5rem)', fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-4px', lineHeight: 1, color: isOvertime ? '#FCD34D' : '#fff', marginBottom: '6px' }}>
                        {isOvertime && '+'}{formatDuration(remainingMs)}
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', marginTop: '6px' }}>
                        Clocked in at {fmtT(todayRecord?.inTime)}
                      </p>
                    </motion.div>
                  )}

                  {/* ── Pre check-in state ── */}
                  {!isCheckedIn && (
                    <motion.div key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginBottom: '36px' }}>
                      <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <Clock size={36} style={{ color: 'rgba(255,255,255,0.25)' }} />
                      </div>
                      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>Ready to Begin?</h2>
                      <p style={{ color: 'rgba(255,255,255,0.45)', maxWidth: '260px', margin: '0 auto', fontSize: '0.9rem' }}>
                        Ensure you're within the office zone, then check in securely.
                      </p>
                    </motion.div>
                  )}

                  {/* ── Day complete ── */}
                  {isCheckedOut && (
                    <motion.div key="done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} style={{ marginBottom: '36px' }}>
                      <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid rgba(16,185,129,0.25)' }}>
                        <CheckCircle size={36} style={{ color: '#10B981' }} />
                      </div>
                      <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>Day Complete!</h2>
                      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem' }}>Attendance securely logged. See you tomorrow!</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* ── Action Buttons ── */}
              {!loading && (
                <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {!isCheckedIn && (
                    <motion.button
                      whileHover={{ scale: canAct ? 1.04 : 1, translateY: canAct ? -2 : 0 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleCheckIn}
                      disabled={!canAct}
                      style={{
                        padding: '18px 44px', borderRadius: 'var(--radius-xl)', border: 'none', cursor: canAct ? 'pointer' : 'not-allowed',
                        background: canAct ? 'var(--gradient-success)' : 'rgba(255,255,255,0.07)',
                        color: '#fff', fontSize: '1.1rem', fontWeight: 800,
                        display: 'inline-flex', alignItems: 'center', gap: '12px',
                        boxShadow: canAct ? '0 12px 32px rgba(16,185,129,0.35)' : 'none',
                        transition: 'all 0.3s', opacity: canAct ? 1 : 0.5,
                      }}
                    >
                      {actionLoading ? <Loader2 size={22} className="animate-spin" /> : <Shield size={22} />}
                      Secure Check In
                    </motion.button>
                  )}

                  {isCheckedIn && !isCheckedOut && (
                    <motion.button
                      whileHover={{ scale: canAct ? 1.04 : 1, translateY: canAct ? -2 : 0 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={async () => {
                        if (!coords) { toast.error('Location unavailable'); return; }
                        if (geoStatus === 'invalid') { toast.error('Out of zone!'); return; }
                        if (!user.faceDescriptor?.length) { toast.error('Face ID not registered!'); return; }
                        if (!modelsLoaded) await loadModels();
                        setFaceOp('checkout');
                        setShowFaceModal(true);
                        setTimeout(startVideo, 100);
                      }}
                      disabled={!canAct}
                      style={{
                        padding: '18px 44px', borderRadius: 'var(--radius-xl)', border: 'none', cursor: canAct ? 'pointer' : 'not-allowed',
                        background: canAct ? 'var(--gradient-error)' : 'rgba(255,255,255,0.07)',
                        color: '#fff', fontSize: '1.1rem', fontWeight: 800,
                        display: 'inline-flex', alignItems: 'center', gap: '12px',
                        boxShadow: canAct ? '0 12px 32px rgba(220,38,38,0.3)' : 'none',
                        transition: 'all 0.3s', opacity: canAct ? 1 : 0.5,
                      }}
                    >
                      {actionLoading ? <Loader2 size={22} className="animate-spin" /> : <LogOut size={22} />}
                      Check Out
                    </motion.button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Side Panel ──────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Time Metrics Card */}
            <div className="card" style={{ padding: '22px' }}>
              <p className="section-title" style={{ marginBottom: '18px' }}>Today's Metrics</p>
              <div style={{ display: 'grid', gap: '12px' }}>
                {[
                  { label: 'Check In', value: fmtT(todayRecord?.inTime), color: 'var(--color-success)' },
                  { label: 'Check Out', value: isCheckedOut ? fmtT(todayRecord?.outTime) : 'Pending', color: isCheckedOut ? 'var(--color-primary)' : 'var(--color-text-tertiary)' },
                  ...(todayRecord?.totalHours ? [{ label: 'Total Hours', value: `${todayRecord.totalHours.toFixed(1)}h`, color: 'var(--color-accent)' }] : []),
                ].map((m, i) => (
                  <div key={i}>
                    {i > 0 && <div className="divider" style={{ marginBottom: '12px' }} />}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{m.label}</span>
                      <span style={{ fontWeight: 800, color: m.color, fontSize: '0.95rem' }}>{loading ? '—' : m.value}</span>
                    </div>
                  </div>
                ))}
                {todayRecord?.isLate && (
                  <>
                    <div className="divider" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-warning-light)', borderRadius: 'var(--radius-md)', padding: '10px 12px', border: '1px solid #FDE68A' }}>
                      <AlertCircle size={14} color="var(--color-warning)" />
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-warning)' }}>Late by {todayRecord.lateMinutes} minutes</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Attendance History Link */}
            <motion.a
              href="/attendance/summary"
              whileHover={{ y: -3 }}
              style={{ textDecoration: 'none' }}
            >
              <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-lg)', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={20} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.92rem' }}>Attendance History</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>View monthly logs & reports</p>
                </div>
                <ChevronRight size={16} color="var(--color-text-tertiary)" />
              </div>
            </motion.a>

            {/* Zone info */}
            {officeSettings && (
              <div className="card" style={{ padding: '18px 20px' }}>
                <p className="section-title" style={{ marginBottom: '12px' }}>Office Zone</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: geoStatus === 'valid' ? 'var(--color-success-light)' : 'var(--color-error-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MapPin size={16} color={geoStatus === 'valid' ? 'var(--color-success)' : 'var(--color-error)'} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.88rem' }}>Radius: {officeSettings.radius}m</p>
                    <p style={{ fontSize: '0.76rem', color: 'var(--color-text-tertiary)' }}>You are {geoDistance}m away</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            CHECKOUT REPORT MODAL
        ══════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {showReportModal && (
            <div className="modal-backdrop">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowReportModal(false)}
                style={{ position: 'absolute', inset: 0 }}
              />
              <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 24 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: 24 }}
                transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                style={{
                  position: 'relative',
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-2xl)',
                  width: '100%',
                  maxWidth: '580px',
                  maxHeight: '90dvh',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-2xl)',
                }}
              >
                {/* header */}
                <div style={{ padding: '28px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Send size={16} color="#fff" />
                      </div>
                      <h2 style={{ fontSize: '1.35rem', fontWeight: 900, letterSpacing: '-0.03em' }}>Check-out Report</h2>
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', paddingLeft: '46px' }}>Complete your daily EOD before leaving</p>
                  </div>
                  <button className="btn-icon" onClick={() => setShowReportModal(false)}><X size={18} /></button>
                </div>

                <div style={{ padding: '24px 28px 28px', overflowY: 'auto', maxHeight: 'calc(90dvh - 80px)', display: 'grid', gap: '20px' }}>
                  {[
                    { key: 'todayWork', label: "Today's Completed Work *", icon: CheckCircle, placeholder: 'What specific tasks did you complete today?', rows: 3 },
                    { key: 'pendingWork', label: 'Pending / Carry-over Tasks', icon: Clock, placeholder: 'Any tasks to carry forward to tomorrow?', rows: 2 },
                    { key: 'issuesFaced', label: 'Blockers / Issues Faced', icon: AlertTriangle, placeholder: 'Any blockers, challenges, or escalations?', rows: 2 },
                  ].map(({ key, label, icon: LIcon, placeholder, rows }) => (
                    <div key={key}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <LIcon size={13} /> {label}
                      </label>
                      <textarea
                        className="input-field"
                        style={{ resize: 'vertical', minHeight: `${rows * 42}px` }}
                        placeholder={placeholder}
                        rows={rows}
                        value={reportData[key]}
                        onChange={(e) => setReportData({ ...reportData, [key]: e.target.value })}
                      />
                    </div>
                  ))}

                  {managementEmployees.length > 0 && (
                    <div>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                        <Users size={13} /> Share Report With
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '14px', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-alt)' }}>
                        {managementEmployees.map(emp => {
                          const sel = reportData.reportParticipants.includes(emp._id);
                          return (
                            <button
                              key={emp._id}
                              onClick={() => toggleParticipant(emp._id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 12px', borderRadius: 'var(--radius-full)',
                                fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', border: 'none',
                                background: sel ? 'var(--color-primary)' : '#fff',
                                color: sel ? '#fff' : 'var(--color-text-secondary)',
                                outline: sel ? 'none' : '1.5px solid var(--color-border)',
                                transition: 'all 0.2s',
                              }}
                            >
                              <UserCircle size={13} />
                              {emp.name}
                              <span style={{ opacity: 0.65, fontSize: '0.7rem' }}>({emp.role})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowReportModal(false)}>Cancel</button>
                    <button
                      className="btn-primary"
                      style={{ flex: 2, gap: '10px' }}
                      onClick={handleCheckOutSubmit}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                      Submit & Check Out
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ═══════════════════════════════════════════════════════════
            FACE VERIFICATION MODAL
        ══════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {showFaceModal && (
            <div className="modal-backdrop">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setShowFaceModal(false); stopVideo(); }}
                style={{ position: 'absolute', inset: 0 }}
              />
              <motion.div
                initial={{ scale: 0.88, opacity: 0, y: 24 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.88, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                style={{
                  position: 'relative',
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-2xl)',
                  width: '100%',
                  maxWidth: '400px',
                  padding: '36px 28px 28px',
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-2xl)',
                }}
              >
                <button
                  className="btn-icon"
                  onClick={() => { setShowFaceModal(false); stopVideo(); }}
                  style={{ position: 'absolute', top: '16px', right: '16px' }}
                >
                  <X size={16} />
                </button>

                <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-lg)', background: 'var(--color-primary-light)', border: '1px solid rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Shield size={26} color="var(--color-primary)" />
                </div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '4px' }}>Security Verification</h2>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', marginBottom: '24px' }}>
                  Verifying identity for <strong>{faceOp === 'checkin' ? 'Check In' : 'Check Out'}</strong>
                </p>

                {/* Camera feed */}
                <div style={{ position: 'relative', width: '220px', height: '220px', margin: '0 auto 24px', borderRadius: '50%', overflow: 'hidden', border: '4px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>
                  <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(180deg, rgba(37,99,235,0) 0%, rgba(37,99,235,0.15) 50%, rgba(37,99,235,0) 100%)',
                    animation: 'scanLine 2s ease-in-out infinite',
                  }} />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setShowFaceModal(false); stopVideo(); }}>Cancel</button>
                  <button className="btn-primary" style={{ flex: 2 }} onClick={handleVerifyFaceAndProceed} disabled={verifyingFace}>
                    {verifyingFace ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
                    {verifyingFace ? 'Verifying…' : 'Verify Identity'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>

      <style>{`
        @keyframes scanLine {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }

        /* Responsive: stack grid on mobile */
        @media (max-width: 900px) {
          .attendance-main-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </AppShell>
  );
};

export default AttendancePage;
