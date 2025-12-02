import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Loader2, Eye, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Layout/Navbar";

const Favorites = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<any[]>([]);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("favorites")
        .select(`
          id,
          created_at,
          analysis:style_analyses (
            id,
            image_url,
            occasion,
            gender,
            created_at
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (error: any) {
      toast.error("خطأ في تحميل المفضلة");
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (favoriteId: string) => {
    try {
      await supabase.from("favorites").delete().eq("id", favoriteId);
      toast.success("تم الإزالة من المفضلة");
      setFavorites(favorites.filter((f) => f.id !== favoriteId));
    } catch (error: any) {
      toast.error("حدث خطأ");
    }
  };

  const getOccasionLabel = (occasion: string) => {
    const labels: Record<string, string> = {
      casual: "يومي",
      work: "عمل",
      formal: "رسمي",
      party: "حفلة",
      wedding: "زفاف",
      sport: "رياضي",
    };
    return labels[occasion] || occasion;
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
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate("/analyze")}
            className="mb-6"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            العودة للتحليل
          </Button>

          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold gradient-text mb-4">
              إطلالاتك المفضلة
            </h1>
            <p className="text-muted-foreground text-lg">
              جميع التحليلات التي قمت بحفظها
            </p>
          </div>

          {favorites.length === 0 ? (
            <Card className="p-12 text-center shadow-elegant">
              <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-bold mb-2">لا توجد مفضلات بعد</h2>
              <p className="text-muted-foreground mb-6">
                ابدأ بتحليل صورك وحفظ الإطلالات المفضلة لديك
              </p>
              <Button variant="hero" onClick={() => navigate("/analyze")}>
                ابدأ التحليل الآن
              </Button>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map((favorite) => (
                <Card
                  key={favorite.id}
                  className="overflow-hidden hover:shadow-elegant transition-all duration-300 group"
                >
                  <div className="relative aspect-square overflow-hidden">
                    <img
                      src={favorite.analysis.image_url}
                      alt="Analysis"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                        {getOccasionLabel(favorite.analysis.occasion)}
                      </span>
                      <span>
                        {new Date(favorite.created_at).toLocaleDateString("ar")}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="hero"
                        className="flex-1"
                        onClick={() => navigate(`/results/${favorite.analysis.id}`)}
                      >
                        <Eye className="w-4 h-4 ml-2" />
                        عرض
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => removeFavorite(favorite.id)}
                      >
                        <Heart className="w-4 h-4 fill-current" />
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

export default Favorites;
