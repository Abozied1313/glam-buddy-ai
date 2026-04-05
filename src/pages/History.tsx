import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Navbar from "@/components/Layout/Navbar";
import { ArrowRight, Loader2, Trash2, Eye } from "lucide-react";

interface Analysis {
  id: string;
  created_at: string;
  occasion: string;
  gender: string;
  image_url: string;
  generated_image_url?: string;
}

const History = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  useEffect(() => {
    if (authReady && user) {
      loadAnalyses();
    }
  }, [authReady, user]);

  const loadAnalyses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("style_analyses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAnalyses(data || []);
    } catch (error: any) {
      toast.error("خطأ في تحميل السجل");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (analysisId: string) => {
    try {
      setDeleting(analysisId);
      const { error } = await supabase
        .from("style_analyses")
        .delete()
        .eq("id", analysisId)
        .eq("user_id", user.id);

      if (error) throw error;
      setAnalyses(analyses.filter(a => a.id !== analysisId));
      toast.success("تم حذف التحليل بنجاح");
    } catch (error: any) {
      toast.error("خطأ في حذف التحليل");
    } finally {
      setDeleting(null);
    }
  };

  if (!authReady || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
        <Navbar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
            >
              <ArrowRight className="w-4 h-4 ml-2" />
              العودة
            </Button>
            <h1 className="text-4xl font-bold gradient-text">سجل التحليلات</h1>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
          ) : analyses.length === 0 ? (
            <Card className="p-12 text-center shadow-elegant">
              <p className="text-lg text-muted-foreground mb-4">لا توجد تحليلات بعد</p>
              <Button
                onClick={() => navigate("/analyze")}
              >
                ابدأ التحليل الآن
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {analyses.map((analysis) => (
                <Card key={analysis.id} className="p-6 shadow-elegant hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                          {analysis.gender === "male" ? "ذكر" : "أنثى"}
                        </span>
                        <span className="px-3 py-1 bg-muted rounded-full text-sm font-medium">
                          {analysis.occasion === "casual" && "يومي"}
                          {analysis.occasion === "work" && "عمل"}
                          {analysis.occasion === "formal" && "رسمي"}
                          {analysis.occasion === "party" && "حفلة"}
                          {analysis.occasion === "wedding" && "زفاف"}
                          {analysis.occasion === "sport" && "رياضي"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(analysis.created_at).toLocaleDateString("ar-EG", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/results/${analysis.id}`)}
                      >
                        <Eye className="w-4 h-4 ml-2" />
                        عرض
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(analysis.id)}
                        disabled={deleting === analysis.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default History;
