import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Navbar from "@/components/Layout/Navbar";
import { ArrowRight, Mail, Loader2 } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    // Show OAuth errors (e.g., Google 403 / access_denied) if they come back in the URL
    // Supabase providers may return params via either querystring or hash.
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

    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/analyze");
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        if (!data.user?.email_confirmed_at) {
          toast.error("يرجى تأكيد بريدك الإلكتروني أولاً");
          await supabase.auth.signOut();
          return;
        }
        
        toast.success("تم تسجيل الدخول بنجاح!");
        navigate("/analyze");
      } else {
        const redirectUrl = `${window.location.origin}/auth`;
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: redirectUrl,
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
      console.log("Starting Google OAuth flow...");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        if (error.status === 403) {
          throw new Error("عذراً، ليس لديك صلاحية الوصول.");
        }
        throw new Error("حدث خطأ أثناء إعداد الاتصال، يرجى المحاولة لاحقاً.");
      }
    } catch (error: any) {
      console.error("Auth Error:", error.message);
      toast.error(error.message || "حدث خطأ في تسجيل الدخول عبر Google");
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
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
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="mb-4"
            >
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
                <Button
                  variant="outline"
                  onClick={resendConfirmation}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  إعادة إرسال رابط التأكيد
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEmailSent(false);
                    setIsLogin(true);
                  }}
                  className="w-full"
                >
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
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
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
                <p className="text-xs text-muted-foreground text-center">
                  تسجيل الدخول الاجتماعي المتاح حالياً: Google فقط. إذا ظهر خطأ 403 من Google فذلك يعني أن إعدادات Google غير مكتملة في الخلفية.
                </p>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  type="button"
                >
                  <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  المتابعة مع Google
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  disabled
                  aria-disabled="true"
                  title="غير متاح حالياً"
                >
                  <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
                    <path fill="#F25022" d="M1 1h10v10H1z"/>
                    <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                    <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                    <path fill="#FFB900" d="M13 13h10v10H13z"/>
                  </svg>
                  المتابعة مع Microsoft (غير متاح حالياً)
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  disabled
                  aria-disabled="true"
                  title="غير متاح حالياً"
                >
                  <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24" fill="#1877F2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  المتابعة مع Facebook (غير متاح حالياً)
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

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">الاسم الكامل</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="أدخل اسمك الكامل"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      dir="rtl"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button
                  type="submit"
                  variant="hero"
                  className="w-full"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري التحميل...
                    </>
                  ) : isLogin ? (
                    "تسجيل الدخول"
                  ) : (
                    "إنشاء حساب"
                  )}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {isLogin ? "ليس لديك حساب؟ " : "لديك حساب بالفعل؟ "}
                  <span className="text-primary font-semibold">
                    {isLogin ? "إنشاء حساب جديد" : "تسجيل الدخول"}
                  </span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;
