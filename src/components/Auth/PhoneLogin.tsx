import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const PhoneLogin = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    if (!phone) {
      toast.error("يرجى إدخال رقم الهاتف");
      return;
    }
    setLoading(true);
    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;
      const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
      if (error) throw error;
      setStep("otp");
      toast.success("تم إرسال رمز التحقق إلى هاتفك");
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ في إرسال الرمز");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error("يرجى إدخال الرمز المكون من 6 أرقام");
      return;
    }
    setLoading(true);
    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;
      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: "sms",
      });
      if (error) throw error;
      toast.success("تم تسجيل الدخول بنجاح!");
      navigate("/analyze", { replace: true });
    } catch (error: any) {
      toast.error(error.message || "رمز التحقق غير صحيح");
    } finally {
      setLoading(false);
    }
  };

  if (step === "otp") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          أدخل الرمز المرسل إلى <span className="font-semibold text-foreground">{phone}</span>
        </p>
        <div className="flex justify-center" dir="ltr">
          <InputOTP maxLength={6} value={otp} onChange={setOtp}>
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button onClick={verifyOtp} className="w-full" size="lg" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
          تأكيد الرمز
        </Button>
        <Button variant="ghost" onClick={() => { setStep("phone"); setOtp(""); }} className="w-full">
          تغيير رقم الهاتف
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone">رقم الهاتف</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+201234567890"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          className="text-left"
        />
        <p className="text-xs text-muted-foreground">أدخل رقم الهاتف مع كود الدولة (مثال: +20 لمصر)</p>
      </div>
      <Button onClick={sendOtp} className="w-full" size="lg" disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
        إرسال رمز التحقق
      </Button>
    </div>
  );
};

export default PhoneLogin;
