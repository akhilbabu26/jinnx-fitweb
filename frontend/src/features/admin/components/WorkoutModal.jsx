import React, { useState } from 'react';
import { workoutApi } from '../../../shared/services/workoutApi';

// ── YouTube ID extractor (mirrors the Go backend logic) ─────────────────────
function extractYouTubeID(input) {
  if (!input) return '';
  try {
    if (input.startsWith('http')) {
      const u = new URL(input);
      // ?v=ID (youtube.com/watch)
      const v = u.searchParams.get('v');
      if (v) return v;
      // Path-based: youtu.be/ID or /embed/ID
      const parts = u.pathname.replace(/^\//, '').split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && last !== 'embed') return last;
      if (parts.length > 1) return parts[parts.length - 1];
      return '';
    }
    // Bare ID (11 chars) or short URL fragment
    return input.trim();
  } catch {
    return '';
  }
}

// ── WorkoutModal ─────────────────────────────────────────────────────────────
export default function WorkoutModal({ mode, workout, courses, defaultCourseId, onClose, onSaved, setToastMsg }) {
  const isEdit = mode === 'edit';

  // Priority: explicit edit workout course > defaultCourseId (Add Day shortcut) > first course in list
  const initialCourseId = workout?.course_id ?? defaultCourseId ?? courses[0]?.id ?? '';

  const [form, setForm] = useState({
    course_id:   initialCourseId,
    day_number:  workout?.day_number  || '',
    level:       workout?.level       || 'beginner',
    name:        workout?.name        || '',
    description: workout?.description || '',
    video_key:   workout?.video_key   || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const videoID       = extractYouTubeID(form.video_key);
  const thumbnailURL  = videoID ? `https://img.youtube.com/vi/${videoID}/hqdefault.jpg` : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        course_id:  parseInt(form.course_id),
        day_number: parseInt(form.day_number),
        // Store the extracted bare video ID so the backend helper can embed it
        video_key:  videoID || form.video_key,
      };
      if (isEdit) {
        await workoutApi.adminUpdateWorkout(workout.id, payload);
        setToastMsg({ message: 'Workout updated!', type: 'success' });
      } else {
        await workoutApi.adminCreateWorkout(payload);
        setToastMsg({ message: 'Workout created!', type: 'success' });
      }
      onSaved();
      onClose();
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to save', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-[#09090f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-[#09090f] flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#39ff14]/10 border border-[#39ff14]/20 flex items-center justify-center text-lg">
              {isEdit ? '✏️' : '➕'}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">
                {isEdit ? 'Edit Workout' : 'Create New Workout'}
              </h3>
              <p className="text-[10px] text-white/35 mt-0.5">
                {isEdit ? `Editing: ${workout.name}` : 'Add a workout day to a course'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer"
          >✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Course */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Course</label>
            <select
              name="course_id"
              value={form.course_id}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/40 cursor-pointer"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Level Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Training Level</label>
            <select
              name="level"
              value={form.level}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/40 cursor-pointer"
            >
              <option value="beginner">🟢 Beginner</option>
              <option value="intermediate">🟡 Intermediate</option>
              <option value="advanced">🔴 Advanced</option>
            </select>
          </div>

          {/* Day + Name */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Day #</label>
              <input
                name="day_number" type="number" min="1"
                value={form.day_number} onChange={handleChange} required
                placeholder="1"
                className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/40"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Workout Name</label>
              <input
                name="name" type="text"
                value={form.name} onChange={handleChange} required minLength={2}
                placeholder="e.g. Upper Body Push Day"
                className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/40"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Description / Exercise Details</label>
            <textarea
              name="description"
              value={form.description} onChange={handleChange} required minLength={5} rows={4}
              placeholder="Describe exercises, sets, reps, rest periods..."
              className="w-full px-4 py-3 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/40 resize-none leading-relaxed"
            />
          </div>

          {/* YouTube URL field */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
              <span className="w-4 h-4 bg-red-600 rounded-sm flex items-center justify-center text-[8px] font-black text-white">▶</span>
              YouTube Video
              <span className="text-white/25 font-normal normal-case">(optional)</span>
            </label>

            <input
              name="video_key" type="text"
              value={form.video_key} onChange={handleChange}
              placeholder="https://youtube.com/watch?v=... or video ID"
              className="w-full px-4 py-2.5 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-red-500/40 font-mono"
            />

            {/* Live thumbnail preview */}
            {thumbnailURL && (
              <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black">
                <img
                  src={thumbnailURL}
                  alt="YouTube thumbnail preview"
                  className="w-full aspect-video object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                {/* Overlay badge */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 bg-red-600/90 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
                <div className="absolute top-2 right-2 bg-black/70 text-white text-[9px] font-mono px-2 py-1 rounded-md border border-white/10">
                  ID: {videoID}
                </div>
              </div>
            )}

            {/* Invalid URL hint */}
            {form.video_key && !thumbnailURL && (
              <p className="text-[10px] text-amber-400/70 flex items-center gap-1">
                ⚠ Paste a full YouTube URL or a valid 11-character video ID
              </p>
            )}

            {!form.video_key && (
              <p className="text-[10px] text-white/25">
                Paste any YouTube URL format — the video ID is extracted automatically.
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-xs font-bold hover:bg-white/5 transition-all cursor-pointer"
            >Cancel</button>
            <button
              type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#39ff14] text-black text-xs font-extrabold hover:bg-[#2ee010] active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_20px_rgba(57,255,20,0.2)] uppercase tracking-wider"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Workout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
