import { useState } from "react";
import Navbar from "@/components/Layout/Navbar";
import Footer from "@/components/Layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Bot,
  Code2,
  Copy,
  FileText,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentMode = "style" | "image" | "workstation";

const modes: Array<{
  id: AgentMode;
  title: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  {
    id: "style",
    title: "Gemini style analysis",
    description: "استخدمه لصياغة أسئلة وتحسين مدخلات تحليل الستايل داخل مسار Supabase الحالي.",
    icon: Sparkles,
  },
  {
    id: "image",
    title: "Replicate image planning",
    description: "استخدمه لتحضير وصف الصورة والنتيجة المطلوبة قبل تشغيل توليد الصور.",
    icon: Wand2,
  },
  {
    id: "workstation",
    title: "Workstation reports",
    description: "استخدمه لفهم dashboard و recommendations و actions-center بدون تنفيذ أوامر.",
    icon: Code2,
  },
];

const promptPresets = [
  {
    title: "لخص تقرير الوكيل",
    icon: FileText,
    prompt:
      "الصق هنا تقرير dashboard أو recommendations. المطلوب: لخص أهم المشاكل، رتبها حسب الأولوية، واكتب الخطوة اليدوية التالية فقط.",
  },
  {
    title: "راجع OAuth بدون كسره",
    icon: ShieldCheck,
    prompt:
      "راجع معي مشكلة Google OAuth بدون تعديل Auth أو Supabase config. المطلوب: خطوات فحص آمنة فقط، وما الذي لا يجب لمسه.",
  },
  {
    title: "حضّر تحليل ستايل",
    icon: Sparkles,
    prompt:
      "ساعدني أصيغ طلب تحليل ستايل مناسب لمسار Gemini الحالي في Glam Buddy. لا تضف أي API جديد ولا تغيّر Replicate.",
  },
];

const initialMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "أهلا، دي واجهة Agent Center داخل Glam Buddy. الصفحة لا تتصل بـ Ollama ولا تفتح localhost. مسار الذكاء الحالي للتطبيق يظل Gemini/Lovable للتحليل و Replicate لتوليد الصور عبر Supabase Edge Functions.",
  },
];

const buildLocalReply = (input: string, mode: AgentMode) => {
  const normalized = input.toLowerCase();
  const sections: string[] = [];

  if (mode === "style") {
    sections.push("مسار الستايل الحالي: Supabase Auth ثم Edge Function analyze-style ثم Gemini/Lovable للتحليل. لا نحتاج إضافة Ollama هنا.");
    sections.push("أفضل خطوة: اكتب المناسبة، الجنس، ونوع النتيجة المطلوبة بوضوح، ثم ارفع الصورة من صفحة Analyze المعتادة.");
  }

  if (mode === "image") {
    sections.push("مسار الصور الحالي يعتمد على Replicate من الخلفية فقط. مفتاح Replicate يجب أن يبقى secret داخل Supabase وليس في الواجهة.");
    sections.push("أفضل خطوة: حضر prompt واضح للصورة النهائية، واترك التنفيذ للـ Edge Function الموجودة.");
  }

  if (mode === "workstation") {
    sections.push("تعامل مع تقارير الوكيل كقراءة فقط: ابدأ بـ Critical ثم High، وبعدها Medium و Low.");
    sections.push("أي أمر فيه install أو delete أو move أو git push/pull يحتاج موافقة صريحة منك خارج الصفحة.");
  }

  if (normalized.includes("oauth") || normalized.includes("google") || normalized.includes("جوجل")) {
    sections.push("بالنسبة لـ Google OAuth: لا تغيّر Auth.tsx أو إعدادات Supabase لمجرد اختبار صفحة الوكيل. افحص redirect URL و session timing فقط إذا ظهرت مشكلة دخول حقيقية.");
  }

  if (normalized.includes("ollama") || normalized.includes("qwen") || normalized.includes("كوين")) {
    sections.push("Qwen المحلي ممكن ندمجه لاحقا عبر bridge محلي منفصل، لكن هذه الصفحة لا تتصل به مباشرة حتى لا تتعطل بسبب CORS أو localhost endpoints.");
  }

  if (normalized.includes("تقرير") || normalized.includes("dashboard") || normalized.includes("actions") || normalized.includes("recommendations")) {
    sections.push("لو عندك تقرير، الصقه هنا أو في المحادثة القادمة وسأقسمه إلى: مطلوب الآن، اختياري، وما يجب تأجيله.");
  }

  if (sections.length === 0) {
    sections.push("اقتراحي الآمن: حدد هل سؤالك عن الستايل، الصور، OAuth، أو تقارير الوكيل. بعدها نمشي خطوة واحدة واضحة بدون تغيير تلقائي.");
  }

  return sections.map((section, index) => `${index + 1}. ${section}`).join("\n");
};

