import React, { useState } from 'react';
import Loader from '../../../shared/components/ui/Loader';
import { workoutApi } from '../../../shared/services/workoutApi';

export default function AdminUserManagement({ users, loading, onApprove, onReject, onReApprove, onSetLevel, onCall, onPDF, compilingPdfId }) {
  const [activeTab, setActiveTab]   = useState('all');
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');

  // Task assignment local modal state
  const [selectedTaskUser, setSelectedTaskUser] = useState(null);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueDate: '' });
  const [assigningTask, setAssigningTask] = useState(false);

  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title) return;
    setAssigningTask(true);
    try {
      await workoutApi.assignTask({
        user_id: selectedTaskUser.id,
        title: taskForm.title,
        description: taskForm.description,
        due_date: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null
      });
      alert(`Task assigned to ${selectedTaskUser.name}!`);
      setTaskForm({ title: '', description: '', dueDate: '' });
      setSelectedTaskUser(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign task');
    } finally {
      setAssigningTask(false);
    }
  };

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole   = roleFilter === 'All Roles' || u.role === roleFilter;
    const matchTab    =
      activeTab === 'all' ||
      (activeTab === 'pending'  && u.status === 'Pending') ||
      (activeTab === 'approved' && u.status === 'Active') ||
      (activeTab === 'rejected' && u.status === 'Rejected');
    return matchSearch && matchRole && matchTab;
  });

  return (
    <div className="bg-[#08080c] border border-white/5 rounded-2xl p-6 space-y-4">

      {/* Controls bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">User Approvals</h3>

          {/* Tabs */}
          <div className="flex bg-white/5 border border-white/5 p-0.5 rounded-lg text-[10px]">
            {['all', 'pending', 'approved', 'rejected'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === tab ? 'bg-[#1c1c24] text-white' : 'text-white/45'
                }`}
              >
                {tab === 'approved' ? 'Active' : tab === 'rejected' ? 'Rejected' : tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-56 text-[11px] px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-white placeholder-white/30 focus:outline-none focus:border-[#39ff14]/30"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-[11px] px-3.5 py-2.5 rounded-xl bg-[#08080c] border border-white/5 text-white/70 focus:outline-none cursor-pointer"
          >
            <option>All Roles</option>
            <option>User</option>
            <option>Admin</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 flex justify-center"><Loader size="md" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-white/30 text-xs">No records matched your filters.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-white/40 uppercase tracking-widest text-[9px] border-b border-white/5">
                <th className="pb-3 pt-1">User</th>
                <th className="pb-3 pt-1">Email</th>
                <th className="pb-3 pt-1">Role</th>
                <th className="pb-3 pt-1">Status</th>
                <th className="pb-3 pt-1">Joined</th>
                <th className="pb-3 pt-1 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.01] transition-all">
                  {/* Avatar + Name */}
                  <td className="py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#1c1c24] border border-white/10 flex items-center justify-center font-bold text-white/70">
                        {u.name[0]}
                      </div>
                      <span className="font-bold text-white">{u.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 text-white/50">{u.email}</td>

                  {/* Role badge */}
                  <td className="py-3.5">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                      u.role === 'Admin'
                        ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                        : 'bg-white/5 border border-white/10 text-white/55'
                    }`}>
                      {u.role}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-3.5">
                    <span className="flex items-center gap-1.5 font-bold">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        u.status === 'Active'  ? 'bg-[#39ff14]' :
                        u.status === 'Pending' ? 'bg-amber-400'  : 'bg-red-500'
                      }`} />
                      <span className={
                        u.status === 'Active'  ? 'text-[#39ff14]' :
                        u.status === 'Pending' ? 'text-amber-400'  : 'text-red-400'
                      }>
                        {u.status}
                      </span>
                    </span>
                  </td>

                  <td className="py-3.5 text-white/40">{u.joined}</td>

                  {/* Actions */}
                  <td className="py-3.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      {u.status === 'Pending' ? (
                        <>
                          <button
                            onClick={() => onApprove(u.id, u.name)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#39ff14]/10 hover:bg-[#39ff14]/20 border border-[#39ff14]/20 text-[#39ff14] text-[10px] font-bold cursor-pointer transition-all"
                          >✓ Approve</button>
                          <button
                            onClick={() => onReject(u.id, u.name)}
                            className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-bold cursor-pointer transition-all"
                          >✗ Reject</button>
                        </>
                      ) : u.status === 'Rejected' ? (
                        <button
                          onClick={() => onReApprove(u.id, u.name)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-[10px] font-bold cursor-pointer transition-all"
                        >↩ Re-Approve</button>
                      ) : (
                        <>
                          {u.role === 'User' && (
                            <>
                              {/* Set Level select */}
                              <select
                                value={u.level || 'beginner'}
                                onChange={(e) => onSetLevel(u.id, e.target.value)}
                                className="px-2 py-1.5 rounded-lg bg-[#14141d] border border-white/10 text-white/80 text-[10px] focus:outline-none focus:border-[#39ff14]/30 cursor-pointer"
                              >
                                <option value="beginner">🟢 Beginner</option>
                                <option value="intermediate">🟡 Intermediate</option>
                                <option value="advanced">🔴 Advanced</option>
                              </select>

                              {/* Assign Task button */}
                              <button
                                onClick={() => setSelectedTaskUser(u)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#39ff14]/10 hover:bg-[#39ff14]/20 border border-[#39ff14]/20 text-[#39ff14] text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap"
                              >📋 Task</button>

                              <button
                                onClick={() => onCall(u.id, u.name)}
                                className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 text-[10px] font-bold cursor-pointer transition-all"
                              >📹 Call</button>
                            </>
                          )}
                          <button
                            onClick={() => onPDF(u.id, u.name)}
                            disabled={compilingPdfId === u.id}
                            className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold cursor-pointer transition-all disabled:opacity-50"
                          >
                            {compilingPdfId === u.id ? '...' : '📄 PDF'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign Task Modal */}
      {selectedTaskUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#09090f] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>📋</span> Assign Task to {selectedTaskUser.name}
              </h4>
              <button
                onClick={() => setSelectedTaskUser(null)}
                className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer text-xs"
              >✕</button>
            </div>
            <form onSubmit={handleAssignTask} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Task Title</label>
                <input
                  type="text" required
                  placeholder="e.g. Cardio: 30 min running"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Description</label>
                <textarea
                  placeholder="e.g. Keep heart rate around 130-140 bpm..."
                  rows={3}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/40 resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Due Date (Optional)</label>
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm(p => ({ ...p, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/40"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button" onClick={() => setSelectedTaskUser(null)}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-white/60 text-xs font-bold hover:bg-white/5 transition-all cursor-pointer"
                >Cancel</button>
                <button
                  type="submit" disabled={assigningTask}
                  className="flex-1 py-2 rounded-xl bg-[#39ff14] text-black text-xs font-extrabold hover:bg-[#2ee010] transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(57,255,20,0.15)] uppercase tracking-wider"
                >
                  {assigningTask ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
