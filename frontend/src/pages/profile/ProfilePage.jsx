import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import * as faceapi from 'face-api.js';
import { useRef } from 'react';
import { 
  User, Mail, Phone, MapPin, Briefcase, Hash, 
  Shield, Camera, Loader2, Save, KeyRound, Droplet
} from 'lucide-react';
import AppShell from '../../components/layout/AppShell';

const ProfilePage = () => {
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Forms
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [registeringFace, setRegisteringFace] = useState(false);
  const [showFaceModal, setShowFaceModal] = useState(false);

  const [form, setForm] = useState({
    mobileNumber: '',
    currentAddress: '',
    permanentAddress: '',
    bloodGroup: '',
    emergencyContactName: '',
    emergencyContactMobile: '',
  });

  const [passForm, setPassForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [avatarPreview, setAvatarPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/auth/me');
      const emp = data.data;
      setProfile(emp);
      setForm({
        mobileNumber: emp.mobileNumber || '',
        currentAddress: emp.currentAddress || '',
        permanentAddress: emp.permanentAddress || '',
        bloodGroup: emp.bloodGroup || '',
        emergencyContactName: emp.emergencyContactName || '',
        emergencyContactMobile: emp.emergencyContactMobile || '',
      });
      setAvatarPreview(emp.profileImageUrl);
    } catch (err) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handlePassChange = (e) => setPassForm({ ...passForm, [e.target.name]: e.target.value });

  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setSelectedFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const saveProfile = async () => {
    if (!form.mobileNumber) {
      toast.error('Mobile Number is required');
      return;
    }

    setSavingProfile(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (selectedFile) fd.append('profileImage', selectedFile);

      const { data } = await api.put('/auth/profile', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      toast.success('Profile updated successfully');
      setProfile({ ...profile, ...data.data }); // Optimistic update
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (passForm.newPassword !== passForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword,
      });
      toast.success('Password changed successfully');
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const videoRef = useRef();
  const [modelsLoaded, setModelsLoaded] = useState(false);

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
      toast.error("Failed to load face recognition models");
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

  const handleRegisterFace = async () => {
    if (!modelsLoaded) await loadModels();
    setShowFaceModal(true);
    setTimeout(startVideo, 100);
  };

  const captureFace = async () => {
    if (!videoRef.current) return;
    setRegisteringFace(true);

    try {
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error("No face detected. Please reposition yourself.");
        setRegisteringFace(false);
        return;
      }

      const descriptor = Array.from(detection.descriptor);
      await api.put('/employees/profile/face-descriptor', { faceDescriptor: descriptor });
      
      toast.success("Face ID registered successfully!");
      setShowFaceModal(false);
      stopVideo();
      await refreshProfile();
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || "Face registration failed");
    } finally {
      setRegisteringFace(false);
    }
  };

  if (loading) return <AppShell><div style={{ padding: '60px', textAlign: 'center' }}><Loader2 size={32} className="spin" style={{ margin: '0 auto', color: 'var(--color-primary)' }} /></div></AppShell>;

  return (
    <AppShell>
      <div className="page-wrapper fade-in" style={{ padding: '24px 40px', maxWidth: '1200px', margin: '0 auto' }}>
        
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>My Profile</h1>
          <p style={{ color: 'var(--color-text-tertiary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>Manage your personal information and security preferences</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 350px) 1fr', gap: '32px', alignItems: 'start' }}>
          
          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Identity Card */}
            <div style={{ background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '32px', textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <div style={{ position: 'relative', width: '130px', height: '130px', margin: '0 auto 24px' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #2076C7, #1CADA3)', padding: '4px' }}>
                  <img 
                    src={avatarPreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name)}&background=2076C7&color=fff&size=150`} 
                    alt="Profile" 
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', background: '#fff' }} 
                  />
                </div>
                <label style={{
                  position: 'absolute', bottom: '4px', right: '4px', width: '36px', height: '36px',
                  background: 'var(--color-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', border: '3px solid var(--color-surface)', color: '#fff',
                  transition: 'transform 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                  <Camera size={16} />
                  <input type="file" hidden accept="image/jpeg, image/png, image/jpg" onChange={handleAvatarSelect} />
                </label>
              </div>
              
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>{profile?.name}</h2>
              <div style={{ display: 'inline-block', padding: '6px 16px', background: 'rgba(32, 118, 199, 0.1)', color: '#2076C7', borderRadius: '99px', fontSize: '0.82rem', fontWeight: 700, marginTop: '12px' }}>
                {profile?.role}
              </div>
              
              <div style={{ marginTop: '28px', paddingTop: '28px', borderTop: '1px solid var(--color-border)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text-secondary)' }}>
                  <Briefcase size={18} color="var(--color-text-tertiary)" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{profile?.department || 'N/A'} - {profile?.position || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text-secondary)' }}>
                  <Mail size={18} color="var(--color-text-tertiary)" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{profile?.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text-secondary)' }}>
                  <Hash size={18} color="var(--color-text-tertiary)" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'monospace', background: 'var(--color-surface-alt)', padding: '2px 8px', borderRadius: '4px' }}>{profile?.employeeCode}</span>
                </div>
              </div>
            </div>

            {/* Security Card */}
            <div style={{ background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '28px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <div style={{ padding: '8px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px' }}>
                  <Shield color="#8B5CF6" size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>Security</h3>
              </div>
              <form onSubmit={savePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Current Password</label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                    <input className="input-field" type="password" style={{ paddingLeft: '44px' }}
                      name="currentPassword" value={passForm.currentPassword} onChange={handlePassChange} required />
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>New Password</label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                    <input className="input-field" type="password" style={{ paddingLeft: '44px' }} minLength={6}
                      name="newPassword" value={passForm.newPassword} onChange={handlePassChange} required />
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Confirm New Password</label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                    <input className="input-field" type="password" style={{ paddingLeft: '44px' }} minLength={6}
                      name="confirmPassword" value={passForm.confirmPassword} onChange={handlePassChange} required />
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={savingPassword} style={{ marginTop: '12px', width: '100%', justifyContent: 'center' }}>
                  {savingPassword ? <Loader2 size={18} className="spin" /> : 'Update Password'}
                </button>
              </form>
            </div>

            {/* Face ID Card */}
            <div style={{ background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '28px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px' }}>
                  <Camera color="#3B82F6" size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>Face ID</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                {profile?.faceDescriptor?.length > 0 
                  ? "Your Face ID is registered. You can use it for secure check-in/out." 
                  : "Register your Face ID to enable secure, touchless attendance verification."}
              </p>
              <button 
                onClick={handleRegisterFace} 
                className={profile?.faceDescriptor?.length > 0 ? "btn-secondary" : "btn-primary"} 
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {profile?.faceDescriptor?.length > 0 ? "Update Face ID" : "Register Face ID"}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '32px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              
              {/* Personal Details Section */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <div style={{ height: '4px', width: '20px', background: 'linear-gradient(135deg, #2076C7, #1CADA3)', borderRadius: '2px' }} />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>Personal Information</h3>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
                <div>
                  <label className="form-label">Mobile Number</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                    <input className="input-field" type="tel" name="mobileNumber" value={form.mobileNumber} onChange={handleProfileChange} style={{ paddingLeft: '44px' }} maxLength={15} />
                  </div>
                </div>

                <div>
                  <label className="form-label">Blood Group</label>
                  <div style={{ position: 'relative' }}>
                    <Droplet size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                    <select className="input-field select-field" name="bloodGroup" value={form.bloodGroup} onChange={handleProfileChange} style={{ paddingLeft: '44px' }}>
                      <option value="">Select...</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Current Address</label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={18} style={{ position: 'absolute', left: '14px', top: '16px', color: 'var(--color-text-tertiary)' }} />
                    <textarea className="input-field" name="currentAddress" value={form.currentAddress} onChange={handleProfileChange} style={{ paddingLeft: '44px', resize: 'vertical', minHeight: '80px' }} />
                  </div>
                </div>
                
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Permanent Address</label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={18} style={{ position: 'absolute', left: '14px', top: '16px', color: 'var(--color-text-tertiary)' }} />
                    <textarea className="input-field" name="permanentAddress" value={form.permanentAddress} onChange={handleProfileChange} style={{ paddingLeft: '44px', resize: 'vertical', minHeight: '80px' }} />
                  </div>
                </div>
              </div>

              {/* Emergency Contact Section */}
              <div style={{ height: '1px', background: 'var(--color-border)', margin: '36px 0 32px' }} />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <div style={{ height: '4px', width: '20px', background: 'linear-gradient(135deg, #EF4444, #F59E0B)', borderRadius: '2px' }} />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>Emergency Contact</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
                <div>
                  <label className="form-label">Contact Person Name</label>
                  <div style={{ position: 'relative' }}>
                    <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                    <input className="input-field" type="text" name="emergencyContactName" value={form.emergencyContactName} onChange={handleProfileChange} style={{ paddingLeft: '44px' }} placeholder="Full Name" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Contact Mobile Number</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                    <input className="input-field" type="tel" name="emergencyContactMobile" value={form.emergencyContactMobile} onChange={handleProfileChange} style={{ paddingLeft: '44px' }} placeholder="Emergency No." maxLength={15} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end', paddingTop: '24px', borderTop: '1px solid var(--color-border)' }}>
                <button onClick={saveProfile} className="btn-primary" disabled={savingProfile} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 32px', fontSize: '1rem', minWidth: '200px' }}>
                  {savingProfile ? <Loader2 size={20} className="spin" /> : <Save size={20} />}
                  Save Profile Updates
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Face ID Registration Modal */}
        {showFaceModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div onClick={() => { setShowFaceModal(false); stopVideo(); }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }} />
            <div style={{ position: 'relative', background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '500px', padding: '40px', textAlign: 'center', boxShadow: '0 40px 100px rgba(0,0,0,0.5)' }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '8px' }}>Face ID Registration</h2>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '32px' }}>Position your face in the center of the frame</p>
              
              <div style={{ position: 'relative', width: '320px', height: '320px', margin: '0 auto 40px', borderRadius: '50%', overflow: 'hidden', border: '8px solid var(--color-surface-alt)', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)' }}>
                <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                <div style={{ position: 'absolute', inset: '40px', border: '2px dashed rgba(255,255,255,0.5)', borderRadius: '50%' }} />
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <button className="btn-secondary" style={{ flex: 1, borderRadius: '16px' }} onClick={() => { setShowFaceModal(false); stopVideo(); }}>Cancel</button>
                <button className="btn-primary" style={{ flex: 2, borderRadius: '16px' }} onClick={captureFace} disabled={registeringFace}>
                  {registeringFace ? <Loader2 size={20} className="spin" /> : "Capture Face Data"}
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    </AppShell>
  );
};

export default ProfilePage;
