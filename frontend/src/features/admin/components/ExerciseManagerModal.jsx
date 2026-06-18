import React, { useState, useEffect } from 'react';
import { workoutApi } from '../../../shared/services/workoutApi';
import Loader from '../../../shared/components/ui/Loader';

// Extract bare YouTube video ID from any URL format
function extractYouTubeID(input) {
  if (!input) return '';
  try {
    if (input.startsWith('http')) {
      const u = new URL(input);
      const v = u.searchParams.get('v');
      if (v) return v;
      const parts = u.pathname.replace(/^\//, '').split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && last !== 'embed') return last;
      return '';
    }
    return input.trim();
  } catch {
    return '';
  }
}

export default function ExerciseManagerModal({ day, onClose, isUserPlan = false, onRefresh, clientEquipment = [] }) {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form states for creating/editing
  const [editingId, setEditingId] = useState(null); // null means create mode
  const [form, setForm] = useState({
    name: '',
    sets: 3,
    reps: '10',
    weight: 0,
    video: '',
    target: '',
    equipment_needed: 'bodyweight',
    order_index: 0,
  });

  const fetchExercises = async () => {
    setLoading(true);
    try {
      const res = await workoutApi.getExercises(day.id);
      if (res.data?.success) {
        setExercises(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch exercises:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isUserPlan) {
      setExercises(day.exercises || []);
    } else {
      fetchExercises();
    }
  }, [day, isUserPlan]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({
      ...p,
      [name]: name === 'sets' || name === 'order_index' ? parseInt(value) || 0 : name === 'weight' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleEditClick = (ex) => {
    setEditingId(ex.id);
    setForm({
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: parseFloat(ex.weight) || 0,
      video: ex.video_url || ex.video || '',
      target: ex.target || '',
      equipment_needed: ex.equipment_needed || 'bodyweight',
      order_index: ex.order_index,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({
      name: '',
      sets: 3,
      reps: '10',
      weight: 0,
      video: '',
      target: '',
      equipment_needed: 'bodyweight',
      order_index: exercises.length,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    try {
      const cleanVideo = extractYouTubeID(form.video);
      
      if (isUserPlan) {
        const exercisePayload = {
          name: form.name,
          sets: parseInt(form.sets),
          reps: String(form.reps),
          weight: String(form.weight),
          video_url: cleanVideo || form.video,
          target: form.target || '',
          equipment_needed: form.equipment_needed || 'bodyweight',
          order_index: parseInt(form.order_index),
        };

        if (editingId) {
          await workoutApi.updateUserExercise(editingId, { exercise: exercisePayload });
        } else {
          await workoutApi.createUserExercise({
            assigned_day_id: day.id,
            exercise: exercisePayload,
          });
        }
        
        handleCancelEdit();
        if (onRefresh) await onRefresh();
      } else {
        const payload = {
          ...form,
          week_day_id: day.id,
          video: cleanVideo || form.video,
        };

        if (editingId) {
          await workoutApi.updateExercise(editingId, payload);
        } else {
          await workoutApi.createExercise(payload);
        }
        handleCancelEdit();
        fetchExercises();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save exercise');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this exercise?')) return;
    try {
      if (isUserPlan) {
        await workoutApi.deleteUserExercise(id);
        if (onRefresh) await onRefresh();
      } else {
        await workoutApi.deleteExercise(id);
        fetchExercises();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete exercise');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-[#09090f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="sticky top-0 bg-[#09090f] flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#39ff14]/10 border border-[#39ff14]/20 flex items-center justify-center text-lg">
              🏋️
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                Manage Exercises: {day.title}
              </h3>
              <p className="text-[10px] text-white/35 mt-0.5">
                Add, edit and order exercises for Day {day.day_number} split.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer text-xs"
          >✕</button>
        </div>

        {/* Content splits into List & Form */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
          
          {/* Exercises list column (left) */}
          <div className="flex-1 space-y-4">
            <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest border-b border-white/5 pb-2">
              Exercise List ({exercises.length})
            </h4>

            {loading ? (
              <div className="py-16 flex justify-center"><Loader size="md" /></div>
            ) : exercises.length === 0 ? (
              <div className="py-16 text-center text-xs text-white/35 bg-black/20 rounded-xl border border-dashed border-white/5">
                No exercises added to this routine yet. Add one on the right panel.
              </div>
            ) : (
              <div className="space-y-3">
                {[...exercises].sort((a, b) => a.order_index - b.order_index).map((ex) => {
                  const vidId = extractYouTubeID(ex.video_url);
                  return (
                    <div
                      key={ex.id}
                      className="flex items-start gap-4 p-3 rounded-xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all group"
                    >
                      <div className="w-6 h-6 rounded bg-white/5 border border-white/5 text-[10px] font-black text-white/50 flex items-center justify-center shrink-0">
                        {ex.order_index}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-bold text-white leading-tight">{ex.name}</h5>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold px-2 py-0.5 rounded">
                            {ex.sets} Sets
                          </span>
                          <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded">
                            {ex.reps} Reps
                          </span>
                          {ex.weight > 0 && (
                            <span className="text-[9px] bg-green-500/10 border border-green-500/20 text-[#39ff14] font-bold px-2 py-0.5 rounded">
                              {ex.weight} kg
                            </span>
                          )}
                        </div>
                      </div>

                      {/* YouTube link preview */}
                      {vidId && (
                        <a
                          href={`https://youtube.com/watch?v=${vidId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 w-16 aspect-video rounded overflow-hidden border border-white/10 hover:border-red-500/30 transition-all"
                        >
                          <img
                            src={`https://img.youtube.com/vi/${vidId}/mqdefault.jpg`}
                            alt="thumbnail"
                            className="w-full h-full object-cover"
                          />
                        </a>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-all shrink-0">
                        <button
                          onClick={() => handleEditClick(ex)}
                          className="w-7 h-7 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg flex items-center justify-center cursor-pointer transition-all text-[11px]"
                          title="Edit"
                        >✏️</button>
                        <button
                          onClick={() => handleDelete(ex.id)}
                          className="w-7 h-7 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center cursor-pointer transition-all text-[11px]"
                          title="Delete"
                        >🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form column (right) */}
          <div className="w-full md:w-[320px] bg-black/20 border border-white/5 rounded-2xl p-5 space-y-4 shrink-0 h-fit">
            <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center justify-between">
              <span>{editingId ? 'Edit Exercise' : 'Add Exercise'}</span>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-[9px] font-black uppercase text-red-400 hover:underline cursor-pointer"
                >Cancel</button>
              )}
            </h4>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              
              {/* Exercise Name */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Exercise Name</label>
                <input
                  name="name" type="text" required
                  placeholder="e.g. Incline Bench Press"
                  value={form.name} onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl bg-black border border-white/5 text-white/80 text-xs focus:outline-none focus:border-[#39ff14]/30"
                />
              </div>

              {/* Targets */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Sets</label>
                  <input
                    name="sets" type="number" min="1" max="10" required
                    value={form.sets} onChange={handleChange}
                    className="w-full px-3 py-2 rounded-xl bg-black border border-white/5 text-white/80 text-xs focus:outline-none focus:border-[#39ff14]/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Reps</label>
                  <input
                    name="reps" type="text" required
                    placeholder="e.g. 10 or 8-12"
                    value={form.reps} onChange={handleChange}
                    className="w-full px-3 py-2 rounded-xl bg-black border border-white/5 text-white/80 text-xs focus:outline-none focus:border-[#39ff14]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Weight (kg)</label>
                  <input
                    name="weight" type="number" step="0.5" min="0"
                    placeholder="e.g. 60"
                    value={form.weight} onChange={handleChange}
                    className="w-full px-3 py-2 rounded-xl bg-black border border-white/5 text-white/80 text-xs focus:outline-none focus:border-[#39ff14]/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Order Index</label>
                  <input
                    name="order_index" type="number" min="0"
                    value={form.order_index} onChange={handleChange}
                    className="w-full px-3 py-2 rounded-xl bg-black border border-white/5 text-white/80 text-xs focus:outline-none focus:border-[#39ff14]/30"
                  />
                </div>
              </div>

              {/* Target & Equipment */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Target Muscle</label>
                  <input
                    name="target" type="text"
                    placeholder="e.g. Chest, Quads"
                    value={form.target} onChange={handleChange}
                    className="w-full px-3 py-2 rounded-xl bg-black border border-white/5 text-white/80 text-xs focus:outline-none focus:border-[#39ff14]/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Equipment Needed</label>
                  <select
                    name="equipment_needed"
                    value={form.equipment_needed} onChange={handleChange}
                    className="w-full px-3 py-2 rounded-xl bg-black border border-white/5 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/30 cursor-pointer"
                  >
                    <option value="bodyweight">Bodyweight</option>
                    <option value="barbell">Barbell</option>
                    <option value="dumbbell">Dumbbell</option>
                    <option value="cables">Cables</option>
                    <option value="kettlebell">Kettlebell</option>
                    <option value="machine">Machine</option>
                    <option value="bench">Bench</option>
                    <option value="resistance band">Resistance Band</option>
                  </select>
                </div>
              </div>

              {/* Equipment Warning badge */}
              {isUserPlan && form.equipment_needed !== 'bodyweight' && !clientEquipment.includes(form.equipment_needed) && (
                <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
                  ⚠️ Warning: Client does not have <strong>{form.equipment_needed}</strong> in their onboarding equipment profile.
                </div>
              )}

              {/* YouTube Link */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest flex items-center justify-between">
                  <span>Demo Video (YouTube)</span>
                  <span className="text-white/20 text-[8px] lowercase font-normal">(optional)</span>
                </label>
                <input
                  name="video" type="text"
                  placeholder="https://youtube.com/watch?v=..."
                  value={form.video} onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl bg-black border border-white/5 text-white/80 text-xs focus:outline-none focus:border-[#39ff14]/30 font-mono text-[10px]"
                />
              </div>

              <button
                type="submit" disabled={saving}
                className="w-full py-2.5 rounded-xl bg-[#39ff14] text-black text-xs font-extrabold uppercase tracking-wider hover:bg-[#2ee010] active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(57,255,20,0.15)]"
              >
                {saving ? 'Saving...' : editingId ? 'Update Exercise' : 'Add Exercise'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
