import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import Navbar from "@/components/Layout/Navbar";
import { ArrowRight, Mail, Loader2, Phone } from "lucide-react";
import PhoneLogin from "@/components/Auth/PhoneLogin";

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams((url.hash || "").replace(/^#/, ""));
    const q = url.searchParams;

    const oauthError = q.get("error") || hashParams.get("error");
    const oauthErrorDescription =
      q.get("error_description") || hashParams.get("error_description");

    if (oauthError) {
      let errorMessage = "حدث خطأ أثناء إعداد الاتصال، يرجى المحاولة لاحقاً.";
      if (oauthError === "access_denied" || oauthErrorDescription?.includes("denied")) {
        errorMessage = "عذراً، ليس لديك صلاحية الوصول.";
      } else if (oauthErrorDescription) {
        errorMessage = decodeURIComponent(oauthErrorDescription);
      }
      toast.error(errorMessage);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        navigate("/analyze", { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/analyze", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (!data.user?.email_confirmed_at) {
          toast.error("يرجى تأكيد بريدك الإلكتروني أولاً");
          await supabase.auth.signOut();
          return;
        }

        toast.success("تم تسجيل الدخول بنجاح!");
        navigate("/analyze", { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;

        setEmailSent(true);
        toast.success("تم إرسال رابط التأكيد إلى بريدك الإلكتروني");
      }
    } catch (error: any) {
      if (error.message.includes("User already registered")) {
        toast.error("هذا البريد الإلكتروني مسجل بالفعل");
      } else {
        toast.error(error.message || "حدث خطأ ما");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      setLoading(true);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
    } catch (error: any) {
      console.error("Google Auth Error:", error?.message || error);
      toast.error(error?.message || "حدث خطأ في تسجيل الدخول عبر Google");
      setLoading(false);
    }
  };

  const handleAppleLogin = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      setLoading(true);
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
    } catch (error: any) {
      console.error("Apple Auth Error:", error?.message || error);
      toast.error(error?.message || "حدث خطأ في تسجيل الدخول عبر Apple");
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      toast.success("تم إعادة إرسال رابط التأكيد");
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="max-w-md mx-auto">
            <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
              <ArrowRight className="w-4 h-4 ml-2" />
              العودة للرئيسية
            </Button>
            <Card className="shadow-elegant border-border/50 text-center">
              <CardHeader>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl gradient-text">تحقق من بريدك الإلكتروني</CardTitle>
                <CardDescription className="text-base">
                  تم إرسال رابط التأكيد إلى
                  <br />
                  <span className="font-semibold text-foreground">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  يرجى النقر على الرابط في البريد الإلكتروني لتأكيد حسابك والبدء في استخدام التطبيق
                </p>
                <Button variant="outline" onClick={resendConfirmation} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  إعادة إرسال رابط التأكيد
                </Button>
                <Button variant="ghost" onClick={() => { setEmailSent(false); setIsLogin(true); }} className="w-full">
                  العودة لتسجيل الدخول
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-md mx-auto">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
            <ArrowRight className="w-4 h-4 ml-2" />
            العودة للرئيسية
          </Button>
          
          <Card className="shadow-elegant border-border/50">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl gradient-text">
                {isLogin ? "مرحباً بعودتك" : "انضم إلينا"}
              </CardTitle>
              <CardDescription>
                {isLogin
                  ? "سجل دخولك للوصول إلى حسابك"
                  : "أنشئ حساباً جديداً لتبدأ رحلتك في الموضة"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Social Login Buttons */}
              <div className="space-y-3 mb-6">
                <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={loading} type="button">
                  <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  المتابعة مع Google
                </Button>

                <Button variant="outline" className="w-full" onClick={handleAppleLogin} disabled={loading} type="button">
                  <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  المتابعة مع Apple
                </Button>
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">أو</span>
                </div>
              </div>

              <Tabs defaultValue="email" dir="rtl" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    البريد الإلكتروني
                  </TabsTrigger>
                  <TabsTrigger value="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    رقم الهاتف
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="email">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="fullName">الاسم الكامل</Label>
                        <Input id="fullName" type="text" placeholder="أدخل اسمك الكامل" value={fullName} onChange={(e) => setFullName(e.target.value)} required dir="rtl" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="email">البريد الإلكتروني</Label>
                      <Input id="email" type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">كلمة المرور</Label>
                      <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                    </div>
                    <Button type="submit" variant="hero" className="w-full" size="lg" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                          جاري التحميل...
                        </>
                      ) : isLogin ? "تسجيل الدخول" : "إنشاء حساب"}
                    </Button>
                  </form>
                  <div className="mt-4 text-center">
                    <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {isLogin ? "ليس لديك حساب؟ " : "لديك حساب بالفعل؟ "}
                      <span className="text-primary font-semibold">
                        {isLogin ? "إنشاء حساب جديد" : "تسجيل الدخول"}
                      </span>
                    </button>
                  </div>
                </TabsContent>

                <TabsContent value="phone">
                  <PhoneLogin />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;
