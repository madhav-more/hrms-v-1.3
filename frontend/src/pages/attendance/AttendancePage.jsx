import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { 
  Clock, MapPin, CheckCircle, LogOut, Timer, Loader2, 
  AlertCircle, ChevronDown, Send, UserCircle, X,
  FileText, AlertTriangle, Users, Camera
} from 'lucide-react';
import * as faceapi from 'face-api.js';
import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const GeoStatus = ({ status, distance }) => {
  const config = {
    checking: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', text: 'Verifying Location...' },
    valid: { color: '#10B981', bg: 'rgba(16,185,129,0.1)', text: `Safe Zone (${distance}m)` },
    invalid: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', text: `Out of Range (${distance}m)` },
    error: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', text: 'GPS Access Denied' },
  };
  const c = config[status] || config.checking;
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: c.bg, color: c.color, padding: '8px 16px', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 700, border: `1px solid ${c.color}22` }}
    >
      <MapPin size={14} />
      {c.text}
    </motion.div>
  );
};

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

  // States for Checkout Reporting
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState({
    todayWork: '',
    pendingWork: '',
    issuesFaced: '',
    reportParticipants: []
  });
  const [managementEmployees, setManagementEmployees] = useState([]);

  // Face Verification States
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [verifyingFace, setVerifyingFace] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceOp, setFaceOp] = useState(null); // 'checkin' or 'checkout'
  const videoRef = useRef();

  const loadModels = async () => {
    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      setModelsLoaded(true);
    } catch (err) {
      console.error("Error loading models", err);
      toast.error("Failed to load face verification models");
    }
  };

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: {} })
      .then(stream => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(err => toast.error("Webcam access denied"));
  };

  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  const handleVerifyFaceAndProceed = async () => {
    if (!videoRef.current) return;
    setVerifyingFace(true);

    try {
      if (!user.faceDescriptor || user.faceDescriptor.length === 0) {
        toast.error("Face ID not registered. Please register it from your profile first.");
        setVerifyingFace(false);
        return;
      }

      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error("No face detected. Please reposition yourself.");
        setVerifyingFace(false);
        return;
      }

      // Match face
      const distance = faceapi.euclideanDistance(detection.descriptor, new Float32Array(user.faceDescriptor));
      if (distance > 0.6) { // Threshold for face-api.js recognition
        toast.error("Face identity mismatch. Please try again.");
        setVerifyingFace(false);
        return;
      }

      toast.success("Face Verified!");
      setShowFaceModal(false);
      stopVideo();
      
      if (faceOp === 'checkin') await proceedWithCheckIn();
      else if (faceOp === 'checkout') setShowReportModal(true);
    } catch (err) {
      toast.error("Face verification failed");
    } finally {
      setVerifyingFace(false);
    }
  };

  // ── Live timer ──
  useEffect(() => {
    refreshProfile();
    if (!todayRecord?.inTime || todayRecord?.outTime) return;
    const inTime = new Date(todayRecord.inTime);
    const dayOfWeek = inTime.getDay();
    const shiftMs = (dayOfWeek === 6 ? 7 : 8.5) * 3600 * 1000;

    const tick = () => {
      const workedMs = Date.now() - inTime.getTime();
      const rem = shiftMs - workedMs;
      if (rem < 0) {
        setIsOvertime(true);
        setRemainingMs(Math.abs(rem));
      } else {
        setIsOvertime(false);
        setRemainingMs(rem);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [todayRecord]);

  // ── Geo location ──
  const fetchGeo = useCallback((office) => {
    if (!office) return;
    if (!navigator.geolocation) {
      setGeoStatus('error');
      return;
    }
    setGeoStatus('checking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ latitude, longitude });
        const R = 6371000;
        const toRad = (v) => (v * Math.PI) / 180;
        const dLat = toRad(latitude - office.lat);
        const dLng = toRad(longitude - office.lng);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(office.lat)) * Math.cos(toRad(latitude)) * Math.sin(dLng / 2) ** 2;
        const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        setGeoDistance(dist);
        setGeoStatus(dist <= office.radius ? 'valid' : 'invalid');
      },
      () => setGeoStatus('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // ── Fetch today status ──
  const fetchToday = useCallback(async () => {
    try {
      const { data } = await api.get('/attendance/today');
      setTodayRecord(data.data.record);
      if (data.data.office) {
        setOfficeSettings(data.data.office);
        fetchGeo(data.data.office);
      }
    } catch (_) {}
    setLoading(false);
  }, [fetchGeo]);

  // ── Fetch management employees ──
  const fetchManagement = useCallback(async () => {
    try {
      const { data } = await api.get('/employees/management');
      setManagementEmployees(data.data);
    } catch (err) {
      console.error('Failed to fetch management employees', err);
    }
  }, []);

  useEffect(() => { 
    fetchToday(); 
    fetchManagement();
  }, [fetchToday, fetchManagement]);

  const handleCheckIn = async () => {
    if (!coords) { toast.error('Location not available'); return; }
    if (geoStatus === 'invalid') { toast.error(`Secure Zone Violation: You are ${geoDistance}m away.`); return; }
    
    if (!user.faceDescriptor || user.faceDescriptor.length === 0) {
      toast.error("Please register your Face ID from Profile first!");
      return;
    }

    if (!modelsLoaded) await loadModels();
    setFaceOp('checkin');
    setShowFaceModal(true);
    setTimeout(startVideo, 100);
  };

  const proceedWithCheckIn = async () => {
    setActionLoading(true);
    try {
      await api.post('/attendance/check-in', { latitude: coords.latitude, longitude: coords.longitude });
      toast.success('Check-in Securely Verified!');
      fetchToday();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-in failed');
    } finally { setActionLoading(false); }
  };

  const handleCheckOutSubmit = async () => {
    if (!reportData.todayWork.trim()) { toast.error('Please describe today\'s work'); return; }
    
    setActionLoading(true);
    try {
      const { data } = await api.post('/attendance/check-out', { 
        latitude: coords.latitude, 
        longitude: coords.longitude,
        ...reportData
      });
      const { overtimeMinutes, shortfallMinutes } = data.data;
      if (overtimeMinutes > 0) toast.success(`Checked out! Overtime: ${overtimeMinutes} min`);
      else if (shortfallMinutes > 0) toast(`Checked out ${shortfallMinutes} min early`, { icon: '⚠️' });
      else toast.success('Check-out completed successfully!');
      
      setShowReportModal(false);
      fetchToday();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-out failed');
    } finally { setActionLoading(false); }
  };

  const toggleParticipant = (id) => {
    setReportData(prev => ({
      ...prev,
      reportParticipants: prev.reportParticipants.includes(id) 
        ? prev.reportParticipants.filter(p => p !== id)
        : [...prev.reportParticipants, id]
    }));
  };

  const isCheckedIn = !!todayRecord?.inTime;
  const isCheckedOut = !!todayRecord?.outTime;

  const formatTimeStr = (dateStr) =>
    dateStr ? new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';

  return (
    <AppShell>
      <div className="page-wrapper fade-in" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
        <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--color-text)' }}>Attendance</h1>
            <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '1rem' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <GeoStatus status={geoStatus} distance={geoDistance} />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchGeo(officeSettings)}
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '10px 14px', cursor: 'pointer', color: 'var(--color-text-secondary)', boxShadow: 'var(--shadow-sm)' }}
            >
              <Users size={18} />
            </motion.button>
          </div>
        </header>

        {/* Main Interface */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          
          {/* Dashboard Card */}
          <div style={{
            background: 'linear-gradient(145deg, #0f172a, #1e293b)',
            borderRadius: '32px', padding: '48px',
            color: '#fff', position: 'relative', overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px'
          }}>
            {/* Animated Background Blobs */}
            <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)', filter: 'blur(40px)' }} />
            <div style={{ position: 'absolute', bottom: '-10%', left: '10%', width: '250px', height: '250px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', filter: 'blur(35px)' }} />

            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%' }}>
              {loading ? (
                <Loader2 size={48} className="animate-spin" style={{ color: 'rgba(255,255,255,0.2)' }} />
              ) : (
                <>
                  {isCheckedIn && !isCheckedOut && (
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ marginBottom: '32px' }}>
                      <div style={{ fontSize: '0.85rem', color: isOvertime ? '#F59E0B' : 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 800 }}>
                        {isOvertime ? 'Overtime Tracked' : 'Session Time Remaining'}
                      </div>
                      <div style={{ fontSize: '4.5rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-3px', lineHeight: 1, color: isOvertime ? '#FCD34D' : '#fff' }}>
                        {isOvertime && '+'}{formatDuration(remainingMs)}
                      </div>
                    </motion.div>
                  )}

                  {!isCheckedIn && !isCheckedOut && (
                    <div style={{ marginBottom: '40px' }}>
                      <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <Clock size={40} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      </div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Ready to Start?</h2>
                      <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '280px', margin: '0 auto' }}>Please ensure you are within the office safe zone to check-in.</p>
                    </div>
                  )}

                  {isCheckedOut && (
                    <div style={{ marginBottom: '40px' }}>
                      <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <CheckCircle size={40} style={{ color: '#10B981' }} />
                      </div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Day Completed!</h2>
                      <p style={{ color: 'rgba(255,255,255,0.5)' }}>Your attendance has been securely logged.</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                    {!isCheckedIn && (
                      <motion.button
                        whileHover={{ scale: 1.02, translateY: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCheckIn}
                        disabled={actionLoading || geoStatus !== 'valid'}
                        style={{
                          padding: '20px 50px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                          background: geoStatus === 'valid' ? 'var(--gradient-success)' : 'rgba(255,255,255,0.05)',
                          color: '#fff', fontSize: '1.2rem', fontWeight: 800,
                          display: 'inline-flex', alignItems: 'center', gap: '12px',
                          boxShadow: geoStatus === 'valid' ? '0 15px 30px rgba(16,185,129,0.3)' : 'none',
                          transition: 'all 0.3s', opacity: (actionLoading || geoStatus !== 'valid') ? 0.5 : 1,
                        }}
                      >
                        {actionLoading ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle size={24} />}
                        Secure Check In
                      </motion.button>
                    )}

                    {isCheckedIn && !isCheckedOut && (
                      <motion.button
                        whileHover={{ scale: 1.02, translateY: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          if (!coords) { toast.error('Location not available'); return; }
                          if (geoStatus === 'invalid') { toast.error(`Secure Zone Violation: You are ${geoDistance}m away.`); return; }
                          if (!user.faceDescriptor || user.faceDescriptor.length === 0) {
                            toast.error("Face ID not registered!");
                            return;
                          }
                          if (!modelsLoaded) await loadModels();
                          setFaceOp('checkout');
                          setShowFaceModal(true);
                          setTimeout(startVideo, 100);
                        }}
                        disabled={actionLoading || geoStatus !== 'valid'}
                        style={{
                          padding: '20px 50px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                          background: geoStatus === 'valid' ? 'linear-gradient(135deg, #EF4444, #B91C1C)' : 'rgba(255,255,255,0.05)',
                          color: '#fff', fontSize: '1.2rem', fontWeight: 800,
                          display: 'inline-flex', alignItems: 'center', gap: '12px',
                          boxShadow: geoStatus === 'valid' ? '0 15px 30px rgba(239,68,68,0.3)' : 'none',
                          transition: 'all 0.3s', opacity: (actionLoading || geoStatus !== 'valid') ? 0.5 : 1,
                        }}
                      >
                        {actionLoading ? <Loader2 size={24} className="animate-spin" /> : <LogOut size={24} />}
                        Check Out
                      </motion.button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Side Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ padding: '24px', borderRadius: '24px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '0.05em' }}>Time Metrics</h3>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Check In</span>
                  <span style={{ fontWeight: 700, color: '#10B981' }}>{formatTimeStr(todayRecord?.inTime)}</span>
                </div>
                <div style={{ height: '1px', background: 'var(--color-border)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Check Out</span>
                  <span style={{ fontWeight: 700, color: isCheckedOut ? '#3B82F6' : 'var(--color-text-tertiary)' }}>{formatTimeStr(todayRecord?.outTime)}</span>
                </div>
                {todayRecord?.totalHours && (
                  <>
                    <div style={{ height: '1px', background: 'var(--color-border)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Total Hours</span>
                      <span style={{ fontWeight: 800, color: 'var(--color-accent)' }}>{todayRecord.totalHours.toFixed(1)}h</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <a href="/attendance/summary" style={{ textDecoration: 'none' }}>
              <motion.div whileHover={{ y: -4 }} className="card" style={{ padding: '20px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'var(--color-surface-alt)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>Attendance History</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>View logs & reports</div>
                  </div>
                </div>
                <ChevronDown size={18} style={{ transform: 'rotate(-90deg)', color: 'var(--color-text-tertiary)' }} />
              </motion.div>
            </a>
          </div>
        </div>

        {/* Checkout Report Modal */}
        <AnimatePresence>
          {showReportModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowReportModal(false)}
                style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)' }} 
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                style={{ position: 'relative', background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.5)' }}
              >
                <div style={{ padding: '32px', maxHeight: '100%', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.02em' }}>Check-out Report</h2>
                      <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Complete your daily update before leaving</p>
                    </div>
                    <button onClick={() => setShowReportModal(false)} style={{ background: 'var(--color-surface-alt)', border: 'none', borderRadius: '12px', padding: '8px', cursor: 'pointer' }}>
                      <X size={20} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gap: '20px' }}>
                    <div>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle size={14} /> Today's Work Finished
                      </label>
                      <textarea 
                        className="input-field" 
                        placeholder="What specific tasks did you complete today?" 
                        rows={3} 
                        value={reportData.todayWork}
                        onChange={(e) => setReportData({...reportData, todayWork: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={14} /> Pending Work
                      </label>
                      <textarea 
                        className="input-field" 
                        placeholder="Any tasks to be carried over to tomorrow?" 
                        rows={2} 
                        value={reportData.pendingWork}
                        onChange={(e) => setReportData({...reportData, pendingWork: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={14} /> Issues Faced
                      </label>
                      <textarea 
                        className="input-field" 
                        placeholder="Blockers or challenges you encountered..." 
                        rows={2} 
                        value={reportData.issuesFaced}
                        onChange={(e) => setReportData({...reportData, issuesFaced: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={14} /> Share Report With
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '16px', border: '1px solid var(--color-border)', borderRadius: '16px', background: 'var(--color-surface-alt)' }}>
                        {managementEmployees.map(emp => (
                          <div 
                            key={emp._id}
                            onClick={() => toggleParticipant(emp._id)}
                            style={{
                              padding: '6px 12px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
                              background: reportData.reportParticipants.includes(emp._id) ? 'var(--color-accent)' : '#fff',
                              color: reportData.reportParticipants.includes(emp._id) ? '#fff' : 'var(--color-text-secondary)',
                              border: `1px solid ${reportData.reportParticipants.includes(emp._id) ? 'var(--color-accent)' : 'var(--color-border)'}`
                            }}
                          >
                            <UserCircle size={14} />
                            {emp.name} <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>({emp.role})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
                    <button className="btn-secondary" style={{ flex: 1, borderRadius: '20px', padding: '18px' }} onClick={() => setShowReportModal(false)}>Cancel</button>
                    <button 
                      className="btn-primary" 
                      style={{ flex: 2, borderRadius: '20px', padding: '18px', gap: '12px' }}
                      onClick={handleCheckOutSubmit}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                      Submit & Check Out
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Face Verification Modal */}
        <AnimatePresence>
          {showFaceModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => { setShowFaceModal(false); stopVideo(); }}
                style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)' }} 
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                style={{ position: 'relative', background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '450px', padding: '40px', textAlign: 'center', boxShadow: '0 40px 100px rgba(0,0,0,0.5)' }}
              >
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(32, 118, 199, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2076C7', margin: '0 auto 20px' }}>
                    <Camera size={32} />
                  </div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '8px' }}>Security Verification</h2>
                  <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Validating Identity for {faceOp === 'checkin' ? 'Check In' : 'Check Out'}</p>
                </div>

                <div style={{ position: 'relative', width: '280px', height: '280px', margin: '0 auto 32px', borderRadius: '50%', overflow: 'hidden', border: '6px solid var(--color-surface-alt)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                  <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                  {/* Subtle Scan Effect */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(rgba(32, 118, 199, 0), rgba(32, 118, 199, 0.2), rgba(32, 118, 199, 0))', animation: 'scan 2s ease-in-out infinite' }} />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn-secondary" style={{ flex: 1, borderRadius: '18px', padding: '16px' }} onClick={() => { setShowFaceModal(false); stopVideo(); }}>Cancel</button>
                  <button 
                    className="btn-primary" 
                    style={{ flex: 2, borderRadius: '18px', padding: '16px' }} 
                    onClick={handleVerifyFaceAndProceed} 
                    disabled={verifyingFace}
                  >
                    {verifyingFace ? <Loader2 size={24} className="animate-spin" /> : 'Verify Identity'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <style>{`
          @keyframes scan {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100%); }
          }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .animate-spin { animation: spin 1s linear infinite; }
          @media (max-width: 768px) {
            div[style*="grid-template-columns: 1fr 340px"] {
              grid-template-columns: 1fr !important;
            }
            .page-wrapper {
              padding: 16px !important;
            }
            header h1 {
              fontSize: 1.8rem !important;
            }
          }
        `}</style>
      </div>
    </AppShell>
  );
};

export default AttendancePage;
