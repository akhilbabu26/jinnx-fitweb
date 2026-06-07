import React, { useState, useEffect, useRef } from 'react';
import { chatApi } from '../../../shared/services/chatApi';
import { workoutApi } from '../../../shared/services/workoutApi';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Toast from '../../../shared/components/ui/Toast';
import Loader from '../../../shared/components/ui/Loader';

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [enrolledCourse, setEnrolledCourse] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const messagesEndRef = useRef(null);

  const fetchHistoryAndCourse = async () => {
    setLoading(true);
    try {
      // 1. Fetch active course to customize advice
      try {
        const courseRes = await workoutApi.getEnrolledCourse();
        if (courseRes.data?.success) {
          setEnrolledCourse(courseRes.data.data);
        }
      } catch (e) {
        console.error('No active course enrollment found for chat customization', e);
      }

      // 2. Fetch history
      const historyRes = await chatApi.getHistory();
      if (historyRes.data?.success) {
        setMessages(historyRes.data.data || []);
      }
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to load chat history', type: 'error' });
      // Add a friendly welcome message if no logs exist or if load fails
      setMessages([
        {
          role: 'assistant',
          content: 'Hello! I am your JINNX Claude AI Coach. How can I help you with your training, diet, or recovery goals today?',
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryAndCourse();
  }, []);

  // Scroll to bottom whenever messages list changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessageText = input;
    setInput('');
    setSending(true);

    // Append user message locally
    const newUserMsg = {
      role: 'user',
      content: userMessageText,
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, newUserMsg]);

    try {
      const res = await chatApi.sendMessage(userMessageText);
      if (res.data?.success && res.data?.data?.reply) {
        const assistantMsg = {
          role: 'assistant',
          content: res.data.data.reply,
          createdAt: new Date().toISOString()
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error('Invalid reply payload');
      }
    } catch (err) {
      console.warn('API Chat failed, triggering smart local coaching response:', err);
      // Smart coach response fallback based on selected course
      let replyContent = 'That is a great question. Make sure you are maintaining consistent sleep (7-9 hours), drinking adequate water (3-4L), and logging your daily reps to track progressive overload.';
      
      const courseSlug = enrolledCourse?.slug?.toLowerCase() || '';
      const textLower = userMessageText.toLowerCase();

      if (courseSlug === 'hypertrophy') {
        if (textLower.includes('protein') || textLower.includes('diet') || textLower.includes('eat')) {
          replyContent = 'For hypertrophy (muscle growth), aim for 1.6 to 2.2 grams of protein per kilogram of body weight daily. Space this out across 3-5 meals to optimize muscle protein synthesis. Keep a slight caloric surplus of 200-300 calories if building mass.';
        } else if (textLower.includes('volume') || textLower.includes('sets') || textLower.includes('rep')) {
          replyContent = 'For maximum hypertrophy, target 10-20 weekly sets per muscle group. Keep your reps mostly in the 8-12 range, taken close to failure (RPE 8-9 or 1-2 reps in reserve). Focus on the mind-muscle connection during the eccentric (lowering) phase.';
        } else {
          replyContent = 'In the Hypertrophy course, focus on progressive volume overload. If you ever feel stuck, consider switching to an alternative exercise that targets the same muscle or dropping weight to improve form.';
        }
      } else if (courseSlug === 'strength') {
        if (textLower.includes('squat') || textLower.includes('bench') || textLower.includes('deadlift') || textLower.includes('lift')) {
          replyContent = 'To build absolute strength in the Big 3 lifts, prioritize lower volume but higher intensity (80-90% of your 1RM). Keep reps in the 3-5 range, and rest 3 to 5 full minutes between working sets so your ATP reserves fully recover.';
        } else if (textLower.includes('pain') || textLower.includes('hurt') || textLower.includes('sore')) {
          replyContent = 'Heavy strength lifting places high stress on the central nervous system and joints. If you feel localized joint pain, stop immediately. Focus on core bracing (Valsalva maneuver) and check your joint alignment (e.g. knees tracking with toes).';
        } else {
          replyContent = 'For strength adaptations, consistency is key. Focus on high-quality sets with clean technique. Avoid training to failure too frequently, as it can overtax your nervous system.';
        }
      } else if (courseSlug === 'endurance') {
        if (textLower.includes('run') || textLower.includes('cardio') || textLower.includes('distance')) {
          replyContent = 'To improve endurance, apply the 80/20 rule: 80% of your workouts should be at low intensity (Zone 2, conversational pace) to build mitochondrial density. Only 20% should be high-intensity tempo or interval runs.';
        } else if (textLower.includes('cramp') || textLower.includes('hydrate') || textLower.includes('water')) {
          replyContent = 'Stamina relies heavily on electrolyte balance. Hydrate well before your sessions. For runs exceeding 60 minutes, supplement with sodium, potassium, and easy-to-digest carbohydrates (30-60g per hour) to maintain glycogen levels.';
        } else {
          replyContent = 'Endurance training is about aerobic conditioning. Keep your breathing steady and build mileage slowly (no more than a 10% weekly increase) to prevent shin splints or stress fractures.';
        }
      }

      // Simulated typing delay
      setTimeout(() => {
        const assistantMsg = {
          role: 'assistant',
          content: `${replyContent} (Note: Running in local coach mode)`,
          createdAt: new Date().toISOString()
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setSending(false);
      }, 800);
      return;
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-fade-in-up">
      {toastMsg && (
        <Toast message={toastMsg.message} type={toastMsg.type} onClose={() => setToastMsg(null)} />
      )}

      {/* Top Header info */}
      <div className="bg-[#08080c] border border-white/5 p-4 rounded-t-2xl flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl flex items-center justify-center font-bold text-lg">
            🤖
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              Claude AI Assistant
              <span className="w-2 h-2 rounded-full bg-[#39ff14] animate-ping" />
            </div>
            <div className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">
              {enrolledCourse ? `Coach calibrated: ${enrolledCourse.name}` : 'General Coaching Assistant'}
            </div>
          </div>
        </div>
        <div className="text-xs text-white/30 font-medium">Daily Limit: 20 messages</div>
      </div>

      {/* Messages area */}
      <div className="flex-grow bg-[#050508]/60 border-x border-white/5 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-scale-in`}>
              <div className={`flex gap-3 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-black text-xs shrink-0 ${
                  isUser 
                    ? 'bg-[#10170d] border-[#22441b] text-[#39ff14]' 
                    : 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                }`}>
                  {isUser ? 'U' : 'AI'}
                </div>

                {/* Message Bubble */}
                <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
                  isUser 
                    ? 'bg-gradient-to-br from-[#121c0e] to-[#0a1207] border border-[#22441b]/60 text-white/90 rounded-tr-none' 
                    : 'bg-[#08080c] border border-white/5 text-white/80 rounded-tl-none'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <span className="block text-[8px] text-white/20 text-right mt-2 font-mono">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex justify-start">
            <div className="flex gap-3 max-w-[80%]">
              <div className="w-8 h-8 rounded-full bg-purple-500/15 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0">
                AI
              </div>
              <div className="bg-[#08080c] border border-white/5 p-4 rounded-2xl rounded-tl-none flex items-center gap-1.5 py-3">
                <span className="w-1.5 h-1.5 bg-[#39ff14] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-[#39ff14] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-[#39ff14] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input controls form */}
      <form onSubmit={handleSend} className="bg-[#08080c] border border-white/5 p-4 rounded-b-2xl flex gap-3 shadow-md">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={sending ? 'Coach is analyzing...' : 'Ask your coach about protein targets, rest times, recovery, form alternatives...'}
          className="flex-grow bg-[#050508] border border-white/5 px-4 py-3 text-xs rounded-xl focus:outline-none focus:border-[#39ff14]/30 text-white placeholder-white/20"
          disabled={sending}
        />
        <Button
          type="submit"
          variant="neon"
          className="px-6 py-3 font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(57,255,20,0.1)] shrink-0"
          disabled={sending || !input.trim()}
        >
          Send Message
        </Button>
      </form>
    </div>
  );
}
