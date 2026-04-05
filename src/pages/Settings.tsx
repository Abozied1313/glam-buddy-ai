import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Navbar from "@/components/Layout/Navbar";
import { ArrowRight, Bell, Lock, Eye, Trash2, LogOut, Shield } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [privateProfile, setPrivateProfile] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || user) return;
    navigate("/auth", { replace: true });
  }, [authReady, navigate, user]);

  if (!authReady || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
        <Navbar />
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("تم تسجيل الخروج بنجاح");
      navigate("/", { replace: true });
    } catch (error: any) {
      toast.error(error.message || "خطأ في تسجيل الخروج");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setLoading(true);
      // Delete user data from database first
      const { error: dbError } = await supabase
        .from("style_analyses")
        .delete()
        .eq("user_id", user.id);

      if (dbError) throw dbError;

      // Delete user account
      const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
      if (authError) throw authError;

      toast.success("تم حذف حسابك بنجاح");
      navigate("/", { replace: true });
    } catch (error: any) {
      toast.error(error.message || "خطأ في حذف الحساب");
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
            >
              <ArrowRight className="w-4 h-4 ml-2" />
              العودة
            </Button>
            <h1 className="text-4xl font-bold gradient-text">الإعدادات</h1>
          </div>

          {/* Account Section */}
          <Card className="p-6 mb-6 shadow-elegant">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Shield className="w-6 h-6" />
              حسابك
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">البريد الإلكتروني</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">تاريخ الانضمام</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(user?.created_at).toLocaleDateString("ar-EG")}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Privacy Section */}
          <Card className="p-6 mb-6 shadow-elegant">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Lock className="w-6 h-6" />
              الخصوصية
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5" />
                  <div>
                    <p className="font-medium">ملف شخصي خاص</p>
                    <p className="text-sm text-muted-foreground">إخفاء بيانات ملفك الشخصي</p>
                  </div>
                </div>
                <Switch
                  checked={privateProfile}
                  onCheckedChange={setPrivateProfile}
                />
              </div>
            </div>
          </Card>

          {/* Notifications Section */}
          <Card className="p-6 mb-6 shadow-elegant">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Bell className="w-6 h-6" />
              الإشعارات
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">تفعيل الإشعارات</p>
                  <p className="text-sm text-muted-foreground">استقبل تحديثات حول تحليلاتك</p>
                </div>
                <Switch
                  checked={notifications}
                  onCheckedChange={setNotifications}
                />
              </div>
            </div>
          </Card>

          {/* Danger Zone */}
          <Card className="p-6 border-red-200 bg-red-50 dark:bg-red-950/20 shadow-elegant">
            <h2 className="text-2xl font-bold mb-6 text-red-600">منطقة الخطر</h2>

            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full justify-start text-red-600 hover:text-red-700"
                onClick={handleLogout}
                disabled={loading}
              >
                <LogOut className="w-5 h-5 ml-2" />
                تسجيل الخروج
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start text-red-600 hover:text-red-700"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
              >
                <Trash2 className="w-5 h-5 ml-2" />
                حذف الحساب نهائياً
              </Button>
            </div>
          </Card>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <Card className="max-w-sm w-full p-6">
                <h3 className="text-xl font-bold mb-4">حذف الحساب</h3>
                <p className="text-muted-foreground mb-6">
                  هل أنت متأكد من رغبتك في حذف حسابك؟ سيتم حذف جميع بيانات التحليل الخاصة بك بشكل نهائي.
                </p>
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={loading}
                  >
                    إلغاء
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleDeleteAccount}
                    disabled={loading}
                  >
                    {loading ? "جاري الحذف..." : "حذف"}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
