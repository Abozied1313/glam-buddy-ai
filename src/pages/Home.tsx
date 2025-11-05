import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Camera, Heart, Wand2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Layout/Navbar";
import logoImage from "@/assets/logo.jpeg";
import bg1 from "@/assets/bg-1.jpeg";
import bg2 from "@/assets/bg-2.jpeg";
import bg3 from "@/assets/bg-3.jpeg";
import bg4 from "@/assets/bg-4.jpeg";
import aiIcon from "@/assets/ai-analysis-icon.png";
import wardrobeIcon from "@/assets/wardrobe-icon.png";
import personalizedIcon from "@/assets/personalized-icon.png";

const Home = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: aiIcon,
      title: "تحليل ذكي بالـ AI",
      description: "تحليل متقدم لشكل وجهك وجسمك باستخدام الذكاء الاصطناعي",
    },
    {
      icon: wardrobeIcon,
      title: "توصيات ملابس مخصصة",
      description: "اقتراحات ملابس تناسب شكل جسمك والمناسبة المطلوبة",
    },
    {
      icon: personalizedIcon,
      title: "تسريحات شعر مميزة",
      description: "تسريحات شعر تناسب شكل وجهك وأسلوبك الشخصي",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${logoImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/80 to-background/95" />
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
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
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

      {/* Features Section */}
      <section id="features" className="relative py-20">
        <div
          className="absolute inset-0 z-0 opacity-10"
          style={{
            backgroundImage: `url(${bg2})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-background/90 z-0" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 animate-slide-up">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              لماذا <span className="gradient-text">The Special Style</span>؟
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              نستخدم أحدث تقنيات الذكاء الاصطناعي لتقديم توصيات موضة مخصصة لك
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="p-8 text-center hover:shadow-elegant transition-all duration-300 hover:-translate-y-2 gradient-card-bg border-border/50 animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center shadow-card">
                  <img src={feature.icon} alt={feature.title} className="w-16 h-16 object-contain" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-20">
        <div
          className="absolute inset-0 z-0 opacity-10"
          style={{
            backgroundImage: `url(${bg4})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-background/90 z-0" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              كيف <span className="gradient-text">يعمل؟</span>
            </h2>
          </div>

          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
            {[
              { icon: Camera, title: "التقط صورة", desc: "ارفع صورة واضحة لوجهك أو جسمك" },
              { icon: Wand2, title: "التحليل الذكي", desc: "الذكاء الاصطناعي يحلل ملامحك وشكلك" },
              { icon: Heart, title: "احصل على النتائج", desc: "توصيات مخصصة للملابس والشعر" },
            ].map((step, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full gradient-hero-bg flex items-center justify-center shadow-glow">
                  <step.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-hero-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            جاهز لاكتشاف أسلوبك المثالي؟
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            انضم لآلاف المستخدمين الذين حسّنوا أسلوبهم الشخصي معنا
          </p>
          <Button
            variant="secondary"
            size="xl"
            onClick={() => navigate("/auth")}
            className="shadow-2xl hover:scale-105 transition-transform"
          >
            ابدأ مجاناً الآن
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2024 The Special Style. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
