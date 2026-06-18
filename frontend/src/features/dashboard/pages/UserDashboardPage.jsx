import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../app/hooks';
import { workoutApi } from '../../../shared/services/workoutApi';
import { subscriptionApi } from '../../../shared/services/subscriptionApi';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Toast from '../../../shared/components/ui/Toast';
import Loader from '../../../shared/components/ui/Loader';

const onboardingQuestions = {
  common: [
    { name: 'age', label: 'Age', type: 'number', placeholder: 'e.g. 25' },
    { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] },
    { name: 'fitness_goal', label: 'Fitness Goal / Objectives', type: 'text', placeholder: 'e.g. Build muscle, lose bodyfat' },
    { name: 'experience_level', label: 'Experience Level', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] },
    { name: 'days_per_week', label: 'Desired Weekly Sessions', type: 'number', placeholder: 'e.g. 4' },
    { name: 'injuries', label: 'Injuries or Restrictions (Write None if none)', type: 'text', placeholder: 'e.g. Knee pain, none' },
    { name: 'equipment', label: 'Available Gym Equipment', type: 'checkboxes', options: [
        { value: 'barbell', label: 'Barbell' },
        { value: 'dumbbell', label: 'Dumbbell' },
        { value: 'cables', label: 'Cables' },
        { value: 'kettlebell', label: 'Kettlebell' },
        { value: 'machine', label: 'Machines' },
        { value: 'bench', label: 'Bench' },
        { value: 'resistance band', label: 'Resistance Bands' }
      ]
    }
  ]
};

