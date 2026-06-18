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
  const [weekModal, setWeekModal] = useState(null); // null | { mode: 'create'|'edit', weekId?, weekNumber, title, isUserPlan?, adminNotes? }
  const [dayModal, setDayModal] = useState(null);   // null | { mode: 'create'|'edit', weekId, dayId?, dayNumber, title, isRestDay, isUserPlan?, adminNotes? }

  // Tabs & Custom Plan State
  const [activeTab, setActiveTab] = useState('templates'); // 'templates' | 'personal_plans'
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientEnrollment, setClientEnrollment] = useState(null);
  const [clientPlan, setClientPlan] = useState(null);
  const [expiringUsers, setExpiringUsers] = useState([]);
  const [clientPlanLoading, setClientPlanLoading] = useState(false);
  const [feedbackDays, setFeedbackDays] = useState({});

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
      if (weekModal.isUserPlan) {
        await workoutApi.createUserWeek(selectedClientId, {
          course_id: clientEnrollment.id,
          week_number: parseInt(weekModal.weekNumber),
          title: weekModal.title,
        });
        setToastMsg({ message: 'Custom week created for client!', type: 'success' });
        fetchClientData(selectedClientId);
      } else {
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
        fetchWeeks();
      }
      setWeekModal(null);
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
      if (dayModal.isUserPlan) {
        await workoutApi.createUserDay({
          assigned_week_id: dayModal.weekId,
          day_number: parseInt(dayModal.dayNumber),
          title: dayModal.title,
          is_rest_day: dayModal.isRestDay,
          admin_notes: dayModal.adminNotes || '',
        });
        setToastMsg({ message: 'Custom routine day created for client!', type: 'success' });
        fetchClientData(selectedClientId);
      } else {
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
        fetchWeeks();
      }
      setDayModal(null);
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

  // ── Actions: Client Personal Plans ──────────────────────────────────────────

  const fetchClientData = async (clientId) => {
    if (!clientId) {
      setClientEnrollment(null);
      setClientPlan(null);
      return;
    }
    setClientPlanLoading(true);
    try {
      const [enrollRes, planRes] = await Promise.all([
        workoutApi.getUserEnrollment(clientId),
        workoutApi.getUserPlan(clientId)
      ]);
      
      if (enrollRes.data?.success) {
        setClientEnrollment(enrollRes.data.data);
      }
      if (planRes.data?.success) {
        const weeksData = planRes.data.data || [];
        setClientPlan(weeksData);
        
        // Populate existing feedback inputs
        const feedbackMap = {};
        weeksData.forEach(week => {
          (week.days || []).forEach(day => {
            feedbackMap[day.id] = day.admin_feedback || '';
          });
        });
        setFeedbackDays(feedbackMap);

        // Keep activeExerciseDay synchronized!
        if (activeExerciseDay) {
          let foundDay = null;
          for (const week of weeksData) {
            const dayMatch = (week.days || []).find(d => d.id === activeExerciseDay.id);
            if (dayMatch) {
              foundDay = dayMatch;
              break;
            }
          }
          if (foundDay) {
            setActiveExerciseDay(foundDay);
          }
        }
      }
    } catch (err) {
      setToastMsg({ message: 'Failed to load client data', type: 'error' });
    } finally {
      setClientPlanLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'personal_plans') {
      const fetchExpiring = async () => {
        try {
          const res = await workoutApi.getTrialExpiringUsers();
          if (res.data?.success) {
            setExpiringUsers(res.data.data || []);
          }
        } catch (err) {
          console.error('Failed to fetch trial expiring users', err);
        }
      };
      fetchExpiring();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'personal_plans' && selectedClientId) {
      fetchClientData(selectedClientId);
    }
  }, [selectedClientId, activeTab]);

  const handleSaveFeedback = async (dayId) => {
    const text = feedbackDays[dayId] || '';
    try {
      await workoutApi.addUserDayFeedback(selectedClientId, dayId, text);
      setToastMsg({ message: 'Feedback sent to client!', type: 'success' });
      fetchClientData(selectedClientId);
    } catch (err) {
      setToastMsg({ message: 'Failed to send feedback', type: 'error' });
    }
  };

  const handleToggleVideoAccess = async () => {
    if (!clientEnrollment || !selectedClientId) return;
    const nextState = !clientEnrollment.video_access_enabled;
    try {
      await workoutApi.toggleUserVideoAccess(selectedClientId, nextState);
      setClientEnrollment(p => ({ ...p, video_access_enabled: nextState }));
      setToastMsg({ message: `Video consultation access ${nextState ? 'enabled' : 'disabled'} for this client.`, type: 'success' });
    } catch (err) {
      setToastMsg({ message: 'Failed to toggle video access', type: 'error' });
    }
  };

  // ── Render Helpers ──────────────────────────────────────────────────────────

  const courseColors = {
    hypertrophy: { accent: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', dot: 'bg-purple-400' },
    strength:    { accent: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   dot: 'bg-blue-400'   },
    endurance:   { accent: 'text-[#39ff14]',  bg: 'bg-[#163819]/40',  border: 'border-[#163819]/60',  dot: 'bg-[#39ff14]'  },
  };

  const clr = selectedCourse ? (courseColors[selectedCourse.slug] || { accent: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10', dot: 'bg-white/40' }) : {};

  const activeClients = users.filter((u) => u.status === 'Active' && u.role === 'User');

  return (
    <div className="space-y-6">
      
      {/* Tabs Selector */}
      <div className="flex border-b border-white/5 mb-6">
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'templates'
              ? 'border-[#39ff14] text-white'
              : 'border-transparent text-white/40 hover:text-white/85'
          }`}
        >
          📁 Course Templates
        </button>
        <button
          onClick={() => setActiveTab('personal_plans')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'personal_plans'
              ? 'border-[#39ff14] text-white'
              : 'border-transparent text-white/40 hover:text-white/85'
          }`}
        >
          👤 Client Personal Plans
        </button>
      </div>

      {activeTab === 'templates' ? (
        <>
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
        </>
      ) : (
        <div className="space-y-6">
          {/* Trial Expiring Users Alert Banner */}
          {expiringUsers.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                ⚠️ Trial Expiring Soon ({expiringUsers.length})
              </h4>
              <div className="text-[11px] text-white/70 space-y-1">
                {expiringUsers.map(user => {
                  const endsAt = new Date(user.trial_ends_at);
                  const remainingHours = Math.max(0, Math.round((endsAt - new Date()) / (1000 * 60 * 60)));
                  return (
                    <div key={user.user_id} className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                      <span><strong>{user.name}</strong> ({user.email})</span>
                      <span className="font-bold text-amber-400">Ends in {remainingHours} hrs ({endsAt.toLocaleDateString()})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Client selector dropdown */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-[#08080c] border border-white/5 rounded-2xl p-6">
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-tight">Select Client Profile</h3>
              <p className="text-white/40 text-[10px]">Select a client to manage their personalized training routines, feedback and consultation privileges.</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full md:w-64 px-4 py-2.5 rounded-xl bg-black border border-white/8 text-white/80 text-xs focus:outline-none focus:border-[#39ff14]/30 cursor-pointer"
              >
                <option value="">-- Choose Client --</option>
                {activeClients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Client Details, Metadata and Custom Plans */}
          {selectedClientId ? (
            clientPlanLoading ? (
              <div className="py-20 flex justify-center"><Loader size="lg" /></div>
            ) : clientEnrollment ? (
              <div className="space-y-6">
                
                {/* Check if trial expired and not subscribed */}
                {(() => {
                  const endsAt = clientEnrollment.trial_ends_at ? new Date(clientEnrollment.trial_ends_at) : null;
                  const isTrialEnded = endsAt && endsAt < new Date();
                  if (isTrialEnded) {
                    return (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3.5 flex items-center gap-2">
                        <span>⚠️</span>
                        <div>
                          <strong>Free Trial Ended.</strong> You can still modify workouts, but the client cannot access them until their subscription is active.
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Client Meta Info Card */}
                <div className="bg-[#08080c] border border-white/5 rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left panel: Info & Status */}
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] font-bold text-white/35 uppercase tracking-widest">Client Name</span>
                      <h4 className="text-base font-extrabold text-white mt-0.5">{clientEnrollment.name}</h4>
                      <p className="text-xs text-white/50">{clientEnrollment.description || 'No description'}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Age / Gender</span>
                        <p className="text-xs text-white/80 font-semibold mt-0.5">
                          {clientEnrollment.age ? `${clientEnrollment.age} yrs` : 'N/A'} / {clientEnrollment.gender || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Course level</span>
                        <p className="text-xs text-[#39ff14] font-bold mt-0.5 uppercase">
                          {clientEnrollment.level || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Trial countdown */}
                    <div>
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Trial & Subscription Status</span>
                      {(() => {
                        const endsAt = clientEnrollment.trial_ends_at ? new Date(clientEnrollment.trial_ends_at) : null;
                        const now = new Date();
                        if (!endsAt) {
                          return <p className="text-xs text-red-400 font-bold mt-0.5">No Trial Scheduled</p>;
                        }
                        const diffTime = endsAt - now;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        if (diffTime < 0) {
                          return (
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-[9px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded font-black uppercase">
                                Expired
                              </span>
                              <span className="text-[10px] text-white/45">Ended on {endsAt.toLocaleDateString()}</span>
                            </div>
                          );
                        } else {
                          return (
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-[9px] bg-green-500/10 border border-green-500/20 text-[#39ff14] px-2 py-0.5 rounded font-black uppercase animate-pulse">
                                Active Trial
                              </span>
                              <span className="text-[10px] text-white/80 font-bold">
                                {diffDays} {diffDays === 1 ? 'day' : 'days'} remaining
                              </span>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>

                  {/* Middle panel: Goals, Injuries & Equipment */}
                  <div className="space-y-4">
                    <div>
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Training Goals</span>
                      <p className="text-xs text-white/80 mt-1 italic leading-relaxed">
                        "{clientEnrollment.goals || 'No goals stated.'}"
                      </p>
                    </div>

                    <div>
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Injuries / Limitations</span>
                      <p className="text-xs text-red-400/90 mt-1 font-medium">
                        {clientEnrollment.injuries || 'None declared.'}
                      </p>
                    </div>
                  </div>

                  {/* Right panel: Gym Equipment & Video consultation toggle */}
                  <div className="space-y-4">
                    <div>
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Gym Equipment Available</span>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(() => {
                          let equipmentArray = [];
                          try {
                            if (clientEnrollment.equipment) {
                              equipmentArray = JSON.parse(clientEnrollment.equipment);
                            }
                          } catch (e) {
                            if (Array.isArray(clientEnrollment.equipment)) {
                              equipmentArray = clientEnrollment.equipment;
                            } else if (typeof clientEnrollment.equipment === 'string') {
                              equipmentArray = clientEnrollment.equipment.split(',').map(s => s.trim());
                            }
                          }
                          
                          if (equipmentArray.length === 0) {
                            return <span className="text-[10px] text-white/30">No equipment selected</span>;
                          }
                          
                          return equipmentArray.map((eq, i) => (
                            <span key={i} className="text-[9px] bg-white/5 border border-white/10 text-white/70 px-2 py-0.5 rounded-md font-medium uppercase tracking-wide">
                              {eq}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>

                    {/* Video access toggle */}
                    <div className="bg-black/30 border border-white/5 p-3.5 rounded-xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Video Consultations</span>
                        <p className="text-[10px] text-white/70">Enable 1-on-1 calls via WebRTC</p>
                      </div>
                      <button
                        onClick={handleToggleVideoAccess}
                        className={`w-12 h-6 rounded-full p-1 transition-all duration-300 cursor-pointer ${
                          clientEnrollment.video_access_enabled ? 'bg-[#39ff14]' : 'bg-white/10'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-black transition-all duration-300 ${
                          clientEnrollment.video_access_enabled ? 'translate-x-6' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Custom Weekly Routine Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">Custom Training Program</h4>
                      <p className="text-[10px] text-white/35">Personalized routines for this client. Overrides template courses.</p>
                    </div>
                    
                    <button
                      onClick={() => {
                        setWeekModal({ isUserPlan: true, mode: 'create', weekNumber: (clientPlan?.length || 0) + 1, title: '' });
                      }}
                      className="px-4 py-2 rounded-xl bg-[#39ff14] text-black text-xs font-extrabold hover:bg-[#2ee010] cursor-pointer transition-all uppercase tracking-wider"
                    >
                      + Add Week
                    </button>
                  </div>

                  {/* Render custom user weeks */}
                  {!clientPlan || clientPlan.length === 0 ? (
                    <div className="bg-[#08080c] border border-white/5 rounded-2xl p-16 text-center space-y-4">
                      <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-3xl mx-auto">👤</div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">No Custom Weeks Configured</h4>
                      <p className="text-xs text-white/35 max-w-sm mx-auto">Create weekly cycles to completely overwrite course template logic for this user.</p>
                      <button
                        onClick={() => {
                          setWeekModal({ isUserPlan: true, mode: 'create', weekNumber: 1, title: '' });
                        }}
                        className="px-6 py-2.5 rounded-xl bg-[#39ff14] text-black text-xs font-extrabold hover:bg-[#2ee010] cursor-pointer transition-all uppercase tracking-wider shadow-[0_0_15px_rgba(57,255,20,0.15)]"
                      >
                        Create Custom Week 1
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {clientPlan.map((week) => (
                        <div key={week.id} className="bg-[#08080c] border border-white/5 rounded-2xl overflow-hidden shadow-lg">
                          {/* Week header */}
                          <div className="px-6 py-4.5 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                            <div className="flex items-center gap-3">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#39ff14]" />
                              <div>
                                <span className="text-xs font-black text-white uppercase tracking-widest">
                                  Custom Week {week.week_number}
                                </span>
                                <h4 className="text-sm font-bold text-white/80 mt-0.5">{week.title}</h4>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setDayModal({ isUserPlan: true, mode: 'create', weekId: week.id, dayNumber: (week.days?.length || 0) + 1, title: '', isRestDay: false, adminNotes: '' });
                                }}
                                className="text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg bg-[#39ff14]/10 border border-[#39ff14]/20 text-[#39ff14] hover:bg-[#39ff14]/20 transition-all cursor-pointer"
                              >
                                + Add Day Split
                              </button>
                            </div>
                          </div>

                          {/* Days List */}
                          {!week.days || week.days.length === 0 ? (
                            <div className="px-6 py-8 text-center text-xs text-white/20">
                              No days configured for this custom week.
                            </div>
                          ) : (
                            <div className="divide-y divide-white/[0.03]">
                              {[...week.days].sort((a, b) => a.day_number - b.day_number).map((day) => (
                                <div key={day.id} className="px-6 py-5 flex flex-col space-y-4 hover:bg-white/[0.005] transition-all group">
                                  
                                  {/* Day Row Header */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                      <div className={`w-10 h-10 rounded-xl ${day.is_rest_day ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-[#163819]/40 border-[#163819]/60 text-[#39ff14]'} border flex items-center justify-center shrink-0`}>
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
                                        <p className="text-[10px] text-white/35 mt-0.5">
                                          {day.is_rest_day 
                                            ? 'Active recovery or absolute rest' 
                                            : `${day.exercises?.length || 0} exercises configured`}
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
                                    </div>
                                  </div>

                                  {/* Notes/Feedback Section */}
                                  <div className="bg-black/35 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                    <div className="space-y-2 flex-1">
                                      {day.admin_notes && (
                                        <p className="text-[11px] text-white/70">
                                          <strong className="text-white/40 uppercase tracking-widest text-[8px] block">Notes / Instructions</strong>
                                          {day.admin_notes}
                                        </p>
                                      )}
                                      
                                      {day.admin_feedback && (
                                        <div className="text-[11px] text-[#39ff14]/90 bg-[#39ff14]/5 border border-[#39ff14]/10 p-2.5 rounded-lg">
                                          <strong className="text-white/40 uppercase tracking-widest text-[8px] block mb-0.5 font-black">Active Trainer Feedback</strong>
                                          {day.admin_feedback}
                                        </div>
                                      )}
                                    </div>

                                    {/* Feedback input form */}
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSaveFeedback(day.id);
                                      }}
                                      className="w-full md:w-auto flex items-center gap-2 shrink-0"
                                    >
                                      <input
                                        type="text"
                                        placeholder={day.admin_feedback ? "Update feedback..." : "Add day feedback..."}
                                        value={feedbackDays[day.id] || ''}
                                        onChange={(e) => setFeedbackDays(p => ({ ...p, [day.id]: e.target.value }))}
                                        className="px-3 py-1.5 rounded-lg bg-black border border-white/8 text-white/80 text-[11px] focus:outline-none focus:border-[#39ff14]/40 w-full md:w-56"
                                      />
                                      <button
                                        type="submit"
                                        className="px-3 py-1.5 rounded-lg bg-[#39ff14] hover:bg-[#2ee010] text-black text-[10px] font-black uppercase transition-all cursor-pointer whitespace-nowrap"
                                      >
                                        Send
                                      </button>
                                    </form>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#08080c] border border-white/5 rounded-2xl p-16 text-center text-xs text-white/45">
                Client is approved, but has not initialized a training course enrollment yet.
              </div>
            )
          ) : (
            <div className="bg-[#08080c] border border-white/5 rounded-2xl p-16 text-center text-xs text-white/35">
              Select an approved client from the dropdown to access their personalized training dashboard.
            </div>
          )}
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
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                  {weekModal.isUserPlan ? 'Enrolled Course' : 'Week Number'}
                </label>
                {weekModal.isUserPlan ? (
                  <input
                    type="text" disabled
                    value={clientEnrollment?.name || ''}
                    className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/8 text-white/40 text-xs focus:outline-none"
                  />
                ) : (
                  <input
                    type="number" min="1" required
                    disabled={weekModal.mode === 'edit'}
                    value={weekModal.weekNumber}
                    onChange={(e) => setWeekModal(p => ({ ...p, weekNumber: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/40"
                  />
                )}
              </div>
              
              {weekModal.isUserPlan && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Week Number</label>
                  <input
                    type="number" min="1" required
                    value={weekModal.weekNumber}
                    onChange={(e) => setWeekModal(p => ({ ...p, weekNumber: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/40"
                  />
                </div>
              )}

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

              {dayModal.isUserPlan && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Notes / Instructions</label>
                  <textarea
                    placeholder="e.g. Focus on control, tempo 3-0-1"
                    value={dayModal.adminNotes || ''}
                    onChange={(e) => setDayModal(p => ({ ...p, adminNotes: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-black border border-white/8 text-white/85 text-xs focus:outline-none focus:border-[#39ff14]/40 h-20 resize-none"
                  />
                </div>
              )}

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
          isUserPlan={activeTab === 'personal_plans'}
          clientEquipment={(() => {
            if (activeTab !== 'personal_plans' || !clientEnrollment) return [];
            try {
              if (clientEnrollment.equipment) {
                return JSON.parse(clientEnrollment.equipment);
              }
            } catch {
              if (Array.isArray(clientEnrollment.equipment)) return clientEnrollment.equipment;
              if (typeof clientEnrollment.equipment === 'string') return clientEnrollment.equipment.split(',').map(s => s.trim());
            }
            return [];
          })()}
          onRefresh={() => {
            if (activeTab === 'personal_plans') {
              fetchClientData(selectedClientId);
            } else {
              fetchWeeks();
            }
          }}
          onClose={() => {
            setActiveExerciseDay(null);
            if (activeTab === 'personal_plans') {
              fetchClientData(selectedClientId);
            } else {
              fetchWeeks();
            }
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
