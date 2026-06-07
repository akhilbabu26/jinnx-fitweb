import React, { useState, useEffect } from 'react';
import { workoutApi } from '../../../shared/services/workoutApi';
import Button from '../../../shared/components/ui/Button';
import Loader from '../../../shared/components/ui/Loader';
import ExerciseManagerModal from './ExerciseManagerModal';
import BulkProgramBuilderModal from './BulkProgramBuilderModal';

export default function AdminWorkoutManagement({ users, compilingPdfId, onPDF, setToastMsg }) {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState('beginner');
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBulkBuilder, setShowBulkBuilder] = useState(false);

  // Exercise Manager State
  const [activeExerciseDay, setActiveExerciseDay] = useState(null);

  // Week/Day Form overlays
  const [weekModal, setWeekModal] = useState(null); // null | { mode: 'create'|'edit', weekId?, weekNumber, title }
  const [dayModal, setDayModal] = useState(null);   // null | { mode: 'create'|'edit', weekId, dayId?, dayNumber, title, isRestDay }

  // ── Fetch Initial ───────────────────────────────────────────────────────────
  const fetchCourses = async () => {
    try {
      const res = await workoutApi.getAdminCourses();
      if (res.data?.success) {
        const list = res.data.data || [];
        setCourses(list);
        if (list.length > 0 && !selectedCourse) {
          setSelectedCourse(list[0]);
        }
      }
    } catch (err) {
      setToastMsg({ message: 'Failed to load courses', type: 'error' });
    }
  };

  const fetchWeeks = async () => {
    if (!selectedCourse) return;
    setLoading(true);
    try {
      const res = await workoutApi.getWeeks(selectedCourse.id, selectedLevel);
      if (res.data?.success) {
        setWeeks(res.data.data || []);
      }
    } catch (err) {
      setToastMsg({ message: 'Failed to load weeks program', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    fetchWeeks();
  }, [selectedCourse?.id, selectedLevel]);

  // ── Actions: Weeks ──────────────────────────────────────────────────────────

  const handleSaveWeek = async (e) => {
    e.preventDefault();
    if (!weekModal) return;
    try {
      if (weekModal.mode === 'create') {
        await workoutApi.createWeek({
          course_id: selectedCourse.id,
          level: selectedLevel,
          week_number: parseInt(weekModal.weekNumber),
          title: weekModal.title,
        });
        setToastMsg({ message: 'Week created!', type: 'success' });
      } else {
        await workoutApi.updateWeek(weekModal.weekId, {
          title: weekModal.title,
        });
        setToastMsg({ message: 'Week updated!', type: 'success' });
      }
      setWeekModal(null);
      fetchWeeks();
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to save week', type: 'error' });
    }
  };

  const handleDeleteWeek = async (weekId) => {
    if (!window.confirm('Delete this entire week program along with all its days and exercises?')) return;
    try {
      await workoutApi.deleteWeek(weekId);
      setToastMsg({ message: 'Week deleted successfully.', type: 'success' });
      fetchWeeks();
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to delete week', type: 'error' });
    }
  };

  // ── Actions: Days ───────────────────────────────────────────────────────────

  const handleSaveDay = async (e) => {
    e.preventDefault();
    if (!dayModal) return;
    try {
      const payload = {
        week_id: dayModal.weekId,
        day_number: parseInt(dayModal.dayNumber),
        title: dayModal.title,
        is_rest_day: dayModal.isRestDay,
      };

      if (dayModal.mode === 'create') {
        await workoutApi.createWeekDay(payload);
        setToastMsg({ message: 'Routine day split created!', type: 'success' });
      } else {
        await workoutApi.updateWeekDay(dayModal.dayId, {
          title: dayModal.title,
          is_rest_day: dayModal.isRestDay,
        });
        setToastMsg({ message: 'Routine day split updated!', type: 'success' });
      }
      setDayModal(null);
      fetchWeeks();
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to save day', type: 'error' });
    }
  };

  const handleDeleteDay = async (dayId) => {
    if (!window.confirm('Delete this day split and all its exercises?')) return;
    try {
      await workoutApi.deleteWeekDay(dayId);
      setToastMsg({ message: 'Day split deleted successfully.', type: 'success' });
      fetchWeeks();
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to delete day', type: 'error' });
    }
  };

  // ── Render Helpers ──────────────────────────────────────────────────────────

  const courseColors = {
    hypertrophy: { accent: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', dot: 'bg-purple-400' },
    strength:    { accent: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   dot: 'bg-blue-400'   },
    endurance:   { accent: 'text-[#39ff14]',  bg: 'bg-[#163819]/40',  border: 'border-[#163819]/60',  dot: 'bg-[#39ff14]'  },
  };

  const clr = selectedCourse ? (courseColors[selectedCourse.slug] || { accent: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10', dot: 'bg-white/40' }) : {};

  return (
    <div className="space-y-6">
      
      {/* Header Selectors */}
      <div className="bg-[#08080c] border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-white tracking-tight uppercase">Program Routine Planner</h3>
          <p className="text-white/40 text-xs mt-1">Configure weekly training blocks, level splits and daily exercise logs.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Course select */}
          <select
            value={selectedCourse?.id || ''}
            onChange={(e) => {
              const c = courses.find(item => item.id === parseInt(e.target.value));
              if (c) setSelectedCourse(c);
            }}
            className="px-4 py-2 rounded-xl bg-black border border-white/8 text-white/80 text-xs focus:outline-none focus:border-[#39ff14]/30 cursor-pointer"
          >
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Level select */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="px-4 py-2 rounded-xl bg-black border border-white/8 text-white/80 text-xs focus:outline-none focus:border-[#39ff14]/30 cursor-pointer"
          >
            <option value="beginner">🟢 Beginner</option>
            <option value="intermediate">🟡 Intermediate</option>
            <option value="advanced">🔴 Advanced</option>
          </select>

          <Button
            variant="transparent"
            className="text-[10px] px-4 py-2 uppercase font-black border border-white/10 hover:bg-white/5 text-white/80"
            onClick={() => setShowBulkBuilder(true)}
          >
            ⚙️ Bulk Program Builder
          </Button>

          <Button
            variant="neon"
            className="text-[10px] px-4 py-2 uppercase font-black"
            onClick={() => setWeekModal({ mode: 'create', weekNumber: weeks.length + 1, title: '' })}
          >
            + Add Week
          </Button>
        </div>
      </div>

      {/* Routine Grid */}
      {loading ? (
        <div className="py-20 flex justify-center"><Loader size="lg" /></div>
      ) : weeks.length === 0 ? (
        <div className="bg-[#08080c] border border-white/5 rounded-2xl p-16 text-center space-y-4">
          <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-3xl mx-auto">📅</div>
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">No Weeks Programmed Yet</h4>
          <p className="text-xs text-white/35 max-w-sm mx-auto">Create weekly blocks to organize structured routines for this course level.</p>
          <button
            onClick={() => setWeekModal({ mode: 'create', weekNumber: 1, title: '' })}
            className="px-6 py-2.5 rounded-xl bg-[#39ff14] text-black text-xs font-extrabold hover:bg-[#2ee010] transition-all cursor-pointer shadow-[0_0_15px_rgba(57,255,20,0.15)] uppercase tracking-wider"
          >
            Create Week 1
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {weeks.map((week) => (
            <div key={week.id} className="bg-[#08080c] border border-white/5 rounded-2xl overflow-hidden shadow-lg">
              
              {/* Week header */}
              <div className="px-6 py-4.5 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${clr.dot}`} />
                  <div>
                    <span className="text-xs font-black text-white uppercase tracking-widest">
                      Week {week.week_number}
                    </span>
                    <h4 className="text-sm font-bold text-white/80 mt-0.5">{week.title}</h4>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDayModal({ mode: 'create', weekId: week.id, dayNumber: (week.days?.length || 0) + 1, title: '', isRestDay: false })}
                    className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg ${clr.bg} ${clr.border} border ${clr.accent} hover:opacity-80 transition-all cursor-pointer`}
                  >
                    + Add Day Split
                  </button>
                  <button
                    onClick={() => setWeekModal({ mode: 'edit', weekId: week.id, weekNumber: week.week_number, title: week.title })}
                    className="p-1.5 text-white/40 hover:text-white transition-all text-xs cursor-pointer"
                    title="Edit Week"
                  >✏️</button>
                  <button
                    onClick={() => handleDeleteWeek(week.id)}
                    className="p-1.5 text-red-500/50 hover:text-red-400 transition-all text-xs cursor-pointer"
                    title="Delete Week"
                  >🗑️</button>
                </div>
              </div>

              {/* Days List */}
              {!week.days || week.days.length === 0 ? (
                <div className="px-6 py-8 text-center text-xs text-white/20">
                  No routine days configured for this week split.
                </div>
              ) : (
                <div className="divide-y divide-white/[0.03]">
                  {[...week.days].sort((a, b) => a.day_number - b.day_number).map((day) => (
                    <div key={day.id} className="px-6 py-4.5 flex items-center justify-between hover:bg-white/[0.01] transition-all group">
                      
                      {/* Day Split Info */}
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl ${day.is_rest_day ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : clr.bg + ' ' + clr.border + ' ' + clr.accent} border flex items-center justify-center shrink-0`}>
                          <div className="text-center">
                            <div className="text-[8px] font-bold uppercase opacity-80">Day</div>
                            <div className="text-xs font-black leading-none mt-0.5">{day.day_number}</div>
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="text-xs font-bold text-white flex items-center gap-2">
                            {day.title}
                            {day.is_rest_day && (
                              <span className="text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-black uppercase">
                                🛌 Rest
                              </span>
                            )}
                          </h5>
                          <p className="text-[10px] text-white/35 mt-1 font-sans">
                            {day.is_rest_day 
                              ? 'Active recovery or absolute rest' 
                              : `${day.exercises?.length || 0} exercises scheduled`}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2.5">
                        {!day.is_rest_day && (
                          <button
                            onClick={() => setActiveExerciseDay(day)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#39ff14]/10 hover:bg-[#39ff14]/20 border border-[#39ff14]/20 text-[#39ff14] text-[9px] font-black uppercase cursor-pointer transition-all flex items-center gap-1 shadow-lg"
                          >
                            🏋️ Exercises ({day.exercises?.length || 0})
                          </button>
                        )}
                        
                        <div className="flex items-center gap-1.5 opacity-50 group-hover:opacity-100 transition-all shrink-0">
                          <button
                            onClick={() => setDayModal({ mode: 'edit', weekId: week.id, dayId: day.id, dayNumber: day.day_number, title: day.title, isRestDay: day.is_rest_day })}
                            className="w-7 h-7 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg flex items-center justify-center cursor-pointer transition-all text-[11px]"
                            title="Edit Day Split"
                          >✏️</button>
                          <button
                            onClick={() => handleDeleteDay(day.id)}
                            className="w-7 h-7 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center cursor-pointer transition-all text-[11px]"
                            title="Delete Day Split"
                          >🗑️</button>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}

            </div>
          ))}
        </div>
      )}

      {/* PDF section */}
      <div className="bg-[#08080c] border border-white/5 rounded-2xl p-6 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">Client Routine PDF Reports</h4>
          <p className="text-white/40 text-[11px] mt-1">Compile and download a client's exercise history and program progression.</p>
        </div>
        {users.filter((u) => u.status === 'Active' && u.role === 'User').length === 0 ? (
          <div className="text-xs text-white/30 py-4 text-center">No active clients yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-white/40 uppercase tracking-widest text-[9px] border-b border-white/5">
                  <th className="pb-3">Client</th>
                  <th className="pb-3">Email</th>
                  <th className="pb-3 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.filter((u) => u.status === 'Active' && u.role === 'User').map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.01]">
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1c1c24] border border-white/10 flex items-center justify-center font-bold text-[#39ff14]">{u.name[0]}</div>
                        <span className="font-bold text-white">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-white/50">{u.email}</td>
                    <td className="py-3.5 text-right">
                      <Button
                        variant="neon"
                        className="text-[10px] px-4 py-1.5 uppercase font-black"
                        onClick={() => onPDF(u.id, u.name)}
                        isLoading={compilingPdfId === u.id}
                      >
                        📄 Compile PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Week Modal Overlay */}
      {weekModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#09090f] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                {weekModal.mode === 'create' ? 'Create New Week Block' : 'Edit Week Block'}
              </h4>
              <button
                onClick={() => setWeekModal(null)}
                className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer text-xs"
              >✕</button>
            </div>
            <form onSubmit={handleSaveWeek} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Week Number</label>
                <input
                  type="number" min="1" required
                  disabled={weekModal.mode === 'edit'}
                  value={weekModal.weekNumber}
                  onChange={(e) => setWeekModal(p => ({ ...p, weekNumber: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Week Title / Objective</label>
                <input
                  type="text" required
                  placeholder="e.g. Strength Foundations & Base"
                  value={weekModal.title}
                  onChange={(e) => setWeekModal(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/40"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button" onClick={() => setWeekModal(null)}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-white/60 text-xs font-bold hover:bg-white/5 transition-all cursor-pointer"
                >Cancel</button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#39ff14] text-black text-xs font-extrabold hover:bg-[#2ee010] active:scale-95 transition-all cursor-pointer shadow-[0_0_15px_rgba(57,255,20,0.15)] uppercase tracking-wider"
                >
                  Save Week
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Day Modal Overlay */}
      {dayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#09090f] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                {dayModal.mode === 'create' ? 'Add Split Day to Week' : 'Edit Split Day'}
              </h4>
              <button
                onClick={() => setDayModal(null)}
                className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer text-xs"
              >✕</button>
            </div>
            <form onSubmit={handleSaveDay} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Day Number</label>
                  <input
                    type="number" min="1" max="7" required
                    disabled={dayModal.mode === 'edit'}
                    value={dayModal.dayNumber}
                    onChange={(e) => setDayModal(p => ({ ...p, dayNumber: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/40"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Routine Split Name</label>
                  <input
                    type="text" required
                    placeholder="e.g. Legs Hypertrophy or Rest Split"
                    value={dayModal.title}
                    onChange={(e) => setDayModal(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/40"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3.5 bg-black/30 border border-white/5 p-3 rounded-xl">
                <input
                  type="checkbox"
                  id="isRestDay"
                  checked={dayModal.isRestDay}
                  onChange={(e) => setDayModal(p => ({ ...p, isRestDay: e.target.checked }))}
                  className="w-4 h-4 accent-[#39ff14] cursor-pointer"
                />
                <label htmlFor="isRestDay" className="text-xs text-white/80 font-bold cursor-pointer select-none">
                  Is Rest / Recovery Day?
                  <span className="block text-[9px] text-white/35 font-normal normal-case mt-0.5">Checking this disables exercise inputs for this day.</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button" onClick={() => setDayModal(null)}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-white/60 text-xs font-bold hover:bg-white/5 transition-all cursor-pointer"
                >Cancel</button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#39ff14] text-black text-xs font-extrabold hover:bg-[#2ee010] active:scale-95 transition-all cursor-pointer shadow-[0_0_15px_rgba(57,255,20,0.15)] uppercase tracking-wider"
                >
                  Save Day
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exercises Manager Overlay */}
      {activeExerciseDay && (
        <ExerciseManagerModal
          day={activeExerciseDay}
          onClose={() => {
            setActiveExerciseDay(null);
            fetchWeeks();
          }}
        />
      )}

      {/* Bulk Program Builder Modal */}
      {showBulkBuilder && (
        <BulkProgramBuilderModal
          initialCourses={courses}
          onClose={() => setShowBulkBuilder(false)}
          onSuccess={() => {
            fetchWeeks();
          }}
        />
      )}

    </div>
  );
}
