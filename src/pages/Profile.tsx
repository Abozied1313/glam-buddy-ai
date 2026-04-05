import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, LogOut, Save } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Layout/Navbar";

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [analysesCount, setAnalysesCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);

  useEffect(() => {
    loadProfile();
    loadStats();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setProfile(profileData);
      setFullName(profileData?.full_name || "");
    } catch (error: any) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count: analysesCount } = await supabase
        .from("style_analyses")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { count: favoritesCount } = await supabase
        .from("favorites")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      setAnalysesCount(analysesCount || 0);
      setFavoritesCount(favoritesCount || 0);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("تم حفظ التغييرات بنجاح");
    } catch (error: any) {
      toast.error("حدث خطأ في الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج بنجاح");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold gradient-text mb-2">الملف الشخصي</h1>
            <p className="text-muted-foreground">إدارة حسابك ومعلوماتك</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <Card className="p-6 text-center shadow-elegant hover:shadow-glow transition-all">
              <div className="text-4xl font-bold gradient-text mb-2">
                {analysesCount}
              </div>
              <div className="text-muted-foreground">تحليل</div>
            </Card>
            <Card className="p-6 text-center shadow-elegant hover:shadow-glow transition-all">
              <div className="text-4xl font-bold gradient-text mb-2">
                {favoritesCount}
              </div>
              <div className="text-muted-foreground">مفضلة</div>
            </Card>
          </div>

          {/* Profile Form */}
          <Card className="p-8 shadow-elegant mb-6">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-20 h-20 rounded-full gradient-hero-bg flex items-center justify-center shadow-glow">
                <User className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{fullName || "مستخدم"}</h2>
                <p className="text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">الاسم الكامل</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  dir="rtl"
                  placeholder="أدخل اسمك الكامل"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email}
                  disabled
                  className="bg-muted"
                />
              </div>

              <Button
                variant="hero"
                className="w-full"
                size="lg"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 ml-2" />
                    حفظ التغييرات
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Logout Button */}
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 ml-2" />
            تسجيل الخروج
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
