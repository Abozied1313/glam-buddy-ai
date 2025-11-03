import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Heart, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Layout/Navbar";

interface AnalysisResult {
  تحليل_المدخلات: string;
  توصيات_تسريحات_الشعر: Array<{
    التسريحة: string;
    الملاءمة: string;
  }>;
  توصيات_الملابس_والأطقم: Array<{
    القطعة: string;
    اللون: string;
    الخامة: string;
    السبب: string;
  }>;
  الأسلوب_والتنسيق_المقترح: string;
  ملاحظات_أخلاقية_وعملية: string;
}

const Results = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    loadAnalysis();
    checkFavorite();
  }, [id]);

  const loadAnalysis = async () => {
    try {
      const { data, error } = await supabase
        .from("style_analyses")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setAnalysis(data);
    } catch (error: any) {
      toast.error("خطأ في تحميل النتائج");
      navigate("/analyze");
    } finally {
      setLoading(false);
    }
  };

  const checkFavorite = async () => {
    try {
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("analysis_id", id)
        .single();
      setIsFavorite(!!data);
    } catch (error) {
      // Not in favorites
    }
  };

  const toggleFavorite = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isFavorite) {
        await supabase
          .from("favorites")
          .delete()
          .eq("analysis_id", id)
          .eq("user_id", user.id);
        toast.success("تم الإزالة من المفضلة");
        setIsFavorite(false);
      } else {
        await supabase
          .from("favorites")
          .insert({ analysis_id: id, user_id: user.id });
        toast.success("تم الإضافة للمفضلة");
        setIsFavorite(true);
      }
    } catch (error: any) {
      toast.error("حدث خطأ");
    }
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

  const result: AnalysisResult = analysis?.analysis_result;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <Button variant="ghost" onClick={() => navigate("/analyze")}>
              <ArrowLeft className="w-4 h-4 ml-2" />
              تحليل جديد
            </Button>
            <Button
              variant={isFavorite ? "default" : "outline"}
              onClick={toggleFavorite}
            >
              <Heart className={`w-4 h-4 ml-2 ${isFavorite ? "fill-current" : ""}`} />
              {isFavorite ? "في المفضلة" : "إضافة للمفضلة"}
            </Button>
          </div>

          {/* Image */}
          <Card className="p-6 mb-8 shadow-elegant">
            <img
              src={analysis.image_url}
              alt="Analysis"
              className="w-full max-h-96 object-contain rounded-lg"
            />
          </Card>

          {/* Analysis Summary */}
          <Card className="p-8 mb-8 shadow-elegant gradient-card-bg">
            <h2 className="text-2xl font-bold mb-4 gradient-text">تحليل الصورة</h2>
            <p className="text-muted-foreground leading-relaxed text-lg" dir="rtl">
              {result?.تحليل_المدخلات}
            </p>
          </Card>

          {/* Hairstyle Recommendations */}
          <Card className="p-8 mb-8 shadow-elegant">
            <h2 className="text-2xl font-bold mb-6 gradient-text">توصيات تسريحات الشعر</h2>
            <div className="grid gap-6">
              {result?.توصيات_تسريحات_الشعر?.map((item, index) => (
                <div
                  key={index}
                  className="p-6 rounded-lg bg-muted/50 border border-border hover:border-primary transition-colors"
                  dir="rtl"
                >
                  <h3 className="text-xl font-bold mb-2 text-primary">{item.التسريحة}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.الملاءمة}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Outfit Recommendations */}
          <Card className="p-8 mb-8 shadow-elegant">
            <h2 className="text-2xl font-bold mb-6 gradient-text">توصيات الملابس</h2>
            <div className="grid gap-6">
              {result?.توصيات_الملابس_والأطقم?.map((item, index) => (
                <div
                  key={index}
                  className="p-6 rounded-lg bg-gradient-to-br from-muted/30 to-muted/50 border border-border hover:border-secondary transition-all hover:shadow-md"
                  dir="rtl"
                >
                  <h3 className="text-xl font-bold mb-2 text-secondary">{item.القطعة}</h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-semibold">اللون:</span> {item.اللون}
                    </p>
                    <p>
                      <span className="font-semibold">الخامة:</span> {item.الخامة}
                    </p>
                    <p className="text-muted-foreground leading-relaxed mt-3">{item.السبب}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Styling Tips */}
          <Card className="p-8 mb-8 shadow-elegant gradient-card-bg">
            <h2 className="text-2xl font-bold mb-4 gradient-text">
              الأسلوب والتنسيق المقترح
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg" dir="rtl">
              {result?.الأسلوب_والتنسيق_المقترح}
            </p>
          </Card>

          {/* Practical Notes */}
          <Card className="p-8 shadow-elegant bg-primary/5">
            <h2 className="text-2xl font-bold mb-4 text-primary">ملاحظات عملية</h2>
            <p className="text-muted-foreground leading-relaxed" dir="rtl">
              {result?.ملاحظات_أخلاقية_وعملية}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Results;
