import { useMemo, useState } from "react";
import Navbar from "@/components/Layout/Navbar";
import Footer from "@/components/Layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Bot, Code2, FileText, Send, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const models = [
  {
    id: "qwen2.5:7b",
    label: "Qwen 2.5 7B",
    description: "للشرح بالعربي، تلخيص التقارير، وترتيب الأولويات.",
  },
  {
    id: "qwen2.5-coder:7b",
    label: "Qwen 2.5 Coder 7B",
    description: "لشرح الكود، مراجعة مشاريع Git، واقتراح إصلاحات بدون تنفيذ.",
  },
];

const promptPresets = [
  {
    title: "لخص حالة الوكيل",
    icon: FileText,
    prompt:
      "انت مساعد محلي آمن. اشرح لي بالعربي حالة AI Workstation Agent بناء على آخر dashboard/recommendations/actions-center ألصقها لك، وطلع أهم 3 خطوات فقط.",
  },
  {
    title: "راجع Actions Center",
    icon: Sparkles,
    prompt:
      "راجع قائمة Actions Center التي سأرسلها لك. رتبها حسب الأهمية، ووضح أيها اختياري وأيها ضروري. لا تقترح تنفيذ تلقائي.",
  },
  {
    title: "راجع مشروع كود",
    icon: Code2,
    prompt:
      "انت Qwen Coder كمستشار فقط. سأرسل لك git status أو مقطع كود. اشرح المخاطر واقترح patch conceptually بدون تنفيذ أوامر أو تعديل ملفات.",
  },
];

const safetySystemPrompt = `
You are a local AI advisor inside Glam Buddy for the AI Workstation Agent.
Rules:
- Read and explain only.
- Never claim you executed commands.
- Never instruct automatic deletion, installation, killing processes, commit, push, pull, checkout, or file moves.
- If an action is needed, present it as a manual user-approved step.
- Prefer Arabic explanations unless the user asks otherwise.
`.trim();

const Agent = () => {
  const [model, setModel] = useState("qwen2.5:7b");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "أهلا، أنا واجهة Glam Buddy للوكيل المحلي. أقدر أشرح تقارير الوكيل، أراجع توصياته، وأساعدك مع Qwen أو Qwen Coder. أنا لا أنفذ أوامر ولا أعدل ملفات.",
    },
  ]);
  const [isSending, setIsSending] = useState(false);

  const selectedModel = useMemo(() => models.find((item) => item.id === model) ?? models[0], [model]);

  const buildPrompt = (nextInput: string) => {
    const recentMessages = messages
      .slice(-6)
      .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
      .join("\n\n");

    return `${safetySystemPrompt}\n\nConversation so far:\n${recentMessages}\n\nUser: ${nextInput}\n\nAssistant:`;
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: buildPrompt(trimmed),
          stream: false,
          options: {
            temperature: 0.3,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}`);
      }

      const data = await response.json();
      const answer = data.response?.trim() || "لم يرجع الموديل ردا واضحا.";
      setMessages([...nextMessages, { role: "assistant", content: answer }]);
    } catch (error) {
      const details = error instanceof Error ? error.message : "Unknown error";
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            `لم أستطع الاتصال بـ Ollama من الواجهة. تأكد أن Ollama يعمل وأن الموديل ${model} موجود. ` +
            `لو ظهرت مشكلة CORS، شغل الواجهة من بيئة محلية مسموحة أو استخدم bridge محلي لاحقا. التفاصيل: ${details}`,
        },
      ]);
      toast.error("تعذر الاتصال بـ Ollama المحلي");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40 flex flex-col" dir="rtl">
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-16 flex-1">
        <section className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Badge variant="outline" className="w-fit gap-2 px-3 py-1">
                <ShieldCheck className="h-4 w-4 text-primary" />
                وضع آمن: استشارة فقط
              </Badge>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold gradient-text">Agent Chat</h1>
                <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
                  تحدث مع Qwen المحلي لشرح تقارير AI Workstation Agent ومراجعة الأكواد والتوصيات. الواجهة لا تنفذ أوامر ولا تغير ملفات.
                </p>
              </div>
            </div>

            <Card className="w-full lg:w-[360px] shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  الموديل المحلي
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الموديل" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">{selectedModel.description}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-4">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg">بدايات سريعة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {promptPresets.map((preset) => {
                    const Icon = preset.icon;
                    return (
                      <Button
                        key={preset.title}
                        variant="outline"
                        className="w-full justify-start h-auto py-3 text-right whitespace-normal"
                        onClick={() => setInput(preset.prompt)}
                      >
                        <Icon className="h-4 w-4 ml-2 text-primary" />
                        {preset.title}
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/5 shadow-card">
                <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <AlertTriangle className="h-4 w-4 text-primary" />
                    طريقة الاستخدام
                  </div>
                  <p>
                    شغل مهام الوكيل مثل dashboard أو actions-center، ثم الصق التقرير أو الملخص هنا. Qwen يشرحه ويرتب الخطوات، لكن القرار والتنفيذ يظل بإيدك.
                  </p>
                </CardContent>
              </Card>
            </aside>

            <Card className="min-h-[640px] shadow-elegant flex flex-col overflow-hidden">
              <CardHeader className="border-b bg-card/80">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Sparkles className="h-5 w-5 text-primary" />
                  محادثة الوكيل المحلي
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex flex-col flex-1">
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-muted/20">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`flex ${message.role === "user" ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm whitespace-pre-wrap ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-card border rounded-tl-sm"
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t p-4 space-y-3 bg-background">
                  <Textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="اكتب سؤالك أو الصق تقرير dashboard/actions-center هنا..."
                    className="min-h-[110px] resize-none text-base leading-7"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">Ctrl + Enter للإرسال. لا يوجد تنفيذ أوامر من داخل الشات.</p>
                    <Button onClick={() => void sendMessage()} disabled={isSending || !input.trim()} variant="hero">
                      <Send className="h-4 w-4 ml-2" />
                      {isSending ? "جاري التفكير..." : "إرسال"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Agent;
