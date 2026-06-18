import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chatApi } from '../../../shared/services/chatApi';
import { workoutApi } from '../../../shared/services/workoutApi';
import { subscriptionApi } from '../../../shared/services/subscriptionApi';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Toast from '../../../shared/components/ui/Toast';
import Loader from '../../../shared/components/ui/Loader';
import { useWebSocket } from '../../../shared/hooks/useWebSocket';

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [enrolledCourse, setEnrolledCourse] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchHistoryAndCourse = async () => {
    setLoading(true);
    setSubscriptionRequired(false);
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
        setMessages(historyRes.data.data?.messages || []);
      }
    } catch (err) {
      if (err.response?.status === 403 || err.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
        setSubscriptionRequired(true);
      } else {
        setToastMsg({ message: err.response?.data?.message || 'Failed to load chat history', type: 'error' });
        // Add a friendly welcome message if no logs exist or if load fails
        setMessages([
          {
            role: 'assistant',
            content: 'Hello! I am your JINNX Claude AI Coach. How can I help you with your training, diet, or recovery goals today?',
            createdAt: new Date().toISOString()
          }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      const res = await subscriptionApi.createRazorpaySubscription();
      if (res.data?.success) {
        setToastMsg({ message: 'Subscription request sent successfully!', type: 'success' });
        // Simulating immediate payment confirmation for developer convenience
        setTimeout(() => {
          setToastMsg({ message: 'Simulated payment success! Re-fetching chatbot status.', type: 'success' });
          fetchHistoryAndCourse();
        }, 1500);
      }
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to trigger subscription checkout', type: 'error' });
    }
  };

  useEffect(() => {
    fetchHistoryAndCourse();
  }, []);

  // Scroll to bottom whenever messages list changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── WebSocket: receive chat replies pushed from server ─────────────────────
  const handleWSMessage = useCallback((data) => {
    if (data.type === 'chat_reply' && data.reply) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply, createdAt: new Date().toISOString() },
      ]);
      setSending(false);
    } else if (data.type === 'chat_error') {
      setToastMsg({ message: data.error || 'Chat error', type: 'error' });
      setSending(false);
    }
  }, []);

  const { sendFrame, isConnected } = useWebSocket(handleWSMessage, !subscriptionRequired);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessageText = input.trim();
    setInput('');
    setSending(true);

    // Append user message locally for instant feedback
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessageText, createdAt: new Date().toISOString() },
    ]);

    // Try WebSocket first (real-time path)
    const sent = sendFrame({ action: 'chat', message: userMessageText });
    if (sent) {
      // setSending(false) will be called when chat_reply arrives via handleWSMessage
      return;
    }

    // Fallback: REST API when WS not connected
    try {
      const res = await chatApi.sendMessage(userMessageText);
      if (res.data?.success && res.data?.data?.reply) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: res.data.data.reply, createdAt: new Date().toISOString() },
        ]);
      } else {
        throw new Error('Invalid reply payload');
      }
    } catch (err) {
      setToastMsg({ message: err.response?.data?.message || 'Failed to send message', type: 'error' });
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

  if (subscriptionRequired) {
    return (
      <div className="max-w-2xl mx-auto py-12 animate-fade-in-up">
        <Card className="p-12 text-center text-white/30 space-y-6 bg-[#08080c] border-white/5">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-500 mx-auto text-2xl font-bold shadow-lg">
            🔒
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Premium Feature Locked</h4>
            <p className="text-xs text-white/45 max-w-sm mx-auto leading-relaxed">
              The Claude-powered AI Fitness & Nutrition Chatbot is exclusive to Premium members. Please subscribe to unlock instant expert coaching.
            </p>
          </div>
          <Button variant="neon" className="px-8 py-3 mx-auto uppercase font-black" onClick={handleSubscribe}>
            Upgrade to Premium
          </Button>
        </Card>
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
