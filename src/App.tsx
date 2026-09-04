import { Suspense, lazy, useEffect, useRef } from "react";
import AuthCallback from "./pages/AuthCallback";
import AdminRoute from "./components/Auth/AdminRoute";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isNativeApp } from "@/lib/nativeAuth";

// Receives the session from the system browser via the app's custom URL scheme.
const NativeDeepLinkHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;
    let removeListener: (() => void) | undefined;

    const setup = async () => {
      const handle = await CapApp.addListener("appUrlOpen", async ({ url }) => {
        if (!url || !url.includes("auth/callback")) return;
        try {
          const parsed = new URL(url);
          const params = new URLSearchParams(
            (parsed.hash || "").replace(/^#/, "") || parsed.search.replace(/^\?/, ""),
          );
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          const code = params.get("code");

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
          } else if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
          } else {
            throw new Error("لم يتم استلام بيانات تسجيل الدخول");
          }

          toast.success("تم تسجيل الدخول بنجاح!");
          navigate("/analyze", { replace: true });
        } catch (error: any) {
          toast.error(error?.message || "حدث خطأ أثناء إتمام تسجيل الدخول");
        } finally {
          try {
            await Browser.close();
          } catch {
            // browser may already be closed
          }
        }
      });
      removeListener = () => handle.remove();
    };

    void setup();
    return () => removeListener?.();
  }, [navigate]);

  return null;
};


// Lazy load pages for better code splitting
const Home = lazy(() => import("./pages/Home"));
const Features = lazy(() => import("./pages/Features"));
const Auth = lazy(() => import("./pages/Auth"));
const Analyze = lazy(() => import("./pages/Analyze"));
const Results = lazy(() => import("./pages/Results"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const History = lazy(() => import("./pages/History"));
const Agent = lazy(() => import("./pages/Agent"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

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

const OAuthReturnHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const handledUrlRef = useRef("");

  useEffect(() => {
    if (location.pathname === "/auth/callback") return;

    const currentUrl = window.location.href;
    if (handledUrlRef.current === currentUrl) return;

    const url = new URL(currentUrl);
    const hashParams = new URLSearchParams((url.hash || "").replace(/^#/, ""));
    const accessToken = hashParams.get("access_token") || url.searchParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token") || url.searchParams.get("refresh_token");
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error") || hashParams.get("error");
    const errorDescription = url.searchParams.get("error_description") || hashParams.get("error_description");
    const hasOAuthReturn = Boolean(error || code || (accessToken && refreshToken));
    const hadPendingOAuth = window.sessionStorage.getItem(OAUTH_PENDING_KEY);

    if (!hasOAuthReturn && !hadPendingOAuth) return;
    handledUrlRef.current = currentUrl;

    let cancelled = false;

    const finishOAuthReturn = async () => {
      try {
        if (error) throw new Error(errorDescription || error);

        if (accessToken && refreshToken) {
          const { error: tokenSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (tokenSessionError) throw tokenSessionError;
        } else if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!cancelled && session?.user) {
          window.sessionStorage.removeItem(OAUTH_PENDING_KEY);
          cleanOAuthUrl();
          toast.success("تم تسجيل الدخول بنجاح!");
          navigate("/analyze", { replace: true });
          return;
        }

        if (hadPendingOAuth) {
          throw new Error("لم يتم إنشاء جلسة تسجيل الدخول، يرجى المحاولة مرة أخرى");
        }
      } catch (oauthError: any) {
        if (cancelled) return;
        window.sessionStorage.removeItem(OAUTH_PENDING_KEY);
        cleanOAuthUrl();
        toast.error(oauthError?.message || "حدث خطأ أثناء إتمام عملية تسجيل الدخول");
        navigate("/auth", { replace: true });
      }
    };

    void finishOAuthReturn();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
};

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <OAuthReturnHandler />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* OAuth callback must be handled first and outside any protection */}
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/" element={<Home />} />
            <Route path="/features" element={<Features />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/results/:id" element={<Results />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/history" element={<History />} />
            <Route path="/agent" element={<AdminRoute><Agent /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
