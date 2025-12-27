import { Button } from "@/components/ui/button";
import { Sparkles, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Layout/Navbar";
import Footer from "@/components/Layout/Footer";
import logoImage from "@/assets/logo.webp";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden flex-1">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${logoImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-background/75 via-background/65 to-background/75" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10 text-center">
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">مساعدك الشخصي في الموضة</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              اكتشف أسلوبك المثالي مع
              <span className="gradient-text block mt-2">The Special Style</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              مستشار موضة ذكي يساعدك على اختيار الملابس وتسريحات الشعر المثالية لك
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button
                variant="hero"
                size="xl"
                onClick={() => navigate("/auth")}
                className="w-full sm:w-auto"
              >
                <Camera className="w-5 h-5 ml-2" />
                ابدأ التحليل الآن
              </Button>
              <Button
                variant="outline"
                size="xl"
                onClick={() => navigate("/features")}
                className="w-full sm:w-auto"
              >
                اكتشف المزيد
              </Button>
            </div>
          </div>
        </div>
        
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-primary/50 rounded-full p-1">
            <div className="w-1.5 h-3 bg-primary/50 rounded-full mx-auto" />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
