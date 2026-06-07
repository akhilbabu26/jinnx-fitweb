import React from 'react';

export default function AdminOverview({ users, workouts, courses, onApprove, onReject }) {
  const total    = users.length;
  const active   = users.filter((u) => u.status === 'Active').length;
  const pending  = users.filter((u) => u.status === 'Pending').length;
  const admins   = users.filter((u) => u.role === 'Admin').length;

  const metrics = [
    { label: 'Total Users',       value: total,           icon: '👤', color: 'text-green-400' },
    { label: 'Active Users',      value: active,          icon: '⚡', color: 'text-blue-400' },
    { label: 'Pending Approvals', value: pending,         icon: '📝', color: 'text-amber-400' },
    { label: 'Total Workouts',    value: workouts.length, icon: '💪', color: 'text-pink-400' },
    { label: 'Courses',           value: courses.length,  icon: '🏋️', color: 'text-purple-400' },
  ];

  return (
    <div className="space-y-8">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 xl:grid-cols-6 gap-6">
        <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="bg-[#08080c] border border-white/5 p-4 rounded-xl">
              <div className="flex items-center justify-between text-white/40 text-[10px] font-bold uppercase tracking-wider">
                <span>{m.label}</span>
                <span className={m.color}>{m.icon}</span>
              </div>
              <div className="text-2xl font-extrabold text-white mt-2">{m.value}</div>
            </div>
          ))}
        </div>

        {/* Revenue card */}
        <div className="xl:col-span-1 bg-[#08080c] border border-[#22441b]/50 p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/40 text-[10px] font-bold uppercase tracking-wider">
            <span>Revenue (Est.)</span>
            <span className="text-yellow-400">💰</span>
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">—</div>
          <div className="text-[10px] text-white/30 mt-1.5">Connect Razorpay to see live data</div>
        </div>
      </div>

      {/* Charts + Pending Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Line chart */}
        <div className="lg:col-span-5 bg-[#08080c] border border-white/5 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Users Overview</h3>
            <div className="flex gap-4 text-[10px] font-semibold text-white/50">
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[#39ff14] inline-block" /> Total</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[#00F2FE] inline-block" /> Active</span>
            </div>
          </div>
          <div className="h-44 w-full pt-4">
            <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
              <line x1="0" y1="10" x2="100" y2="10" stroke="white" strokeWidth="0.05" strokeDasharray="1" opacity="0.1" />
              <line x1="0" y1="20" x2="100" y2="20" stroke="white" strokeWidth="0.05" strokeDasharray="1" opacity="0.1" />
              <line x1="0" y1="30" x2="100" y2="30" stroke="white" strokeWidth="0.05" strokeDasharray="1" opacity="0.1" />
              <path d="M 0 30 Q 15 28, 30 25 T 60 18 T 100 12" fill="none" stroke="#39ff14" strokeWidth="0.8" />
              <path d="M 0 35 Q 20 33, 40 30 T 70 24 T 100 21" fill="none" stroke="#00F2FE" strokeWidth="0.8" />
            </svg>
          </div>
        </div>

        {/* Role pie */}
        <div className="lg:col-span-3 bg-[#08080c] border border-white/5 p-6 rounded-2xl flex flex-col justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Users by Role</h3>
          <div className="flex items-center justify-center py-4">
            <div className="w-28 h-28 rounded-full border-[10px] border-[#39ff14] border-t-purple-500 border-r-cyan-500 flex items-center justify-center">
              <div className="text-center">
                <div className="text-lg font-extrabold text-white leading-none">{total}</div>
                <div className="text-[8px] text-white/30 font-bold uppercase tracking-wider mt-1">Total</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
            <div>
              <div className="flex items-center justify-center gap-1 text-white/55 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] inline-block" />Users
              </div>
              <div className="font-bold text-white mt-0.5">{users.filter((u) => u.role === 'User').length}</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-white/55 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />Admins
              </div>
              <div className="font-bold text-white mt-0.5">{admins}</div>
            </div>
          </div>
        </div>

        {/* Pending quick-action list */}
        <div className="lg:col-span-4 bg-[#08080c] border border-white/5 p-6 rounded-2xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
            Pending Approvals
            {pending > 0 && (
              <span className="ml-2 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">{pending}</span>
            )}
          </h3>
          <div className="space-y-3">
            {users.filter((u) => u.status === 'Pending').slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xs text-amber-400 shrink-0 font-bold">
                    {u.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-white/80 font-bold truncate">{u.name}</div>
                    <div className="text-[9px] text-white/35 truncate">{u.email}</div>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => onApprove(u.id, u.name)}
                    className="px-2 py-1 rounded-lg bg-[#39ff14]/10 border border-[#39ff14]/20 text-[#39ff14] text-[9px] font-bold cursor-pointer hover:bg-[#39ff14]/20 transition-all"
                  >✓</button>
                  <button
                    onClick={() => onReject(u.id, u.name)}
                    className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-bold cursor-pointer hover:bg-red-500/20 transition-all"
                  >✗</button>
                </div>
              </div>
            ))}
            {pending === 0 && (
              <div className="text-xs text-white/30 py-6 text-center">No pending approvals 🎉</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
