import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Camera, Zap, Shield, Palette, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Layout/Navbar";
import Footer from "@/components/Layout/Footer";
import logoImage from "@/assets/logo.webp";

const Home = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Palette,
      title: "تحليل ذكي للأسلوب",
      description: "نموذج AI متقدم يحلل شكل جسمك ولون بشرتك لتقديم توصيات مخصصة",
    },
    {
      icon: Zap,
      title: "توليد صور احترافية",
      description: "تصور نفسك بالملابس المقترحة قبل الشراء باستخدام تقنية FLUX Pro",
    },
    {
      icon: Shield,
      title: "خصوصية محمية",
      description: "جميع بيانات تحليلاتك محفوظة بأمان وتشفير عالي المستوى",
    },
    {
      icon: TrendingUp,
      title: "توصيات مستمرة",
      description: "احفظ تحليلاتك المفضلة واعد الرجوع إليها في أي وقت",
    },
  ];

  const stats = [
    { number: "10K+", label: "مستخدم سعيد" },
    { number: "50K+", label: "تحليل تم" },
    { number: "98%", label: "رضا العملاء" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/50 flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden flex-1 pt-20">
        <div
          className="absolute inset-0 z-0 opacity-40"
          style={{
            backgroundImage: `url(${logoImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background/80" />
        </div>

        <div className="container mx-auto px-4 relative z-10 text-center">
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-primary">مساعدك الشخصي في الموضة بتقنية AI</span>
            </div>

            {/* Main Heading */}
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold leading-tight">
                اكتشف أسلوبك المثالي
                <span className="gradient-text block mt-2">مع The Special Style</span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                مستشار موضة ذكي يساعدك على اختيار الملابس وتسريحات الشعر المثالية لك، مع توليد صور احترافية تظهرك بالإطلالة الجديدة
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button
                variant="hero"
                size="xl"
                onClick={() => navigate("/auth")}
                className="w-full sm:w-auto group"
              >
                <Camera className="w-5 h-5 ml-2 group-hover:scale-110 transition-transform" />
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

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-12 max-w-md mx-auto">
              {stats.map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-2xl md:text-3xl font-bold text-primary">{stat.number}</p>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce z-10">
          <div className="w-6 h-10 border-2 border-primary/50 rounded-full p-1">
            <div className="w-1.5 h-3 bg-primary/50 rounded-full mx-auto" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              لماذا تختار <span className="gradient-text">The Special Style</span>؟
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              نقدم لك تجربة فريدة من نوعها في عالم الموضة الرقمية
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={i}
                  className="p-8 shadow-elegant hover:shadow-lg transition-all duration-300 hover:scale-105 group"
                >
                  <div className="mb-4 inline-flex p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
        <div className="container mx-auto text-center max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            هل أنت مستعد لاكتشاف أسلوبك الحقيقي؟
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            انضم إلى آلاف المستخدمين الذين اكتشفوا أسلوبهم المثالي معنا
          </p>
          <Button
            variant="hero"
            size="xl"
            onClick={() => navigate("/auth")}
            className="group"
          >
            <Sparkles className="w-5 h-5 ml-2 group-hover:animate-spin" />
            ابدأ الآن مجاناً
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
