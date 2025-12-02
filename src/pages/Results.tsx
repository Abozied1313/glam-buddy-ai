import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Heart, ArrowRight, Loader2, RefreshCw } from "lucide-react";
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
  const [regenerating, setRegenerating] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("analysis_id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      
      setIsFavorite(!!data);
    } catch (error) {
      console.error("Error checking favorite:", error);
    }
  };

  const toggleFavorite = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("يرجى تسجيل الدخول أولاً");
        return;
      }

      if (isFavorite) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("analysis_id", id)
          .eq("user_id", user.id);
        
        if (error) throw error;
        toast.success("تم الإزالة من المفضلة");
        setIsFavorite(false);
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ analysis_id: id, user_id: user.id });
        
        if (error) throw error;
        toast.success("تم الإضافة للمفضلة");
        setIsFavorite(true);
      }
    } catch (error: any) {
      console.error("Favorite error:", error);
      toast.error("حدث خطأ");
    }
  };

  const handleRegenerate = async () => {
    if (!analysis) return;
    
    setRegenerating(true);
    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "analyze-style",
        {
          body: {
            imageUrl: analysis.image_url,
            occasion: analysis.occasion,
            gender: analysis.gender,
            userId: user?.id,
            analysisId: analysis.id,
          },
        }
      );

      if (functionError) throw functionError;

      // Update analysis with new results
      const { error: updateError } = await supabase
        .from("style_analyses")
        .update({ 
          analysis_result: functionData,
          generated_image_url: functionData.generated_image_url,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Reload analysis
      await loadAnalysis();
      toast.success("تم إعادة التحليل بنجاح!");
    } catch (error: any) {
      console.error("Regenerate error:", error);
      toast.error(error.message || "حدث خطأ في إعادة التحليل");
    } finally {
      setRegenerating(false);
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
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <Button variant="ghost" onClick={() => navigate("/analyze")}>
              <ArrowRight className="w-4 h-4 ml-2" />
              تحليل جديد
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                {regenerating ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 ml-2" />
                )}
                إعادة التحليل
              </Button>
              <Button
                variant={isFavorite ? "default" : "outline"}
                onClick={toggleFavorite}
              >
                <Heart className={`w-4 h-4 ml-2 ${isFavorite ? "fill-current" : ""}`} />
                {isFavorite ? "في المفضلة" : "إضافة للمفضلة"}
              </Button>
            </div>
          </div>

          {/* Images */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card className="p-6 shadow-elegant">
              <h3 className="text-lg font-bold mb-4 text-center">صورتك</h3>
              <img
                src={analysis.image_url}
                alt="Your Photo"
                className="w-full max-h-80 object-contain rounded-lg"
              />
            </Card>
            
            {analysis.generated_image_url && (
              <Card className="p-6 shadow-elegant gradient-card-bg">
                <h3 className="text-lg font-bold mb-4 text-center gradient-text">التصميم المقترح</h3>
                <img
                  src={analysis.generated_image_url}
                  alt="Generated Style"
                  className="w-full max-h-80 object-contain rounded-lg"
                />
              </Card>
            )}
          </div>

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
