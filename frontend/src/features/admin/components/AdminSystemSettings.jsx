import React, { useState } from 'react';
import Input from '../../../shared/components/ui/Input';
import Button from '../../../shared/components/ui/Button';

export default function AdminSystemSettings({ setToastMsg }) {
  const [smtp, setSmtp]       = useState({ host: 'smtp.gmail.com', port: '587', user: '' });
  const [livekit, setLivekit] = useState({ key: '', secret: '' });
  const [razorpay, setRazorpay] = useState({ keyId: '', secret: '' });

  const save = (label) => setToastMsg({ message: `${label} settings saved!`, type: 'success' });

  return (
    <div className="max-w-2xl space-y-6">

      <div>
        <h3 className="text-base font-extrabold text-white">System Settings</h3>
        <p className="text-white/40 text-xs mt-1">
          Configure SMTP email, LiveKit WebRTC, and Razorpay payment integrations.
        </p>
      </div>

      {/* SMTP */}
      <section className="bg-[#08080c] border border-white/5 rounded-2xl p-6 space-y-4">
        <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
          <span className="w-5 h-5 bg-purple-500/10 border border-purple-500/20 rounded flex items-center justify-center text-sm">📧</span>
          SMTP / Email
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="SMTP Host"
            value={smtp.host}
            onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
            placeholder="smtp.gmail.com"
          />
          <Input
            label="SMTP Port"
            value={smtp.port}
            onChange={(e) => setSmtp({ ...smtp, port: e.target.value })}
            placeholder="587"
          />
          <div className="col-span-2">
            <Input
              label="SMTP User / From Address"
              value={smtp.user}
              onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
              placeholder="you@gmail.com"
            />
          </div>
        </div>
        <Button variant="neon" className="text-xs py-2 px-6" onClick={() => save('SMTP')}>
          Save SMTP
        </Button>
      </section>

      {/* LiveKit */}
      <section className="bg-[#08080c] border border-white/5 rounded-2xl p-6 space-y-4">
        <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
          <span className="w-5 h-5 bg-cyan-500/10 border border-cyan-500/20 rounded flex items-center justify-center text-sm">📹</span>
          LiveKit WebRTC
        </h4>
        <p className="text-[11px] text-white/35">
          Get your keys from{' '}
          <a href="https://cloud.livekit.io" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
            cloud.livekit.io
          </a>
          . Set these in <code className="bg-white/5 px-1 rounded text-[10px]">backend/.env</code> as well.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="LiveKit API Key"
            value={livekit.key}
            onChange={(e) => setLivekit({ ...livekit, key: e.target.value })}
            placeholder="API Key"
          />
          <Input
            label="LiveKit Secret"
            type="password"
            value={livekit.secret}
            onChange={(e) => setLivekit({ ...livekit, secret: e.target.value })}
            placeholder="Secret Key"
          />
        </div>
        <Button variant="neon" className="text-xs py-2 px-6" onClick={() => save('LiveKit')}>
          Save LiveKit Config
        </Button>
      </section>

      {/* Razorpay */}
      <section className="bg-[#08080c] border border-white/5 rounded-2xl p-6 space-y-4">
        <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-widest flex items-center gap-2">
          <span className="w-5 h-5 bg-yellow-500/10 border border-yellow-500/20 rounded flex items-center justify-center text-sm">💳</span>
          Razorpay Payments
        </h4>
        <p className="text-[11px] text-white/35">
          Get your keys from the{' '}
          <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noreferrer" className="text-yellow-400 hover:underline">
            Razorpay Dashboard
          </a>
          . Set these in <code className="bg-white/5 px-1 rounded text-[10px]">backend/.env</code>.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Razorpay Key ID"
            value={razorpay.keyId}
            onChange={(e) => setRazorpay({ ...razorpay, keyId: e.target.value })}
            placeholder="rzp_test_..."
          />
          <Input
            label="Razorpay Secret"
            type="password"
            value={razorpay.secret}
            onChange={(e) => setRazorpay({ ...razorpay, secret: e.target.value })}
            placeholder="Secret Key"
          />
        </div>
        <Button variant="neon" className="text-xs py-2 px-6" onClick={() => save('Razorpay')}>
          Save Razorpay Config
        </Button>
      </section>
    </div>
  );
}