export default function UserDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);

  // States
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [enrolledCourse, setEnrolledCourse] = useState(null);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [history, setHistory] = useState([]);
  const [streak, setStreak] = useState(0);
  const [dailyGoalCompleted, setDailyGoalCompleted] = useState(false);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [tasks, setTasks] = useState([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [onboardingForm, setOnboardingForm] = useState({});
  const [submittingOnboarding, setSubmittingOnboarding] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    setSubscriptionExpired(false);
    try {
      // 1. Check if user is enrolled
      const enrolledRes = await workoutApi.getEnrolledCourse();
      if (enrolledRes.data?.success && enrolledRes.data?.data) {
        const courseData = enrolledRes.data.data;
        setEnrolledCourse(courseData);

        // 2. Fetch today's workout
        try {
          const workoutRes = await workoutApi.getTodayWorkout();
          if (workoutRes.data?.success) {
            setTodayWorkout(workoutRes.data.data);
          }
        } catch (err) {
          if (err.response?.status === 403 && err.response?.data?.message?.includes('expired')) {
            setSubscriptionExpired(true);
          }
          console.error('Error fetching today\'s workout:', err);
        }

        // 3. Fetch workout history to calculate streak and daily goal
        try {
          const historyRes = await workoutApi.getWorkoutHistory();
          if (historyRes.data?.success) {
            const logs = historyRes.data.data || [];
            setHistory(logs);
            setStreak(logs.length);

            // Check if today is completed
            const todayStr = new Date().toISOString().slice(0, 10);
            const isCompletedToday = logs.some(log => log.completed_at?.startsWith(todayStr));
            setDailyGoalCompleted(isCompletedToday);
          }
        } catch (err) {
          console.error('Error fetching workout history:', err);
        }

        // 4. Fetch assigned tasks
        try {
          const tasksRes = await workoutApi.getMyTasks();
          if (tasksRes.data?.success) {
            setTasks(tasksRes.data.data || []);
          }
        } catch (err) {
          console.error('Error fetching user tasks:', err);
        }
      } else {
        // Not enrolled, so fetch all available courses to choose from
        setEnrolledCourse(null);
        await fetchCourses();
      }
    } catch (err) {
      // If 400 Bad Request indicates not enrolled, fetch courses
      if (err.response?.status === 400 || err.response?.data?.message?.includes('not enrolled')) {
        setEnrolledCourse(null);
        await fetchCourses();
      } else {
        setToastMsg({ message: err.response?.data?.message || 'Error loading dashboard data', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await workoutApi.getCourses();
      if (res.data?.success) {
        setCourses(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
    }
  };

  useEffect(() => {
    if (user?.status === 'approved') {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
    const questions = onboardingQuestions.common;
    const initialForm = {
      equipment: []
    };
    questions.forEach(q => {
      if (q.type === 'number') {
        initialForm[q.name] = '';
      } else if (q.type === 'select') {
        initialForm[q.name] = q.options[0];
      } else if (q.type === 'text') {
        initialForm[q.name] = '';
      }
    });
    setOnboardingForm(initialForm);
    setShowModal(true);
  };

  const handleFormChange = (name, value) => {
    setOnboardingForm({ ...onboardingForm, [name]: value });
  };

  const handleCheckboxChange = (value, checked) => {
    const list = onboardingForm.equipment || [];
    const updated = checked ? [...list, value] : list.filter(v => v !== value);
    setOnboardingForm({ ...onboardingForm, equipment: updated });
  };

  const handleOnboardingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCourse) return;

    setSubmittingOnboarding(true);
    try {
      const parsedData = {
        age: parseInt(onboardingForm.age) || 0,
        gender: onboardingForm.gender || 'Male',
        goals: onboardingForm.fitness_goal || '',
        experience_level: onboardingForm.experience_level || 'Beginner',
        days_per_week: parseInt(onboardingForm.days_per_week) || 3,
        injuries: onboardingForm.injuries || '',
        equipment: onboardingForm.equipment || [],
      };

      const res = await workoutApi.enroll(selectedCourse.id, parsedData);
      if (res.data?.success) {
        setToastMsg({ message: 'Enrolled successfully! 7-Day Free Trial Activated.', type: 'success' });
        setShowModal(false);
        fetchDashboardData();
      }
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Enrollment failed', type: 'error' });
    } finally {
      setSubmittingOnboarding(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      const res = await subscriptionApi.createRazorpaySubscription();
      if (res.data?.success) {
        setToastMsg({ message: 'Subscription request sent successfully!', type: 'success' });
        // Simulating immediate payment confirmation for developer convenience
        setTimeout(() => {
          setToastMsg({ message: 'Simulated payment success! Re-fetching stats.', type: 'success' });
          fetchDashboardData();
        }, 1500);
      }
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to trigger subscription checkout', type: 'error' });
    }
  };

  const handleMarkTaskDone = async (taskId) => {
    try {
      await workoutApi.updateTaskStatus(taskId, 'completed');
      setToastMsg({ message: 'Task marked as completed! Nice work!', type: 'success' });
      const tasksRes = await workoutApi.getMyTasks();
      if (tasksRes.data?.success) {
        setTasks(tasksRes.data.data || []);
      }
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to update task status', type: 'error' });
    }
  };

  const handleCompleteRestDay = async (dayId) => {
    try {
      const res = await workoutApi.completeWorkoutDay(dayId);
      if (res.data?.success) {
        setToastMsg({ message: 'Rest day completed! Moving to next training day.', type: 'success' });
        fetchDashboardData();
      }
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to complete rest day', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {toastMsg && (
        <Toast message={toastMsg.message} type={toastMsg.type} onClose={() => setToastMsg(null)} />
      )}

      {/* Welcome Banner Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#08080c] p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <span className={`text-[10px] border px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${
            user?.status === 'approved' 
              ? 'bg-[#163819]/50 text-[#39ff14] border-[#163819]' 
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            {user?.status === 'approved' ? 'Active Client' : 'Pending Trainer Approval'}
          </span>
          <h2 className="text-3xl font-extrabold text-white tracking-tight mt-2">
            Welcome back, {user?.name || 'Athlete'}!
          </h2>
          <p className="text-white/45 text-sm max-w-xl leading-relaxed">
            {user?.status === 'approved'
              ? 'Your performance metrics are synchronized. Keep crushing your workouts and consulting with your personal coach.'
              : 'Your trainer needs to approve your profile before you can access workout programs, coach tools, and chat channels.'}
          </p>
        </div>

        {/* Member Status Badge */}
        {user?.status === 'approved' && (
          <div className="flex items-center gap-4 bg-[#071308] border border-[#102b13]/60 px-5 py-4 rounded-xl shrink-0 min-w-[240px]">
            <div className="w-10 h-10 rounded-lg bg-[#163819] flex items-center justify-center text-[#39ff14]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">
                {subscriptionExpired ? 'Trial Expired' : 'Active Member'}
              </div>
              <div className="text-xs text-white/40 mt-0.5">
                Status:{' '}
                <span className={`font-semibold ${subscriptionExpired ? 'text-red-400' : 'text-[#39ff14]'}`}>
                  {subscriptionExpired ? 'Expired' : 'Active'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Account Verification notice if pending */}
      {user?.status === 'pending_approval' && (
        <div className="bg-amber-500/5 border border-amber-500/20 p-6 rounded-2xl flex items-start gap-4 shadow-lg animate-pulse">
          <span className="text-2xl mt-0.5">⚠️</span>
          <div>
            <h4 className="text-amber-400 font-extrabold text-sm">Account Pending Trainer Approval</h4>
            <p className="text-white/60 text-xs mt-1.5 leading-relaxed">
              Trainer verification is required. Once approved, the dashboard courses, LiveKit consults, and Claude AI coach will unlock. Please contact the front desk if this is taking longer than expected.
            </p>
          </div>
        </div>
      )}

      {user?.status === 'approved' && (
        <>
          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Streak */}
            <div className="bg-[#08080c] border border-white/5 p-6 rounded-2xl flex items-center gap-5">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Workout Sessions</div>
                <div className="text-xl font-bold text-white mt-0.5">{streak} Completed</div>
              </div>
            </div>

            {/* Selected Course */}
            <div className="bg-[#08080c] border border-white/5 p-6 rounded-2xl flex items-center gap-5">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Active Program</div>
                <div className="text-xl font-bold text-white mt-0.5">
                  {enrolledCourse ? enrolledCourse.name : 'Not Enrolled'}
                </div>
                {enrolledCourse && (
                  <button
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to cancel your current program? All progress for this enrollment will be closed, but you can choose a new program anytime.')) {
                        try {
                          await workoutApi.cancelEnrollment();
                          setToastMsg({ message: 'Program cancelled successfully.', type: 'success' });
                          setEnrolledCourse(null);
                          setTodayWorkout(null);
                          fetchCourses();
                        } catch (err) {
                          setToastMsg({ message: err.response?.data?.message || 'Failed to cancel course', type: 'error' });
                        }
                      }
                    }}
                    className="text-[10px] text-red-400/60 hover:text-red-400 hover:underline transition-all mt-1 cursor-pointer bg-transparent border-none p-0 outline-none align-baseline font-bold"
                  >
                    Cancel program
                  </button>
                )}
              </div>
            </div>

            {/* Daily Goal */}
            <div className="bg-[#08080c] border border-white/5 p-6 rounded-2xl flex items-center gap-5">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-[#39ff14]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Daily Goal</div>
                <div className="text-xl font-bold text-white mt-0.5">
                  {dailyGoalCompleted ? '100% Done' : 'Pending'}
                </div>
              </div>
            </div>
          </div>

          {/* Main split grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Today's Workout or Catalog */}
            <div className="lg:col-span-8 space-y-6">
              {enrolledCourse ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">Today's Active Workout</h3>
                    {todayWorkout && (
                      <span className="text-xs text-[#39ff14] font-bold">
                        Day {todayWorkout.day_number} Plan
                      </span>
                    )}
                  </div>

                  {subscriptionExpired ? (
                    <div className="bg-[#0f0b0b] border border-red-500/20 p-8 rounded-2xl text-center space-y-4">
                      <div className="w-14 h-14 bg-red-500/15 rounded-full flex items-center justify-center text-red-500 mx-auto text-2xl font-bold">
                        🔒
                      </div>
                      <h4 className="text-lg font-bold text-white">Your Trial Period has Expired</h4>
                      <p className="text-xs text-white/50 max-w-sm mx-auto leading-relaxed">
                        Your 7-day free trial on {enrolledCourse.name} has concluded. Please activate your subscription plan to continue training logs and consults.
                      </p>
                      <Button variant="neon" className="px-6 py-2.5 mx-auto" onClick={handleSubscribe}>
                        Subscribe Now
                      </Button>
                    </div>
                  ) : todayWorkout ? (
                    todayWorkout.is_rest_day ? (
                      <div className="bg-[#08080c] border border-white/5 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                            <span className="text-2xl">💤</span>
                          </div>
                          <div className="space-y-1.5">
                            <h4 className="text-lg font-bold text-white">{todayWorkout.title || 'Rest & Recovery'}</h4>
                            <p className="text-xs text-white/45 leading-relaxed max-w-md">
                              Today is a designated Rest Day. Focus on hydration, mobility exercises, proper nutrition, and quality sleep to promote muscle repair and nervous system recovery.
                            </p>
                            <div className="flex flex-wrap gap-2.5 pt-3">
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/5 border border-amber-500/10 px-2.5 py-1 rounded-md">
                                🕒 Day {todayWorkout.day_number}
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-green-400 bg-green-500/5 border border-green-500/10 px-2.5 py-1 rounded-md">
                                ✨ Rest & Restore
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleCompleteRestDay(todayWorkout.id)}
                          className="px-6 py-3.5 rounded-xl bg-amber-500 text-black font-extrabold text-sm flex items-center justify-center gap-2 hover:bg-amber-400 active:scale-95 transition-all shrink-0 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                        >
                          Mark Rest Day Completed
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="bg-[#08080c] border border-white/5 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4M6 8l4-4 4 4m-4-4v12" />
                            </svg>
                          </div>
                          <div className="space-y-1.5">
                            <h4 className="text-lg font-bold text-white">{todayWorkout.title}</h4>
                            <p className="text-xs text-white/45 leading-relaxed max-w-md">
                              This session contains {todayWorkout.exercises?.length || 0} exercise{todayWorkout.exercises?.length === 1 ? '' : 's'} designed to build strength and conditioning.
                            </p>
                            <div className="flex flex-wrap gap-2.5 pt-3">
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-purple-400 bg-purple-500/5 border border-purple-500/10 px-2.5 py-1 rounded-md">
                                🏋️ {todayWorkout.exercises?.length || 0} Exercises
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-orange-400 bg-orange-500/5 border border-orange-500/10 px-2.5 py-1 rounded-md">
                                🔥 Active Program
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/5 border border-amber-500/10 px-2.5 py-1 rounded-md">
                                🕒 Day {todayWorkout.day_number}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => navigate('/dashboard/workouts')}
                          className="px-6 py-3.5 rounded-xl bg-[#39ff14] text-black font-extrabold text-sm flex items-center justify-center gap-2 hover:bg-[#32e010] active:scale-95 transition-all shrink-0 cursor-pointer shadow-[0_0_20px_rgba(57,255,20,0.15)]"
                        >
                          Start Workout
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="bg-[#08080c] border border-white/5 p-8 rounded-2xl text-center text-white/40">
                      No active routines generated for today.
                    </div>
                  )}

                  {/* Workout History Section */}
                  <div className="bg-[#08080c] border border-white/5 rounded-2xl p-6 space-y-4">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>📊</span> Workout History & Logs
                    </h4>
                    {history.length === 0 ? (
                      <p className="text-xs text-white/30 text-center py-6">No completed workouts recorded yet. Start training to see your history logs here!</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[260px] overflow-y-auto pr-1">
                        {[...history].sort((a,b) => new Date(b.completed_at) - new Date(a.completed_at)).map((log) => (
                          <div key={log.id} className="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-white block">{log.workout_title}</span>
                              <span className="text-[10px] text-white/40 block mt-0.5">Completed on {new Date(log.completed_at).toLocaleDateString()}</span>
                            </div>
                            <span className="text-[10px] font-black uppercase text-[#39ff14] bg-[#39ff14]/5 border border-[#39ff14]/10 px-2 py-0.5 rounded">
                              ✓ Verified
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-white tracking-tight">Select Your Fitness Path</h3>
                    <p className="text-white/40 text-xs">Choose one of our signature programs to start your 7-day free trial</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {courses.map((course) => {
                      let glowColor = 'hover:border-purple-500/40 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]';
                      let labelColor = 'text-purple-400 bg-purple-500/5 border border-purple-500/15';
                      let iconStr = '💪';

                      if (course.slug === 'strength') {
                        glowColor = 'hover:border-blue-500/40 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]';
                        labelColor = 'text-blue-400 bg-blue-500/5 border border-blue-500/15';
                        iconStr = '🏋️';
                      } else if (course.slug === 'endurance') {
                        glowColor = 'hover:border-emerald-500/40 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]';
                        labelColor = 'text-[#39ff14] bg-[#163819]/40 border border-[#163819]/60';
                        iconStr = '🏃';
                      }

                      return (
                        <Card key={course.id} className={`p-6 flex flex-col justify-between h-[280px] bg-[#08080c] border-white/5 transition-all duration-300 ${glowColor}`}>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${labelColor}`}>
                                {course.slug}
                              </span>
                              <span className="text-xl">{iconStr}</span>
                            </div>
                            <h4 className="text-lg font-bold text-white tracking-tight mt-1">{course.name}</h4>
                            <p className="text-xs text-white/45 leading-relaxed">{course.description}</p>
                          </div>

                          <Button
                            variant="neon"
                            className="w-full py-2.5 text-xs font-black uppercase tracking-wider mt-4"
                            onClick={() => handleSelectCourse(course)}
                          >
                            Select Program
                          </Button>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Right Column: Trainer Tools */}
            <div className="lg:col-span-4 space-y-4">
              <h3 className="text-lg font-bold text-white">Trainer Tools</h3>

              <div className="space-y-4">
                {/* Trainer Tasks Widget */}
                <div className="bg-[#08080c] border border-white/5 rounded-2xl p-5 space-y-3.5 shadow-lg">
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>📋</span> Trainer Tasks
                  </h4>
                  {tasks.length === 0 ? (
                    <p className="text-[10px] text-white/30">No tasks assigned yet.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                      {tasks.map((task) => (
                        <div key={task.id} className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all">
                          <div className="space-y-1">
                            <div className="text-xs font-bold text-white flex items-center gap-1.5 font-sans">
                              {task.title}
                              {task.status === 'completed' && <span className="text-[#39ff14] text-[10px]">✓</span>}
                            </div>
                            {task.description && (
                              <div className="text-[10px] text-white/40 leading-relaxed">{task.description}</div>
                            )}
                            {task.due_date && (
                              <div className="text-[9px] text-amber-400 font-bold">
                                Due: {new Date(task.due_date).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          {task.status === 'pending' ? (
                            <button
                              onClick={() => handleMarkTaskDone(task.id)}
                              className="text-[9px] font-black uppercase text-[#39ff14] border border-[#39ff14]/30 hover:border-[#39ff14] hover:bg-[#39ff14]/10 px-2 py-1 rounded-lg transition-all shrink-0 cursor-pointer"
                            >
                              Done
                            </button>
                          ) : (
                            <span className="text-[9px] font-black uppercase text-white/30 px-2 py-1 select-none">
                              Completed
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                {/* Claude AI Coach */}
                <a
                  href="/dashboard/chat"
                  className="flex items-center justify-between p-4 rounded-xl bg-[#08080c] border border-white/5 hover:bg-white/[0.02] hover:border-white/10 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white leading-tight">Claude AI Coach</div>
                      <div className="text-xs text-white/40 mt-0.5">Get fitness & nutrition advice</div>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>

                {/* Video Consultations */}
                <a
                  href="/dashboard/calls"
                  className="flex items-center justify-between p-4 rounded-xl bg-[#08080c] border border-white/5 hover:bg-white/[0.02] hover:border-white/10 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white leading-tight">Video Consultations</div>
                      <div className="text-xs text-white/40 mt-0.5">Call with your trainer</div>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>

                {/* Subscription Plan */}
                <a
                  href="/dashboard/profile"
                  className="flex items-center justify-between p-4 rounded-xl bg-[#08080c] border border-white/5 hover:bg-white/[0.02] hover:border-white/10 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-[#22441b]/50 flex items-center justify-center text-[#39ff14]">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white leading-tight">Subscription Plan</div>
                      <div className="text-xs text-white/40 mt-0.5">Manage membership settings</div>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </>
    )}

      {/* Onboarding Questionnaire Modal */}
      {showModal && selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#08080c] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] space-y-6">
            <div>
              <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>📋</span> Onboarding: {selectedCourse.name}
              </h3>
              <p className="text-white/40 text-xs mt-1">
                Answer these diagnostic questions so we can calibrate your workout parameters.
              </p>
            </div>

            <form onSubmit={handleOnboardingSubmit} className="space-y-4">
              {onboardingQuestions.common.map((q) => (
                <div key={q.name} className="flex flex-col space-y-1.5">
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    {q.label}
                  </label>
                  {q.type === 'select' ? (
                    <select
                      value={onboardingForm[q.name] || ''}
                      onChange={(e) => handleFormChange(q.name, e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-black border border-white/5 text-white/80 text-xs focus:outline-none focus:border-[#39ff14]/30 cursor-pointer"
                    >
                      {q.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : q.type === 'checkboxes' ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt) => {
                        const checked = (onboardingForm.equipment || []).includes(opt.value);
                        return (
                          <label key={opt.value} className="flex items-center gap-2 bg-black/40 border border-white/5 p-2.5 rounded-xl cursor-pointer hover:bg-white/[0.02] select-none transition-all">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => handleCheckboxChange(opt.value, e.target.checked)}
                              className="w-4 h-4 accent-[#39ff14] cursor-pointer"
                            />
                            <span className="text-[11px] text-white/80">{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <Input
                      name={q.name}
                      type={q.type}
                      value={onboardingForm[q.name] || ''}
                      onChange={(e) => handleFormChange(q.name, e.target.value)}
                      placeholder={q.placeholder}
                      required
                    />
                  )}
                </div>
              ))}

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="transparent"
                  className="w-1/2 py-3 border border-white/10 hover:bg-white/5 text-white/70"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="neon"
                  className="w-1/2 py-3 shadow-[0_0_20px_rgba(57,255,20,0.15)]"
                  isLoading={submittingOnboarding}
                >
                  Activate Trial & Start
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

