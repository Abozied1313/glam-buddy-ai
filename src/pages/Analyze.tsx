import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Navbar from "@/components/Layout/Navbar";

const Analyze = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [occasion, setOccasion] = useState("");
  const [gender, setGender] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });
  }, [navigate]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image || !occasion || !gender) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }

    setLoading(true);

    try {
      // Upload image to Supabase Storage
      const fileExt = image.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("analysis-images")
        .upload(fileName, image);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("analysis-images")
        .getPublicUrl(fileName);

      // Call analysis edge function
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "analyze-style",
        {
          body: {
            imageUrl: publicUrl,
            occasion,
            gender,
          },
        }
      );

      if (functionError) throw functionError;

      // Save analysis to database
      const { data: analysisData, error: dbError } = await supabase
        .from("style_analyses")
        .insert({
          user_id: user.id,
          image_url: publicUrl,
          occasion,
          gender,
          analysis_result: functionData,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      toast.success("تم التحليل بنجاح!");
      navigate(`/results/${analysisData.id}`);
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast.error(error.message || "حدث خطأ في التحليل");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 shadow-elegant">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold gradient-text mb-2">تحليل أسلوبك</h1>
              <p className="text-muted-foreground">ارفع صورتك واحصل على توصيات مخصصة</p>
            </div>

            <div className="space-y-6">
              {/* Image Upload */}
              <div className="space-y-2">
                <Label>الصورة</Label>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => document.getElementById("image-upload")?.click()}
                >
                  {preview ? (
                    <img
                      src={preview}
                      alt="Preview"
                      className="max-h-64 mx-auto rounded-lg"
                    />
                  ) : (
                    <div className="space-y-4">
                      <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                      <div>
                        <p className="font-medium">اضغط لرفع صورة</p>
                        <p className="text-sm text-muted-foreground">PNG, JPG حتى 10MB</p>
                      </div>
                    </div>
                  )}
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Gender Selection */}
              <div className="space-y-2">
                <Label>الجنس</Label>
                <Select value={gender} onValueChange={setGender} dir="rtl">
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الجنس" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">ذكر</SelectItem>
                    <SelectItem value="female">أنثى</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Occasion Selection */}
              <div className="space-y-2">
                <Label>المناسبة</Label>
                <Select value={occasion} onValueChange={setOccasion} dir="rtl">
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المناسبة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">يومي</SelectItem>
                    <SelectItem value="work">عمل</SelectItem>
                    <SelectItem value="formal">رسمي</SelectItem>
                    <SelectItem value="party">حفلة</SelectItem>
                    <SelectItem value="wedding">زفاف</SelectItem>
                    <SelectItem value="sport">رياضي</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="hero"
                size="lg"
                className="w-full"
                onClick={handleAnalyze}
                disabled={loading || !image || !occasion || !gender}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                    جاري التحليل...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 ml-2" />
                    تحليل الآن
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Analyze;
