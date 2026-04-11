import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { streamChat } from "@/lib/ai-stream";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Loader2, Plus, MessageSquare, Trash2, Menu, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };
interface ChatSession { id: string; title: string; created_at: string }

export default function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load sessions
  useEffect(() => {
    if (!user) return;
    supabase
      .from("chat_sessions")
      .select("id, title, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setSessions(data); });
  }, [user]);

  // Load messages when session changes
  useEffect(() => {
    if (!activeSessionId || !user) { setMessages([]); return; }
    supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", activeSessionId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
      });
  }, [activeSessionId, user]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const createSession = useCallback(async (firstMsg?: string) => {
    if (!user) return null;
    const title = firstMsg ? firstMsg.slice(0, 50) + (firstMsg.length > 50 ? "…" : "") : "New Chat";
    const { data } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title })
      .select("id, title, created_at")
      .single();
    if (data) {
      setSessions(prev => [data, ...prev]);
      setActiveSessionId(data.id);
      setMessages([]);
      setSidebarOpen(false);
      return data.id;
    }
    return null;
  }, [user]);

  const deleteSession = async (id: string) => {
    await supabase.from("chat_sessions").delete().eq("id", id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) { setActiveSessionId(null); setMessages([]); }
  };

  const send = async () => {
    if (!input.trim() || isLoading || !user) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    setInput("");

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = await createSession(userMsg.content);
      if (!sessionId) return;
    }

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        mode: "chat",
        onDelta: upsertAssistant,
        onDone: () => setIsLoading(false),
      });
      await supabase.from("chat_messages").insert([
        { user_id: user.id, role: "user", content: userMsg.content, session_id: sessionId },
        { user_id: user.id, role: "assistant", content: assistantSoFar, session_id: sessionId },
      ]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message}` }]);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 sm:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed sm:static z-40 h-full w-72 bg-card border-r flex flex-col transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"}`}>
        <div className="p-3 border-b flex items-center justify-between">
          <span className="font-heading font-semibold text-sm">Chat History</span>
          <Button size="icon" variant="ghost" onClick={() => { createSession(); }} title="New Chat">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessions.map(s => (
              <div
                key={s.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                  activeSessionId === s.id ? "bg-secondary/15 text-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => { setActiveSessionId(s.id); setSidebarOpen(false); }}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1">{s.title}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">No chats yet</p>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="gradient-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="sm:hidden text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-heading font-semibold truncate">AI Assistant</h1>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10 gap-1" onClick={() => createSession()}>
              <Plus className="h-4 w-4" /> New Chat
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground mt-20">
              <p className="text-lg font-heading font-semibold">Hi! I'm your AI teaching assistant 👋</p>
              <p className="mt-2 text-sm">Ask me anything about your subjects</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                m.role === "user"
                  ? "bg-secondary text-secondary-foreground rounded-br-md"
                  : "bg-card border rounded-bl-md"
              }`}>
                {m.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{m.content}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="bg-card border rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t bg-card px-4 py-3">
          <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2 max-w-3xl mx-auto">
            <Input
              placeholder="Ask your AI teacher..."
              value={input}
              onChange={e => setInput(e.target.value)}
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" className="bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
