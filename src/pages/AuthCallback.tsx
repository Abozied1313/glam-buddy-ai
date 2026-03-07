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
        // Supabase automatically handles the hash/query params and sets the session
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (data.session) {
          toast.success("تم تسجيل الدخول بنجاح!");
          navigate("/analyze");
        } else {
          // If no session is found yet, we might be in the middle of a redirect or
          // there might be an error in the URL that hasn't been processed.
          // We'll wait for onAuthStateChange to pick it up or timeout.
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" && session) {
              toast.success("تم تسجيل الدخول بنجاح!");
              subscription.unsubscribe();
              navigate("/analyze");
            }
          });

          // Fallback timeout
          const timer = setTimeout(() => {
            subscription.unsubscribe();
            navigate("/auth");
          }, 5000);

          return () => {
            subscription.unsubscribe();
            clearTimeout(timer);
          };
        }
      } catch (error: any) {
        console.error("Error during auth callback:", error);
        toast.error("حدث خطأ أثناء إتمام عملية تسجيل الدخول");
        navigate("/auth");
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
