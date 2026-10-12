import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Shirt, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuota, notifyQuotaChanged } from "@/hooks/useQuota";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const FashionChat = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { quota } = useQuota();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const exhausted = quota ? quota.chatLeft <= 0 : false;

  useEffect(() => {
    supabase.from("chat_messages").select("role, content").order("created_at").limit(100).then(({ data, error }) => {
      if (error) toast.error("تعذر تحميل المحادثة");
      else setMessages((data || []) as Msg[]);
    });
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy || exhausted) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fashion-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "تعذر الرد الآن");
      }
      notifyQuotaChanged();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "", acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
          try {
            acc += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content || "";
            setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: acc }]);
          } catch { /* partial line */ }
        }
      }
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      toast.error(e instanceof Error ? e.message : "تعذر الرد الآن");
    } finally {
      setBusy(false);
      notifyQuotaChanged();
      inputRef.current?.focus();
    }
  };

  const reset = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("chat_messages").delete().eq("user_id", user.id);
    if (error) toast.error("تعذر بدء محادثة جديدة");
    else setMessages([]);
  };

  return (
    <Card className="p-6 shadow-elegant mt-8" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2"><Shirt className="w-5 h-5 text-primary" /> مستشار الموضة</h2>
        <div className="flex items-center gap-2">
          {quota && <span className="text-sm text-muted-foreground">{quota.chatLeft}/{quota.chatLimit} رسالة متبقية اليوم</span>}
          <Button variant="ghost" size="sm" onClick={reset} disabled={busy || !messages.length}><RotateCcw className="w-4 h-4 ml-1" /> محادثة جديدة</Button>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto space-y-3 mb-4">
        {!messages.length && <p className="text-sm text-muted-foreground">اسألني عن تنسيق الألوان، أو ماذا ألبس لمقابلة عمل، أو كيف أنسق قطعة عندي. الردود نصية فقط؛ لرؤية الإطلالة استخدم زر "ولّد إطلالتي".</p>}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-start" : "flex justify-end"}>
            <div className={m.role === "user" ? "max-w-[85%] rounded-2xl px-4 py-2 bg-primary text-primary-foreground" : "max-w-[90%] text-foreground prose prose-sm"}>
              {m.content ? (m.role === "assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content) : <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {exhausted && <p className="text-sm text-destructive mb-2">انتهت رسائلك لليوم (15 رسالة). يتجدد الرصيد تلقائياً خلال 24 ساعة.</p>}
      <div className="flex gap-2 items-end">
        <Textarea ref={inputRef} autoFocus value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} disabled={exhausted}
          placeholder="اكتب سؤالك عن الموضة..." className="min-h-12 resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        <Button onClick={send} disabled={busy || exhausted || !input.trim()} size="icon" aria-label="إرسال">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </Card>
  );
};

export default FashionChat;
