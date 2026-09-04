import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { handoffSessionToNativeApp } from "@/lib/nativeAuth";

const OAUTH_PENDING_KEY = "the-special-style.oauth.pending";

const OAUTH_CLEANUP_KEYS = [
  "access_token",
  "refresh_token",
  "expires_at",
  "expires_in",
  "token_type",
  "provider_token",
  "provider_refresh_token",
  "code",
  "state",
  "type",
  "error",
  "error_code",
  "error_description",
];

const cleanOAuthUrl = () => {
  const url = new URL(window.location.href);
  OAUTH_CLEANUP_KEYS.forEach((key) => url.searchParams.delete(key));

  const hashParams = new URLSearchParams((url.hash || "").replace(/^#/, ""));
  OAUTH_CLEANUP_KEYS.forEach((key) => hashParams.delete(key));
  const nextHash = hashParams.toString();

  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${nextHash ? `#${nextHash}` : ""}`,
  );
};

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;
    let completed = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const finishSuccess = async () => {
      if (!isActive || completed) return;
      completed = true;
      if (timeoutId) clearTimeout(timeoutId);
      window.sessionStorage.removeItem(OAUTH_PENDING_KEY);
      const { data: { session } } = await supabase.auth.getSession();
      if (handoffSessionToNativeApp(session as any)) return;
      cleanOAuthUrl();
      toast.success("تم تسجيل الدخول بنجاح!");
      navigate("/analyze", { replace: true });
    };

    const finishError = (message?: string) => {
      if (!isActive || completed) return;
      completed = true;
      if (timeoutId) clearTimeout(timeoutId);
      window.sessionStorage.removeItem(OAUTH_PENDING_KEY);
      cleanOAuthUrl();
      toast.error(message || "حدث خطأ أثناء إتمام عملية تسجيل الدخول");
      navigate("/auth", { replace: true });
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        finishSuccess();
      }
    });

    timeoutId = setTimeout(() => {
      finishError("انتهت مهلة تسجيل الدخول، يرجى المحاولة مرة أخرى");
    }, 15000);

    const handleAuthCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
        const code = params.get("code");
        const error = params.get("error") || hashParams.get("error");
        const error_description = params.get("error_description") || hashParams.get("error_description");

        if (error) {
          throw new Error(error_description || error);
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const accessToken = hashParams.get("access_token") || params.get("access_token");
        const refreshToken = hashParams.get("refresh_token") || params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: tokenSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (tokenSessionError) throw tokenSessionError;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session) {
          finishSuccess();
          return;
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (user) {
          finishSuccess();
          return;
        }

        throw new Error("لم يتم إنشاء جلسة تسجيل الدخول، يرجى المحاولة مرة أخرى");
      } catch (error: any) {
        finishError(error.message);
      }
    };

    handleAuthCallback();

    return () => {
      isActive = false;
      subscription.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
        <h2 className="text-2xl font-semibold gradient-text">جاري التحقق من الهوية...</h2>
        <p className="text-muted-foreground">يرجى الانتظار لحظة بينما ننهي عملية تسجيل دخولك.</p>
      </div>
    </div>
  );
};

export default AuthCallback;
