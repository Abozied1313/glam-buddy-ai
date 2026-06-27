import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const [status, setStatus] = useState<"loading" | "unauthenticated" | "forbidden" | "allowed">("loading");

  useEffect(() => {
    let active = true;

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;

      if (!session?.user) {
        setStatus("unauthenticated");
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!active) return;
      if (error || !data) {
        setStatus("forbidden");
      } else {
        setStatus("allowed");
      }
    };

    check();
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/auth" replace />;
  }

  if (status === "forbidden") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4" dir="rtl">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-3xl font-bold">غير مصرح بالوصول</h1>
          <p className="text-muted-foreground">
            هذه الصفحة مخصصة للمسؤولين فقط. لا تتوفر لديك الصلاحيات اللازمة للاطلاع عليها.
          </p>
          <a href="/" className="inline-block text-primary underline">العودة إلى الصفحة الرئيسية</a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
