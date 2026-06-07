import React, { useState, useEffect } from 'react';
import { workoutApi } from '../../../shared/services/workoutApi';
import Loader from '../../../shared/components/ui/Loader';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';

// Extract YouTube video ID
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

export default function BulkProgramBuilderModal({ onClose, onSuccess, initialCourses = [] }) {
  const [courses, setCourses] = useState(initialCourses);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Stepper State
  const [step, setStep] = useState(1);

  // Step 1: Meta Configuration
  const [courseId, setCourseId] = useState('');
  const [level, setLevel] = useState('beginner');
  const [numWeeks, setNumWeeks] = useState(4);
  const [daysPerWeek, setDaysPerWeek] = useState(4);

  // Step 2: Day Splits Configuration
  const [dayConfigs, setDayConfigs] = useState([]);

  // Step 3: Exercise builder active day index
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  // Step 3: Exercise Form
  const [exForm, setExForm] = useState({
    name: '',
    sets: 3,
    reps: '10',
    weight: 0,
    video: '',
  });

  // Step 4: Publishing State
  const [publishing, setPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState('');

  // Fetch courses if not provided
  useEffect(() => {
    if (initialCourses.length === 0) {
      const loadCourses = async () => {
        setLoadingCourses(true);
        try {
          const res = await workoutApi.getAdminCourses();
          if (res.data?.success) {
            const list = res.data.data || [];
            setCourses(list);
            if (list.length > 0) setCourseId(list[0].id);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingCourses(false);
        }
      };
      loadCourses();
    } else {
      setCourseId(initialCourses[0].id);
    }
  }, [initialCourses]);

  // Step 1 -> Step 2 transition: Initialize day configs
  const handleProceedToDays = () => {
    if (!courseId) {
      alert('Please select a course.');
      return;
    }
    if (numWeeks < 1 || numWeeks > 12) {
      alert('Please select a week range between 1 and 12.');
      return;
    }
    if (daysPerWeek < 1 || daysPerWeek > 7) {
      alert('Please select training days between 1 and 7.');
      return;
    }

    const configs = [];
    for (let w = 1; w <= numWeeks; w++) {
      for (let d = 1; d <= daysPerWeek; d++) {
        configs.push({
          weekNum: w,
          dayNum: d,
          title: `Week ${w} Day ${d} Split`,
          isRestDay: false,
          exercises: [],
        });
      }
    }
    setDayConfigs(configs);
    setActiveDayIndex(0);
    setStep(2);
  };

  // Step 2 Day configuration actions
  const handleDayTitleChange = (index, value) => {
    setDayConfigs((prev) => {
      const copy = [...prev];
      copy[index].title = value;
      return copy;
    });
  };

  const handleDayRestChange = (index, isChecked) => {
    setDayConfigs((prev) => {
      const copy = [...prev];
      copy[index].isRestDay = isChecked;
      if (isChecked) {
        copy[index].title = `Week ${copy[index].weekNum} Day ${copy[index].dayNum} Rest`;
      } else {
        copy[index].title = `Week ${copy[index].weekNum} Day ${copy[index].dayNum} Split`;
      }
      return copy;
    });
  };

  // Step 3 Exercise Form actions
  const handleExFormChange = (e) => {
    const { name, value } = e.target;
    setExForm((prev) => ({
      ...prev,
      [name]: name === 'sets' ? parseInt(value) || 0 : name === 'weight' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleAddExerciseToDay = (e) => {
    e.preventDefault();
    if (!exForm.name.trim()) return;

    setDayConfigs((prev) => {
      const copy = [...prev];
      copy[activeDayIndex].exercises.push({
        name: exForm.name,
        sets: exForm.sets,
        reps: exForm.reps,
        weight: exForm.weight,
        video: extractYouTubeID(exForm.video) || exForm.video,
      });
      return copy;
    });

    // Reset exercise form
    setExForm({
      name: '',
      sets: 3,
      reps: '10',
      weight: 0,
      video: '',
    });
  };

  const handleRemoveExerciseFromDay = (dayIndex, exIndex) => {
    setDayConfigs((prev) => {
      const copy = [...prev];
      copy[dayIndex].exercises.splice(exIndex, 1);
      return copy;
    });
  };

  // Step 4: Publish sequential execution
  const handlePublishProgram = async () => {
    setPublishing(true);
    setPublishProgress('Checking for duplicate weeks...');

    try {
      // Check existing week numbers
      const existingRes = await workoutApi.getWeeks(courseId, level);
      const existingWeeks = existingRes.data?.data || [];
      const existingWeekNums = existingWeeks.map((w) => w.week_number);

      const duplicates = Array.from({ length: numWeeks }, (_, i) => i + 1).filter((w) =>
        existingWeekNums.includes(w)
      );

      if (duplicates.length > 0) {
        alert(
          `Validation Error: Weeks ${duplicates.join(', ')} already exist for this course level. Please delete them from the program builder first to overwrite.`
        );
        setPublishing(false);
        return;
      }

      const createdWeeksMap = {}; // maps weekNumber -> weekID

      // 1. Create Weeks
      for (let w = 1; w <= numWeeks; w++) {
        setPublishProgress(`Creating Week ${w} of ${numWeeks}...`);
        const weekRes = await workoutApi.createWeek({
          course_id: parseInt(courseId),
          level: level,
          week_number: w,
          title: `Week ${w} - Block`,
        });

        if (weekRes.data?.success && weekRes.data?.data?.id) {
          createdWeeksMap[w] = weekRes.data.data.id;
        } else {
          throw new Error(`Failed to create week block ${w}`);
        }
      }

      // 2. Create Days & Exercises
      for (let idx = 0; idx < dayConfigs.length; idx++) {
        const config = dayConfigs[idx];
        const weekId = createdWeeksMap[config.weekNum];
        setPublishProgress(
          `Creating Week ${config.weekNum} Day ${config.dayNum}: ${config.title}...`
        );

        const dayRes = await workoutApi.createWeekDay({
          week_id: weekId,
          day_number: config.dayNum,
          title: config.title,
          is_rest_day: config.isRestDay,
        });

        if (dayRes.data?.success && dayRes.data?.data?.id) {
          const dayId = dayRes.data.data.id;

          // Add exercises if not a rest day
          if (!config.isRestDay && config.exercises.length > 0) {
            for (let eIdx = 0; eIdx < config.exercises.length; eIdx++) {
              const ex = config.exercises[eIdx];
              setPublishProgress(
                `Saving "${ex.name}" on Week ${config.weekNum} Day ${config.dayNum}...`
              );
              await workoutApi.createExercise({
                week_day_id: dayId,
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight,
                video: ex.video,
                order_index: eIdx + 1,
              });
            }
          }
        } else {
          throw new Error(
            `Failed to save routine day ${config.dayNum} for week ${config.weekNum}`
          );
        }
      }

      setPublishProgress('Program published successfully! Finalizing views...');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      alert(
        err.response?.data?.message ||
          err.message ||
          'Publishing failed. Check server logs.'
      );
    } finally {
      setPublishing(false);
    }
  };

  const activeDayConfig = dayConfigs[activeDayIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl bg-[#09090f] border border-white/10 rounded-3xl shadow-2xl overflow-hidden h-[90vh] flex flex-col">
        
        {/* Header Banner */}
        <div className="sticky top-0 bg-[#09090f] flex items-center justify-between px-8 py-5 border-b border-white/5 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-[#39ff14]/10 border border-[#39ff14]/20 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(57,255,20,0.1)]">
              ⚙️
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white uppercase tracking-wider">
                Bulk Workout Program Builder
              </h3>
              <p className="text-[11px] text-white/35 mt-0.5">
                Generate structured multi-week routines and workouts in a single streamlined flow.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Steps indicator */}
            <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase text-white/50">
              <span className={step === 1 ? 'text-[#39ff14]' : ''}>1. Settings</span>
              <span>•</span>
              <span className={step === 2 ? 'text-[#39ff14]' : ''}>2. Splits</span>
              <span>•</span>
              <span className={step === 3 ? 'text-[#39ff14]' : ''}>3. Workouts</span>
              <span>•</span>
              <span className={step === 4 ? 'text-[#39ff14]' : ''}>4. Review</span>
            </div>
            {!publishing && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer text-xs"
              >✕</button>
            )}
          </div>
        </div>

        {/* STEP 1: SETTINGS */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-8 flex flex-col justify-center items-center max-w-xl mx-auto w-full space-y-6">
            <h4 className="text-lg font-bold text-white uppercase tracking-wider text-center">
              1. Program Configuration
            </h4>

            {loadingCourses ? (
              <Loader size="md" />
            ) : (
              <div className="w-full space-y-4">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Select Target Course</label>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black border border-white/5 text-white/80 text-xs focus:outline-none focus:border-[#39ff14]/30 cursor-pointer"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Training Level</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black border border-white/5 text-white/80 text-xs focus:outline-none focus:border-[#39ff14]/30 cursor-pointer"
                  >
                    <option value="beginner">🟢 Beginner</option>
                    <option value="intermediate">🟡 Intermediate</option>
                    <option value="advanced">🔴 Advanced</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Number of Weeks"
                    name="numWeeks"
                    type="number"
                    min="1"
                    max="12"
                    value={numWeeks}
                    onChange={(e) => setNumWeeks(parseInt(e.target.value) || 0)}
                    required
                  />
                  <Input
                    label="Days Per Week"
                    name="daysPerWeek"
                    type="number"
                    min="1"
                    max="7"
                    value={daysPerWeek}
                    onChange={(e) => setDaysPerWeek(parseInt(e.target.value) || 0)}
                    required
                  />
                </div>

                <Button
                  variant="neon"
                  className="w-full py-3.5 mt-6 font-black uppercase tracking-wider shadow-[0_0_20px_rgba(57,255,20,0.1)]"
                  onClick={handleProceedToDays}
                >
                  Continue to Day Splits
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: DAY SPLITS */}
        {step === 2 && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="text-center max-w-md mx-auto space-y-1">
                <h4 className="text-lg font-bold text-white uppercase tracking-wider">
                  2. Customize Day Splits
                </h4>
                <p className="text-white/40 text-xs leading-relaxed">
                  Name the muscle splits for each day or toggle Rest Days. This builds the program template.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {dayConfigs.map((config, index) => (
                  <div
                    key={index}
                    className={`p-4 bg-white/[0.01] border ${
                      config.isRestDay ? 'border-amber-500/20 bg-amber-500/[0.01]' : 'border-white/5'
                    } rounded-2xl flex flex-col gap-3 transition-all hover:bg-white/[0.02]`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">
                        Week {config.weekNum} • Day {config.dayNum}
                      </span>

                      {/* Rest checkbox */}
                      <label className="flex items-center gap-2 text-[10px] font-bold text-white/50 uppercase cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={config.isRestDay}
                          onChange={(e) => handleDayRestChange(index, e.target.checked)}
                          className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"
                        />
                        Rest Day 💤
                      </label>
                    </div>

                    <input
                      type="text"
                      disabled={config.isRestDay}
                      required
                      placeholder="e.g. Upper Body Push or Leg Day"
                      value={config.title}
                      onChange={(e) => handleDayTitleChange(index, e.target.value)}
                      className="w-full px-3 py-2 bg-black border border-white/5 text-white/80 text-xs rounded-xl focus:outline-none focus:border-[#39ff14]/30 disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Sticky Actions Footer */}
            <div className="p-6 border-t border-white/5 flex gap-4 shrink-0 bg-[#09090f]">
              <Button
                variant="transparent"
                className="w-1/2 py-3 border border-white/10 text-white/60 hover:bg-white/5"
                onClick={() => setStep(1)}
              >
                Back Settings
              </Button>
              <Button
                variant="neon"
                className="w-1/2 py-3 shadow-[0_0_15px_rgba(57,255,20,0.1)]"
                onClick={() => setStep(3)}
              >
                Continue to Workouts
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: EXERCISES BUILDER */}
        {step === 3 && activeDayConfig && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Split Content */}
            <div className="flex-1 flex min-h-0 divide-x divide-white/5">
              
              {/* Left sidebar: Days layout selector */}
              <div className="w-[280px] overflow-y-auto p-6 space-y-3 shrink-0">
                <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest border-b border-white/5 pb-2 px-1">
                  Routine Splits Schedule
                </h4>
                <div className="space-y-1.5">
                  {dayConfigs.map((config, index) => {
                    const isActive = index === activeDayIndex;
                    return (
                      <button
                        key={index}
                        onClick={() => setActiveDayIndex(index)}
                        className={`w-full text-left p-3 rounded-xl border transition-all text-xs flex items-center justify-between gap-2 cursor-pointer ${
                          isActive
                            ? 'bg-[#39ff14]/5 border-[#39ff14]/30 text-white font-bold'
                            : 'bg-transparent border-white/5 text-white/40 hover:border-white/10 hover:text-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[9px] font-mono opacity-60">
                            W{config.weekNum} Day {config.dayNum}
                          </div>
                          <div className="truncate mt-0.5 font-sans">{config.title}</div>
                        </div>

                        {config.isRestDay ? (
                          <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-black">
                            REST
                          </span>
                        ) : (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            config.exercises.length > 0 
                              ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400' 
                              : 'bg-white/5 text-white/20 border border-white/5'
                          }`}>
                            {config.exercises.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right panel: Exercise list & form */}
              <div className="flex-1 flex divide-x divide-white/5 overflow-hidden">
                {/* Exercises list (left scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div className="border-b border-white/5 pb-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400">
                      Active: Week {activeDayConfig.weekNum} Day {activeDayConfig.dayNum}
                    </span>
                    <h4 className="text-sm font-bold text-white mt-1">
                      Exercises for "{activeDayConfig.title}"
                    </h4>
                  </div>

                  {activeDayConfig.isRestDay ? (
                    <div className="py-24 text-center text-xs text-white/20">
                      🛌 Rest & Recovery Split. No exercises required.
                    </div>
                  ) : activeDayConfig.exercises.length === 0 ? (
                    <div className="py-24 text-center text-xs text-white/20 border border-dashed border-white/5 rounded-2xl bg-black/20">
                      No exercises added to this split yet. Use the panel on the right.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {activeDayConfig.exercises.map((ex, exIdx) => (
                        <div
                          key={exIdx}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/5 hover:border-white/10 group transition-all"
                        >
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-white">{ex.name}</h5>
                            <div className="flex gap-2 text-[9px] text-white/40 mt-1 font-mono">
                              <span>{ex.sets} Sets</span>
                              <span>•</span>
                              <span>{ex.reps} Reps</span>
                              {ex.weight > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-[#39ff14]">{ex.weight} kg</span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveExerciseFromDay(activeDayIndex, exIdx)}
                            className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/25 flex items-center justify-center text-red-400 text-xs opacity-50 group-hover:opacity-100 transition-all cursor-pointer"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Form to add (right fixed width) */}
                <div className="w-[300px] overflow-y-auto p-6 space-y-4 shrink-0 bg-black/20">
                  <h4 className="text-xs font-bold text-white/80 uppercase tracking-widest border-b border-white/5 pb-2">
                    Add Workout Exercise
                  </h4>

                  {activeDayConfig.isRestDay ? (
                    <p className="text-[10px] text-white/30 leading-relaxed">
                      Rest Day splits block exercise assignments to ensure the user relaxes. Use the left schedule list to navigate.
                    </p>
                  ) : (
                    <form onSubmit={handleAddExerciseToDay} className="space-y-3.5">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Exercise Name</label>
                        <input
                          name="name"
                          type="text"
                          required
                          placeholder="e.g. Squat or Bench Press"
                          value={exForm.name}
                          onChange={handleExFormChange}
                          className="w-full px-3 py-2 bg-black border border-white/5 text-white/80 text-xs rounded-xl focus:outline-none focus:border-[#39ff14]/30"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Sets</label>
                          <input
                            name="sets"
                            type="number"
                            min="1"
                            max="10"
                            required
                            value={exForm.sets}
                            onChange={handleExFormChange}
                            className="w-full px-3 py-2 bg-black border border-white/5 text-white/80 text-xs rounded-xl focus:outline-none focus:border-[#39ff14]/30"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Reps</label>
                          <input
                            name="reps"
                            type="text"
                            required
                            placeholder="e.g. 10 or 8-12"
                            value={exForm.reps}
                            onChange={handleExFormChange}
                            className="w-full px-3 py-2 bg-black border border-white/5 text-white/80 text-xs rounded-xl focus:outline-none focus:border-[#39ff14]/30"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Target Weight (kg)</label>
                        <input
                          name="weight"
                          type="number"
                          step="0.5"
                          min="0"
                          value={exForm.weight}
                          onChange={handleExFormChange}
                          className="w-full px-3 py-2 bg-black border border-white/5 text-white/80 text-xs rounded-xl focus:outline-none focus:border-[#39ff14]/30"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest">YouTube Video Link</label>
                        <input
                          name="video"
                          type="text"
                          placeholder="https://youtube.com/..."
                          value={exForm.video}
                          onChange={handleExFormChange}
                          className="w-full px-3 py-2 bg-black border border-white/5 text-white/80 text-xs rounded-xl focus:outline-none focus:border-[#39ff14]/30 font-mono text-[10px]"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-purple-500 hover:bg-purple-600 active:scale-95 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                      >
                        + Add Exercise
                      </button>
                    </form>
                  )}
                </div>
              </div>

            </div>

            {/* Sticky Actions Footer */}
            <div className="p-6 border-t border-white/5 flex gap-4 shrink-0 bg-[#09090f]">
              <Button
                variant="transparent"
                className="w-1/2 py-3 border border-white/10 text-white/60 hover:bg-white/5"
                onClick={() => setStep(2)}
              >
                Back to Day Splits
              </Button>
              <Button
                variant="neon"
                className="w-1/2 py-3 shadow-[0_0_15px_rgba(57,255,20,0.1)]"
                onClick={() => setStep(4)}
              >
                Review Program Layout
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & PUBLISH */}
        {step === 4 && (
          <div className="flex-1 flex flex-col justify-center items-center max-w-xl mx-auto w-full space-y-6 p-8">
            {publishing ? (
              <div className="text-center space-y-5">
                <Loader size="lg" />
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider animate-pulse">
                    Publishing Program...
                  </h4>
                  <p className="text-xs text-white/45 font-mono max-w-sm mx-auto leading-relaxed">
                    {publishProgress}
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-6">
                <div className="text-center space-y-1.5">
                  <h4 className="text-lg font-bold text-white uppercase tracking-wider">
                    4. Review & Publish
                  </h4>
                  <p className="text-white/40 text-xs leading-relaxed">
                    Double-check details before uploading the weekly block routines to database.
                  </p>
                </div>

                <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 space-y-3">
                  <h5 className="text-[10px] font-bold text-white/40 uppercase tracking-widest border-b border-white/5 pb-2">
                    Program Specs Summary
                  </h5>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-white/30 block">Course Name</span>
                      <span className="font-bold text-white mt-0.5">
                        {courses.find((c) => c.id === parseInt(courseId))?.name || 'Loading...'}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/30 block">Training Level</span>
                      <span className="font-bold text-white capitalize mt-0.5">{level}</span>
                    </div>
                    <div>
                      <span className="text-white/30 block">Structure Grid</span>
                      <span className="font-bold text-white mt-0.5">
                        {numWeeks} Weeks × {daysPerWeek} Days/Week ({dayConfigs.length} total splits)
                      </span>
                    </div>
                    <div>
                      <span className="text-white/30 block">Exercises Attached</span>
                      <span className="font-bold text-white mt-0.5">
                        {dayConfigs.reduce((acc, curr) => acc + curr.exercises.length, 0)} total lifts
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    variant="transparent"
                    className="w-1/2 py-3.5 border border-white/10 text-white/60 hover:bg-white/5"
                    onClick={() => setStep(3)}
                  >
                    Back to Workouts
                  </Button>
                  <Button
                    variant="neon"
                    className="w-1/2 py-3.5 shadow-[0_0_20px_rgba(57,255,20,0.15)] font-black uppercase tracking-wider"
                    onClick={handlePublishProgram}
                  >
                    Publish Program
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
