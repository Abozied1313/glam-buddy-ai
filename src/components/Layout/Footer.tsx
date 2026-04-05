import { Heart, Mail, Instagram, Twitter } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold gradient-text">The Special Style</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              مستشارك الشخصي في عالم الموضة والأناقة. نساعدك على اكتشاف أسلوبك المثالي باستخدام الذكاء الاصطناعي.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-foreground">روابط سريعة</h4>
            <nav className="flex flex-col space-y-2">
              <Link to="/" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                الرئيسية
              </Link>
              <Link to="/features" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                المميزات
              </Link>
              <Link to="/analyze" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                تحليل جديد
              </Link>
              <Link to="/favorites" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                المفضلة
              </Link>
            </nav>
          </div>

          {/* Contact & Social */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-foreground">تواصل معنا</h4>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Mail className="w-4 h-4" />
              <span>support@specialstyle.com</span>
            </div>
            <div className="flex items-center gap-4 pt-2">
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
              >
                <Instagram className="w-5 h-5 text-primary" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
              >
                <Twitter className="w-5 h-5 text-primary" />
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm flex items-center gap-1">
            صُنع بـ <Heart className="w-4 h-4 text-red-500 fill-red-500" /> في {currentYear}
          </p>
          <p className="text-muted-foreground text-sm">
            © {currentYear} The Special Style. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
