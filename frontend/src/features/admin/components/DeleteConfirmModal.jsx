import React from 'react';

export default function DeleteConfirmModal({ workout, onClose, onConfirm, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#09090f] border border-red-500/20 rounded-2xl p-6 shadow-2xl space-y-5">

        {/* Icon */}
        <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-2xl mx-auto">
          🗑️
        </div>

        {/* Text */}
        <div className="text-center space-y-1">
          <h3 className="text-sm font-extrabold text-white">Delete Workout?</h3>
          <p className="text-xs text-white/45 leading-relaxed">
            Permanently deleting{' '}
            <span className="text-white font-bold">"{workout.name}"</span>{' '}
            (Day {workout.day_number} · {workout.course_name}).{' '}
            This action cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-xs font-bold hover:bg-white/5 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-extrabold transition-all disabled:opacity-50 cursor-pointer"
          >
            {deleting ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
