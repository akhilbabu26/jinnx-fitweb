import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionApi } from '../../../shared/services/sessionApi';
import { workoutApi } from '../../../shared/services/workoutApi';
import { subscriptionApi } from '../../../shared/services/subscriptionApi';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Toast from '../../../shared/components/ui/Toast';
import Loader from '../../../shared/components/ui/Loader';

export default function ConsultationPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [activeCall, setActiveCall] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [enrolledCourse, setEnrolledCourse] = useState(null);
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
  const [videoAccessEnabled, setVideoAccessEnabled] = useState(false);

  // WebRTC States
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const localVideoRef = useRef(null);
  const streamRef = useRef(null);

  const checkActiveSession = async () => {
    setLoading(true);
    setSubscriptionRequired(false);
    try {
      // 1. Check user enrollment course & video toggles
      try {
        const courseRes = await workoutApi.getEnrolledCourse();
        if (courseRes.data?.success && courseRes.data?.data) {
          setEnrolledCourse(courseRes.data.data);
          setVideoAccessEnabled(courseRes.data.data.video_access_enabled);
        } else {
          setEnrolledCourse(null);
          setVideoAccessEnabled(false);
        }
      } catch (e) {
        console.error('Failed to load user enrollment status:', e);
      }

      // 2. Fetch active session token details
      const res = await sessionApi.joinSession();
      if (res.data?.success && res.data?.data) {
        setSession(res.data.data);
      }
    } catch (err) {
      if (err.response?.status === 403 || err.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
        setSubscriptionRequired(true);
      } else {
        // Expect 400 Bad Request if no active session is initialized by trainer
        console.log('No active trainer session found:', err.response?.data?.message);
        setSession(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      const res = await subscriptionApi.createRazorpaySubscription();
      if (res.data?.success) {
        setToastMsg({ message: 'Subscription request sent successfully!', type: 'success' });
        // Simulating immediate payment confirmation for developer convenience
        setTimeout(() => {
          setToastMsg({ message: 'Simulated payment success! Re-fetching consultation status.', type: 'success' });
          checkActiveSession();
        }, 1500);
      }
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to trigger subscription checkout', type: 'error' });
    }
  };

  useEffect(() => {
    checkActiveSession();
    return () => {
      stopLocalStream();
    };
  }, []);

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      streamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      setToastMsg({ message: 'Webcam/Microphone access denied or not available.', type: 'error' });
      setVideoOff(true);
    }
  };

  const stopLocalStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleStartSandbox = async () => {
    setSandboxMode(true);
    setActiveCall(true);
    // Wait briefly for ref mapping
    setTimeout(() => {
      startLocalStream();
    }, 100);
  };

  const handleJoinRealSession = async () => {
    setActiveCall(true);
    // Since LiveKit host keys are placeholders, fallback to sandbox preview with token logging
    setToastMsg({ message: 'Token retrieved! Simulating LiveKit WebRTC call connection.', type: 'success' });
    setTimeout(() => {
      startLocalStream();
    }, 100);
  };

  const handleEndCall = () => {
    stopLocalStream();
    setActiveCall(false);
    setSandboxMode(false);
    setToastMsg({ message: 'Consultation session ended.', type: 'success' });
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    } else {
      setMicMuted(!micMuted);
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoOff(!videoTrack.enabled);
      }
    } else {
      setVideoOff(!videoOff);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (subscriptionRequired) {
    return (
      <div className="max-w-2xl mx-auto py-12 animate-fade-in-up">
        <Card className="p-12 text-center text-white/30 space-y-6 bg-[#08080c] border-white/5">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-500 mx-auto text-2xl font-bold shadow-lg">
            🔒
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Premium Feature Locked</h4>
            <p className="text-xs text-white/45 max-w-sm mx-auto leading-relaxed">
              LiveKit video consultations with your personal trainer are exclusive to Premium members. Please subscribe to unlock consultations.
            </p>
          </div>
          <Button variant="neon" className="px-8 py-3 mx-auto uppercase font-black" onClick={handleSubscribe}>
            Upgrade to Premium
          </Button>
        </Card>
      </div>
    );
  }

  if (!enrolledCourse) {
    return (
      <div className="max-w-2xl mx-auto py-12 animate-fade-in-up">
        <Card className="p-12 text-center text-white/30 space-y-6 bg-[#08080c] border-white/5">
          <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white/60 mx-auto text-2xl font-bold">
            🏋️
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">No Active Program</h4>
            <p className="text-xs text-white/45 max-w-sm mx-auto leading-relaxed">
              Please enroll in a training program (Hypertrophy, Strength, or Endurance) from your dashboard before initiating video consultations.
            </p>
          </div>
          <Button variant="neon" className="px-8 py-3 mx-auto uppercase font-black" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (!videoAccessEnabled) {
    return (
      <div className="max-w-2xl mx-auto py-12 animate-fade-in-up">
        <Card className="p-12 text-center text-white/30 space-y-6 bg-[#08080c] border-white/5">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full flex items-center justify-center text-2xl font-bold mx-auto shadow-lg animate-pulse">
            🔒
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Consultation Access Locked</h4>
            <p className="text-xs text-white/45 max-w-sm mx-auto leading-relaxed">
              Your personal trainer has not enabled video consultations for your account. Please ask your trainer to enable video access in your profile.
            </p>
          </div>
          <Button variant="transparent" className="px-6 py-3 border border-white/10 text-white/70 hover:bg-white/5 mx-auto" onClick={checkActiveSession}>
            Refresh Access Status
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {toastMsg && (
        <Toast message={toastMsg.message} type={toastMsg.type} onClose={() => setToastMsg(null)} />
      )}

      {!activeCall ? (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="p-8 text-center space-y-6 bg-[#08080c] border-white/5">
            <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full flex items-center justify-center text-3xl mx-auto">
              📞
            </div>

            {session ? (
              <div className="space-y-4">
                <span className="text-[10px] text-[#39ff14] font-bold uppercase tracking-wider bg-[#10170d] border border-[#22441b] px-2.5 py-1 rounded">
                  Trainer Call Active
                </span>
                <h3 className="text-xl font-extrabold text-white">Your Personal Trainer is Waiting</h3>
                <p className="text-xs text-white/50 max-w-sm mx-auto leading-relaxed">
                  Room <span className="font-mono text-purple-400 font-bold">{session.room_name}</span> is open. Join now to begin your video coaching consultation.
                </p>
                <div className="pt-4 flex justify-center gap-4">
                  <Button variant="neon" className="px-8 py-3 font-bold" onClick={handleJoinRealSession}>
                    Connect Video Room
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider bg-white/5 border border-white/10 px-2.5 py-1 rounded">
                  Offline
                </span>
                <h3 className="text-xl font-extrabold text-white">No Scheduled Consultation Call</h3>
                <p className="text-xs text-white/50 max-w-sm mx-auto leading-relaxed">
                  Your trainer has not initialized a video consult channel yet. Keep this page open or test your device compatibility in our diagnostic sandbox.
                </p>
                <div className="pt-4 flex justify-center gap-4">
                  <Button variant="transparent" className="px-6 py-3 border border-white/10 text-white/70 hover:bg-white/5" onClick={checkActiveSession}>
                    Check Status
                  </Button>
                  <Button variant="neon" className="px-6 py-3 font-bold" onClick={handleStartSandbox}>
                    Test Camera Sandbox
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : (
        /* Active Video Call Screen layout */
        <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-white/10 bg-black shadow-2xl">
          
          {/* Main Trainer Stream (Simulated remote stream) */}
          <div className="absolute inset-0 flex items-center justify-center bg-[#07070a]">
            {sandboxMode ? (
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 mx-auto text-xl font-bold animate-pulse">
                  👤
                </div>
                <h4 className="text-sm font-bold text-white">Hardware Sandbox Active</h4>
                <p className="text-[10px] text-white/40">Trainer feed will display here in a live consultation call.</p>
              </div>
            ) : (
              /* Simulated Trainer Video Feed */
              <div className="w-full h-full relative">
                <img 
                  src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=1000&auto=format&fit=crop" 
                  alt="Trainer" 
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute top-4 left-4 bg-black/60 border border-white/10 px-3 py-1.5 rounded-lg text-[10px] text-white font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-ping" />
                  Trainer Coach
                </div>
              </div>
            )}
          </div>

          {/* User Local Stream (WebRTC video player) */}
          <div className="absolute bottom-6 right-6 w-48 aspect-video rounded-2xl overflow-hidden border-2 border-[#39ff14]/30 bg-[#0d0d12] shadow-xl">
            {videoOff ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-white/30 font-bold bg-[#0d0d12]">
                Camera Off
              </div>
            ) : (
              <video 
                ref={localVideoRef}
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover scale-x-[-1]"
              />
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[8px] text-white/80 font-bold">
              You {micMuted && '🔇'}
            </div>
          </div>

          {/* Control Overlay Bar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full flex items-center gap-5 shadow-2xl">
            {/* Mic control */}
            <button 
              onClick={toggleMic}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all cursor-pointer ${
                micMuted ? 'bg-red-500 text-white' : 'bg-white/5 text-white hover:bg-white/15'
              }`}
              title={micMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {micMuted ? '🔇' : '🎙️'}
            </button>

            {/* Video control */}
            <button 
              onClick={toggleVideo}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all cursor-pointer ${
                videoOff ? 'bg-red-500 text-white' : 'bg-white/5 text-white hover:bg-white/15'
              }`}
              title={videoOff ? 'Turn Video On' : 'Turn Video Off'}
            >
              {videoOff ? '🚫' : '📹'}
            </button>

            {/* End Call */}
            <button 
              onClick={handleEndCall}
              className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-sm transition-all cursor-pointer"
              title="End Call"
            >
              🛑
            </button>
          </div>

          {/* Room Name display */}
          <div className="absolute top-4 right-4 bg-black/60 border border-white/10 px-3 py-1.5 rounded-lg text-[9px] text-white/70 font-bold uppercase tracking-wider">
            {sandboxMode ? 'Diagnostic Sandbox' : `Active Room: ${session?.room_name || 'Live'}`}
          </div>

        </div>
      )}
    </div>
  );
}
