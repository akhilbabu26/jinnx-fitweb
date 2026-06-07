import React from 'react';
import Button from '../../../shared/components/ui/Button';

export default function AdminConsultations({ users, onCall }) {
  const allUsers = users.filter((u) => u.role === 'User');

  return (
    <div className="bg-[#08080c] border border-white/5 rounded-2xl p-6 space-y-6">

      {/* Header */}
      <div>
        <h3 className="text-base font-extrabold text-white">Live Consultation Channels</h3>
        <p className="text-white/40 text-xs mt-1">
          Initialize a LiveKit video room for an active client. They will see a
          <span className="text-white/60 font-semibold"> "Trainer is Waiting" </span>
          status on their consultation page.
        </p>
      </div>

      {/* Table */}
      {allUsers.length === 0 ? (
        <div className="py-10 text-center text-white/30 text-xs">No users found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-white/40 uppercase tracking-widest text-[9px] border-b border-white/5">
                <th className="pb-3">Client</th>
                <th className="pb-3">Email</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {allUsers.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.01] transition-all">

                  {/* Avatar + Name */}
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#1c1c24] border border-white/10 flex items-center justify-center font-bold text-white/70">
                        {u.name[0]}
                      </div>
                      <span className="font-bold text-white">{u.name}</span>
                    </div>
                  </td>

                  <td className="py-4 text-white/50">{u.email}</td>

                  {/* Status */}
                  <td className="py-4">
                    <span className={`flex items-center gap-1.5 font-bold ${
                      u.status === 'Active'  ? 'text-[#39ff14]' :
                      u.status === 'Pending' ? 'text-amber-400'  : 'text-red-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        u.status === 'Active'  ? 'bg-[#39ff14]' :
                        u.status === 'Pending' ? 'bg-amber-400'  : 'bg-red-500'
                      }`} />
                      {u.status}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="py-4 text-right">
                    {u.status === 'Active' ? (
                      <Button
                        variant="neon"
                        className="text-[10px] px-4 py-1.5"
                        onClick={() => onCall(u.id, u.name)}
                      >
                        📹 Start Video Room
                      </Button>
                    ) : (
                      <span className="text-white/30 text-xs font-semibold">Approval Required</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
