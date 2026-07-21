"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCw, Send } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";

const list = (value) => Array.isArray(value) ? value : value?.results || [];

export default function ChatPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "SUPER_ADMIN";
  const memberships = useMemo(
    () => (user?.business_memberships || []).filter((item) => item.status === "ACTIVE"),
    [user]
  );

  const [threads, setThreads] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [threadId, setThreadId] = useState("");
  const [target, setTarget] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);

  const loadThreads = useCallback(async () => {
    const response = await api.get("/chat/threads/");
    const items = list(response.data);
    setThreads(items);
    setThreadId((current) => items.some((item) => String(item.id) === String(current))
      ? current : String(items[0]?.id || ""));
  }, []);

  const loadMessages = useCallback(async (id) => {
    if (!id) return setMessages([]);
    const response = await api.get(`/chat/threads/${id}/messages/`);
    setMessages(list(response.data));
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const start = async () => {
      try {
        const requests = [api.get("/chat/threads/")];
        if (isAdmin) requests.push(api.get("/chat/participants/"));
        const [threadResponse, participantResponse] = await Promise.all(requests);
        const items = list(threadResponse.data);
        setThreads(items);
        setThreadId(String(items[0]?.id || ""));
        setParticipants(list(participantResponse?.data));
        setBusinessId(String(memberships[0]?.business_id || ""));
      } catch {
        toast.error("Failed to load chat");
      } finally {
        setBusy(false);
      }
    };
    start();
  }, [user, isAdmin, memberships]);

  useEffect(() => {
    loadMessages(threadId).catch(() => toast.error("Failed to load messages"));
    if (!threadId) return;
    const timer = window.setInterval(() => {
      loadMessages(threadId).catch(() => {});
      loadThreads().catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [threadId, loadMessages, loadThreads]);

  const createThread = async () => {
    let payload;
    if (isAdmin) {
      if (!target) return toast.error("Select an owner or employee");
      const [selectedBusiness, member] = target.split(":");
      payload = { business_id: Number(selectedBusiness), member_id: Number(member) };
    } else {
      if (!businessId) return toast.error("Select a business");
      payload = { business_id: Number(businessId) };
    }
    try {
      const response = await api.post("/chat/threads/", payload);
      await loadThreads();
      setThreadId(String(response.data.id));
    } catch {
      toast.error("Could not start conversation");
    }
  };

  const send = async (event) => {
    event.preventDefault();
    if (!body.trim() || !threadId) return;
    try {
      setSending(true);
      await api.post(`/chat/threads/${threadId}/messages/`, { body: body.trim() });
      setBody("");
      await Promise.all([loadMessages(threadId), loadThreads()]);
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (loading || busy) return <main className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></main>;
  if (!user) return null;
  const selected = threads.find((item) => String(item.id) === String(threadId));
  const conversationName = (item) => {
    if (!item) return "Select a conversation";
    if (item.thread_type === "PLATFORM") return isAdmin ? item.member_name : "Platform Support";
    return item.member === user.id ? item.owner_name : item.member_name;
  };

  return (
    <DashboardLayout title="Support Chat" subtitle="Direct messages between business owners/team members and Super Admin.">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div><p className="text-sm font-bold uppercase text-blue-600">Messages</p><h1 className="mt-2 text-3xl font-black">Support Chat</h1></div>
        <button onClick={loadThreads} className="btn-secondary"><RefreshCw size={17} /> Refresh</button>
      </div>

      <div className="grid min-h-[650px] gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="card overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            {isAdmin ? (
              <select className="input" value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="">Select business owner or team member</option>
                {participants.map((item) => <option key={`${item.business_id}:${item.user_id}`} value={`${item.business_id}:${item.user_id}`}>{item.business_name} — {item.name} ({item.role})</option>)}
              </select>
            ) : (
              <select className="input" value={businessId} onChange={(event) => setBusinessId(event.target.value)}>
                <option value="">Select business</option>
                {memberships.map((item) => <option key={item.business_id} value={item.business_id}>{item.business_name} ({item.role})</option>)}
              </select>
            )}
            <button onClick={createThread} className="btn-primary mt-3 w-full"><Plus size={18} /> New Conversation</button>
          </div>
          <div className="max-h-[520px] overflow-y-auto p-3">
            {threads.length === 0 && (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                No conversation yet. Select a business or participant above and click New Conversation.
              </div>
            )}
            {threads.map((item) => (
              <button key={item.id} onClick={() => setThreadId(String(item.id))} className={`mb-2 w-full rounded-2xl p-4 text-left ${String(item.id) === String(threadId) ? "bg-blue-600 text-white" : "bg-slate-50"}`}>
                <div className="flex justify-between"><b>{conversationName(item)}</b>{item.unread_count > 0 && <span className="rounded-full bg-red-500 px-2 text-xs text-white">{item.unread_count}</span>}</div>
                <p className="mt-1 text-xs opacity-75">{item.business_name} · {item.thread_type === "PLATFORM" ? "PLATFORM SUPPORT" : "OWNER / EMPLOYEE"}</p>
                <p className="mt-2 truncate text-sm opacity-80">{item.last_message?.body || "No messages yet"}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="card flex min-h-[650px] flex-col overflow-hidden">
          <div className="border-b border-slate-200 p-5"><h2 className="font-black">{conversationName(selected)}</h2>{selected && <p className="text-sm text-slate-500">{selected.business_name} · {selected.thread_type === "PLATFORM" ? "Platform support" : "Private owner–employee chat"}</p>}</div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-5">
            {messages.map((message) => { const mine = message.sender === user.id; return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[80%] rounded-2xl px-4 py-3 ${mine ? "bg-blue-600 text-white" : "bg-white"}`}><p className="whitespace-pre-wrap text-sm">{message.body}</p><p className="mt-1 text-[11px] opacity-70">{message.sender_name} · {new Date(message.created_at).toLocaleString()}</p></div></div>; })}
          </div>
          <form onSubmit={send} className="flex gap-3 border-t border-slate-200 p-4"><input className="input" value={body} onChange={(event) => setBody(event.target.value)} disabled={!selected} placeholder="Write a message..." maxLength={4000} /><button className="btn-primary" disabled={!selected || sending}>{sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Send</button></form>
        </section>
      </div>
    </DashboardLayout>
  );
}
