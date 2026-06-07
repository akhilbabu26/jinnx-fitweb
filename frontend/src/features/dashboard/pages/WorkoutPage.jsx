import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { workoutApi } from '../../../shared/services/workoutApi';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Toast from '../../../shared/components/ui/Toast';
import Loader from '../../../shared/components/ui/Loader';

export default function WorkoutPage() {
  const navigate = useNavigate();
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [apiError, setApiError] = useState(null);

  // Wizard steps: 'intro' | 'active' | 'outro'
  const [step, setStep] = useState('intro');
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [loggedExercises, setLoggedExercises] = useState([]);

  // Logging Form States
  const [setsDone, setSetsDone] = useState(3);
  const [repsDone, setRepsDone] = useState(10);
  const [weightUsed, setWeightUsed] = useState(0);
  const [notes, setNotes] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const wRes = await workoutApi.getTodayWorkout();
      if (wRes.data.success) {
        setWorkout(wRes.data.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Unknown error';
      setApiError(msg);
      console.error('getTodayWorkout error:', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentExercise = workout?.exercises?.[currentExerciseIndex];

  // Sync default form inputs when active exercise changes
  useEffect(() => {
    if (currentExercise) {
      setSetsDone(currentExercise.sets || 3);
      const parsedReps = parseInt(currentExercise.reps);
      setRepsDone(isNaN(parsedReps) ? 10 : parsedReps);
      setWeightUsed(currentExercise.weight || 0);
      setNotes('');
    }
  }, [currentExerciseIndex, currentExercise]);

  const handleStartWorkout = () => {
    if (!workout?.exercises || workout.exercises.length === 0) {
      setToastMsg({ message: 'No exercises defined for today\'s workout.', type: 'error' });
      return;
    }
    setStep('active');
    setCurrentExerciseIndex(0);
    setLoggedExercises([]);
  };

  const handleSaveExerciseLog = async (e) => {
    e.preventDefault();
    if (!currentExercise) return;

    setSubmitting(true);
    try {
      const payload = {
        exercise_id: currentExercise.id,
        sets_done: parseInt(setsDone),
        reps_done: parseInt(repsDone),
        weight_used: parseFloat(weightUsed),
        notes: notes,
      };

      const res = await workoutApi.logExercise(payload);
      if (res.data.success) {
        // Add to logged exercises for the summary
        setLoggedExercises((prev) => [
          ...prev,
          {
            ...currentExercise,
            sets_done: payload.sets_done,
            reps_done: payload.reps_done,
            weight_used: payload.weight_used,
          },
        ]);

        setToastMsg({ message: `Logged ${currentExercise.name}!`, type: 'success' });

        // Advance to next exercise or outro
        if (currentExerciseIndex < workout.exercises.length - 1) {
          setCurrentExerciseIndex((prev) => prev + 1);
        } else {
          setStep('outro');
        }
      }
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to log exercise', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipExercise = () => {
    if (window.confirm(`Skip ${currentExercise?.name}? No log will be saved for this exercise.`)) {
      if (currentExerciseIndex < workout.exercises.length - 1) {
        setCurrentExerciseIndex((prev) => prev + 1);
      } else {
        setStep('outro');
      }
    }
  };

  const handleFinishWorkout = async () => {
    if (!workout) return;

    setSubmitting(true);
    try {
      const res = await workoutApi.completeWorkoutDay(workout.id);
      if (res.data.success) {
        setToastMsg({ message: 'Congratulations! Workout day completed.', type: 'success' });
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to complete workout', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelWorkout = () => {
    if (window.confirm('Are you sure you want to exit? Your logged exercises will be saved, but today\'s progress won\'t be marked as complete.')) {
      navigate('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (apiError || !workout) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="p-12 text-center text-white/30 space-y-6">
          <svg className="w-16 h-16 mx-auto text-red-500/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="space-y-2">
            <h4 className="text-lg font-bold text-white">Could Not Load Workout Session</h4>
            <p className="text-xs text-white/40 leading-relaxed max-w-md mx-auto">
              {apiError || 'Please enroll in a program from your dashboard to view today\'s routine.'}
            </p>
          </div>
          <Button variant="neon" className="px-6 py-2.5 mx-auto" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (workout.is_rest_day) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="p-12 text-center text-white/30 space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center text-amber-400 mx-auto text-4xl shadow-lg animate-pulse">
            💤
          </div>
          <div className="space-y-2">
            <h4 className="text-xl font-bold text-white">{workout.title || 'Rest Day'}</h4>
            <p className="text-xs text-white/45 max-w-md mx-auto leading-relaxed">
              Today is a scheduled Rest Day. You can complete this rest day directly from the dashboard to advance to your next training day.
            </p>
          </div>
          <Button variant="neon" className="px-6 py-2.5 mx-auto" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in-up">
      {toastMsg && (
        <Toast message={toastMsg.message} type={toastMsg.type} onClose={() => setToastMsg(null)} />
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <span className="text-[10px] text-[#39ff14] font-bold uppercase tracking-wider bg-[#10170d] border border-[#22441b] px-2.5 py-1 rounded-md">
            Day {workout.day_number} Routine
          </span>
          <h2 className="text-2xl font-black text-white mt-2 tracking-tight">{workout.title}</h2>
        </div>
        <button
          onClick={handleCancelWorkout}
          className="text-xs text-white/40 hover:text-white transition-all bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl"
        >
          Exit Session
        </button>
      </div>

      {/* STEP 1: INTRO VIEW */}
      {step === 'intro' && (
        <Card className="p-8 space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">Routines & Targets</h3>
            <p className="text-xs text-white/40">Review the target weights, sets, and reps for today before starting.</p>
          </div>

          <div className="divide-y divide-white/5 border-t border-b border-white/5">
            {workout.exercises?.map((ex, index) => (
              <div key={ex.id} className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{ex.name}</h4>
                    {ex.video_url && (
                      <span className="inline-flex items-center text-[9px] font-bold text-cyan-400 bg-cyan-500/5 px-2 py-0.5 rounded mt-1">
                        🎥 Video Demo Available
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-white font-mono">{ex.sets} Sets × {ex.reps} Reps</div>
                  <div className="text-[10px] text-white/40 font-mono mt-0.5">
                    {ex.weight > 0 ? `Target: ${ex.weight} kg` : 'Bodyweight'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4">
            <Button
              variant="neon"
              className="px-8 py-3.5 text-sm font-black uppercase tracking-wider shadow-[0_0_25px_rgba(57,255,20,0.15)]"
              onClick={handleStartWorkout}
            >
              Start Active Session
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: ACTIVE WORKOUT PLAYER */}
      {step === 'active' && currentExercise && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Exercise demonstration */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-wider bg-cyan-500/5 border border-cyan-500/10 px-2 py-0.5 rounded">
                  Exercise {currentExerciseIndex + 1} of {workout.exercises.length}
                </span>
                <span className="text-xs text-white/40">Form Guide</span>
              </div>

              <h3 className="text-xl font-bold text-white">{currentExercise.name}</h3>

              {/* Video URL Embed */}
              {currentExercise.video_url ? (
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-white/5 shadow-2xl">
                  <iframe
                    src={`${currentExercise.video_url}?rel=0&modestbranding=1&color=white`}
                    title={currentExercise.name}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-xl bg-white/[0.01] border border-white/5 flex flex-col items-center justify-center p-6 text-center text-white/20">
                  <svg className="w-12 h-12 mb-3 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs font-semibold text-white/35">No demonstration video loaded</p>
                  <p className="text-[10px] text-white/20 mt-0.5">Rely on form guidance or consult your coach.</p>
                </div>
              )}

              {/* Targets Box */}
              <div className="bg-white/[0.01] border border-white/5 p-4 rounded-xl space-y-2">
                <h4 className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Coach Targets</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-black/40 border border-white/5 p-3 rounded-lg">
                    <div className="text-[10px] text-white/40">Sets</div>
                    <div className="text-base font-bold text-white mt-0.5">{currentExercise.sets}</div>
                  </div>
                  <div className="bg-black/40 border border-white/5 p-3 rounded-lg">
                    <div className="text-[10px] text-white/40">Reps</div>
                    <div className="text-base font-bold text-white mt-0.5">{currentExercise.reps}</div>
                  </div>
                  <div className="bg-black/40 border border-white/5 p-3 rounded-lg">
                    <div className="text-[10px] text-white/40">Weight</div>
                    <div className="text-base font-bold text-[#39ff14] mt-0.5">
                      {currentExercise.weight > 0 ? `${currentExercise.weight} kg` : 'Bodyweight'}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Logging Panel */}
          <div className="lg:col-span-5">
            <Card className="p-6 space-y-5 h-full flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3">
                  Log Completed Lift
                </h3>

                <form onSubmit={handleSaveExerciseLog} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Sets Completed"
                      name="setsDone"
                      type="number"
                      value={setsDone}
                      onChange={(e) => setSetsDone(e.target.value)}
                      required
                      min="1"
                    />
                    <Input
                      label="Reps Completed"
                      name="repsDone"
                      type="number"
                      value={repsDone}
                      onChange={(e) => setRepsDone(e.target.value)}
                      required
                      min="1"
                    />
                  </div>

                  <Input
                    label="Weight Used (kg)"
                    name="weightUsed"
                    type="number"
                    step="0.1"
                    value={weightUsed}
                    onChange={(e) => setWeightUsed(e.target.value)}
                    required
                    min="0"
                  />

                  <div className="flex flex-col space-y-1">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Set Notes (Optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Felt light, form was solid..."
                      className="w-full text-xs p-3 rounded-xl bg-black border border-white/5 text-white placeholder-white/20 focus:outline-none focus:border-[#39ff14]/30 h-20 resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="neon"
                    className="w-full py-3.5 text-xs font-black uppercase tracking-wider mt-4 shadow-[0_0_15px_rgba(57,255,20,0.1)]"
                    isLoading={submitting}
                  >
                    {currentExerciseIndex === workout.exercises.length - 1 ? 'Save & Complete Session' : 'Save & Next Exercise'}
                  </Button>
                </form>
              </div>

              <div className="pt-6 border-t border-white/5 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => {
                    if (currentExerciseIndex > 0) {
                      setCurrentExerciseIndex((prev) => prev - 1);
                    }
                  }}
                  disabled={currentExerciseIndex === 0}
                  className={`text-xs ${currentExerciseIndex === 0 ? 'text-white/10 cursor-not-allowed' : 'text-white/40 hover:text-white'} transition-all`}
                >
                  ← Previous
                </button>

                <button
                  type="button"
                  onClick={handleSkipExercise}
                  className="text-xs text-red-400/60 hover:text-red-400 transition-all font-semibold"
                >
                  Skip Exercise
                </button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* STEP 3: OUTRO VIEW */}
      {step === 'outro' && (
        <Card className="p-8 text-center space-y-8 max-w-2xl mx-auto">
          <div className="space-y-4">
            <div className="w-20 h-20 bg-[#163819]/50 border border-[#22441b] rounded-full flex items-center justify-center text-[#39ff14] mx-auto text-4xl shadow-lg shadow-[#39ff14]/10 animate-bounce">
              🏆
            </div>
            <div className="space-y-1.5">
              <h3 className="text-2xl font-black text-white">Workout Finished!</h3>
              <p className="text-xs text-white/45 max-w-sm mx-auto leading-relaxed">
                You logged {loggedExercises.length} out of {workout.exercises?.length || 0} exercises today. Excellent effort!
              </p>
            </div>
          </div>

          {loggedExercises.length > 0 && (
            <div className="bg-white/[0.01] border border-white/5 rounded-xl p-4 text-left max-w-md mx-auto space-y-3">
              <h4 className="text-[10px] text-white/40 font-bold uppercase tracking-wider border-b border-white/5 pb-2">
                Today's Training Summary
              </h4>
              <div className="divide-y divide-white/5 space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {loggedExercises.map((log, index) => (
                  <div key={log.id} className="pt-2.5 first:pt-0 flex items-center justify-between text-xs">
                    <span className="font-semibold text-white/80 truncate max-w-[200px]">
                      {index + 1}. {log.name}
                    </span>
                    <span className="font-mono text-white/50 text-[11px] shrink-0">
                      {log.sets_done} sets × {log.reps_done} reps @ {log.weight_used} kg
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 max-w-md mx-auto pt-4">
            <Button
              variant="transparent"
              className="w-1/2 py-3 border border-white/10 hover:bg-white/5 text-white/70"
              onClick={() => setStep('active')}
            >
              Resume Session
            </Button>
            <Button
              variant="neon"
              className="w-1/2 py-3 shadow-[0_0_20px_rgba(57,255,20,0.15)]"
              onClick={handleFinishWorkout}
              isLoading={submitting}
            >
              Save & Complete Day
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