const Agent = () => {
  const [mode, setMode] = useState<AgentMode>("style");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  const selectedMode = modes.find((item) => item.id === mode) ?? modes[0];

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages([
      ...nextMessages,
      {
        role: "assistant",
        content: buildLocalReply(trimmed, mode),
      },
    ]);
    setInput("");
  };

  const copyBridgePrompt = async () => {
    const prompt = `Build a safe Glam Buddy agent bridge that uses the existing Supabase architecture. Do not change Google OAuth. Do not expose Replicate secrets in the frontend. Keep Gemini/Replicate as the production AI path. Add local Qwen only through an optional local bridge after explicit user approval.`;

    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("تم نسخ prompt الربط الآمن");
    } catch {
      toast.error("لم أستطع النسخ تلقائيا");
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
                آمن: لا أوامر ولا localhost
              </Badge>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold gradient-text">Agent Center</h1>
                <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
                  واجهة مساعدة داخل Glam Buddy لتنظيم التفكير حول Gemini و Replicate وتقارير الوكيل. الصفحة لا تستخدم Ollama مباشرة ولا تغير تسجيل الدخول.
                </p>
              </div>
            </div>

            <Card className="w-full lg:w-[380px] shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  مسار الذكاء الحالي
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground leading-7">
                <p>Supabase Auth يحافظ على الدخول.</p>
                <p>Gemini/Lovable يحلل الستايل داخل Edge Function.</p>
                <p>Replicate يولد الصور من الخلفية فقط.</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <aside className="space-y-4">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg">وضع المحادثة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {modes.map((item) => {
                    const Icon = item.icon;
                    const active = mode === item.id;
                    return (
                      <Button
                        key={item.id}
                        variant={active ? "default" : "outline"}
                        className="w-full justify-start h-auto py-3 text-right whitespace-normal"
                        onClick={() => setMode(item.id)}
                      >
                        <Icon className="h-4 w-4 ml-2" />
                        <span>
                          <span className="block font-semibold">{item.title}</span>
                          <span className="block text-xs opacity-80 mt-1">{item.description}</span>
                        </span>
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>

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
                    ملاحظة مهمة
                  </div>
                  <p>
                    دمج Qwen المحلي ممكن لاحقا عن طريق bridge محلي منفصل. هذه الصفحة حاليا لا تكسر OAuth ولا تستدعي أي endpoint محلي.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => void copyBridgePrompt()}>
                    <Copy className="h-4 w-4 ml-2" />
                    نسخ prompt الربط الآمن
                  </Button>
                </CardContent>
              </Card>
            </aside>

            <Card className="min-h-[640px] shadow-elegant flex flex-col overflow-hidden">
              <CardHeader className="border-b bg-card/80">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  {selectedMode.title}
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
                    placeholder="اكتب سؤالك عن Glam Buddy أو الصق ملخص تقرير الوكيل هنا..."
                    className="min-h-[110px] resize-none text-base leading-7"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">Ctrl + Enter للإرسال. الردود إرشادية فقط ولا تنفذ أي شيء.</p>
                    <Button onClick={sendMessage} disabled={!input.trim()} variant="hero">
                      <Send className="h-4 w-4 ml-2" />
                      إرسال
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
