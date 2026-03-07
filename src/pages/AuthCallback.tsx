import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle PKCE code exchange if present
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const error = params.get("error");
        const error_description = params.get("error_description");

        if (error) {
          throw new Error(error_description || error);
        }

        if (code) {
          console.log("Exchanging code for session...");
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        // Supabase handles hash fragments automatically, but we ensure we have a session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (session) {
          console.log("Session established successfully");
          toast.success("تم تسجيل الدخول بنجاح!");
          navigate("/analyze", { replace: true });
        } else {
          console.log("No session found, listening for auth state change...");
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("Auth event:", event);
            if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
              toast.success("تم تسجيل الدخول بنجاح!");
              subscription.unsubscribe();
              navigate("/analyze", { replace: true });
            }
          });

          // Fallback timeout
          const timer = setTimeout(() => {
            subscription.unsubscribe();
            console.log("Auth callback timed out");
            navigate("/auth", { replace: true });
          }, 10000);

          return () => {
            subscription.unsubscribe();
            clearTimeout(timer);
          };
        }
      } catch (error: any) {
        console.error("Error during auth callback:", error.message);
        toast.error(error.message || "حدث خطأ أثناء إتمام عملية تسجيل الدخول");
        navigate("/auth", { replace: true });
      }
    };

    handleAuthCallback();
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
