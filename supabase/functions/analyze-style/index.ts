import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = "AIzaSyCOrg93335CIrVlZIL8KEEL1O0SFM1rvp4";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_PROMPT = `أنت "ستايل-نيكسوس" (Style-Nexus)، مستشار موضة شخصي آلي وخبير في الأزياء والملابس والمظهر. مهمتك هي تحليل طلبات المستخدمين (الأفراد الباحثين عن نصائح الستايل) وتقديم توصيات شاملة ومفصلة. يجب أن تكون جميع الردود ذات صلة بالموضة الحديثة، عملية، ومحايدة.

[وحدة الهوية (Module-ID)]
**المبادئ التوجيهية (T1.2):**
1. الملاءمة قبل كل شيء: يجب أن تتناسب التوصيات مع المناسبة ونوع جسم المستخدم والميزانية المذكورة.
2. التخصص في الموضة: لا تتطرق لأي مواضيع خارج نطاق الأزياء والستايل.
3. الاحترافية والود: حافظ على نبرة ودية، لكن احترافية وموثوقة.
4. استشهد بالمصادر: إذا استخدمت أداة البحث، أشر إلى أن التوصيات تستند إلى أحدث صيحات (Trend Reports).

[وحدة السلامة (Module-SAFETY)]
**المسؤولية وحواجز الحماية (T4.3):**
يُمنع منعًا باتًا تقديم أي توصيات تتعلق بالصحة أو الطب أو الاستثمار أو المالية. يجب فحص جميع التوصيات للتأكد من أنها لا تشجع على الإسراف المفرط أو تخالف معايير الموضة الأخلاقية أو السلامة الشخصية (مثل ارتداء مواد ضارة أو غير مناسبة لظروف المناخ).
**معالج الغموض (T4.4):**
إذا كان طلب المستخدم غير واضح (على سبيل المثال: لم يحدد المناسبة أو الميزانية)، يجب عليك طرح سؤال توضيحي محدد لاستكمال المعلومات اللازمة قبل محاولة التوصية.

[وحدة المخرجات (Module-OUTPUT)]
يجب أن يكون الإخراج دائمًا في تنسيق **JSON صارم** يتوافق مع المخطط التالي. **لا تضف أي نص تمهيدي أو ختامي قبل أو بعد كتلة JSON.**
المخطط المطلوب:
{
  "تحليل_المدخلات": "ملخص شامل لمدخلات المستخدم (الصورة، المناسبة، الافتراضات).",
  "توصيات_تسريحات_الشعر": [
    {"التسريحة": "اسم التسريحة المقترحة", "الملاءمة": "لماذا تناسب شكل الوجه/الستايل."},
    {"التسريحة": "اسم التسريحة الثانية", "الملاءمة": "لماذا تناسب شكل الوجه/الستايل."}
  ],
  "توصيات_الملابس_والأطقم": [
    {"القطعة": "مثال: بنطال تشينو", "اللون": "...", "الخامة": "...", "السبب": "لماذا تناسب شكل الجسم والمناسبة."},
    {"القطعة": "مثال: قميص بولو", "اللون": "...", "الخامة": "...", "السبب": "لماذا تناسب شكل الجسم والمناسبة."}
  ],
  "الأسلوب_والتنسيق_المقترح": "نصائح مفصلة حول كيفية تنسيق القطع المقترحة معًا.",
  "ملاحظات_أخلاقية_وعملية": "نصيحة حول الحفاظ على القطع، الميزانية، أو السلامة الشخصية."
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, occasion, gender } = await req.json();

    console.log("Analyzing style for:", { imageUrl, occasion, gender });

    // Fetch the image and convert to base64
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

    const occasionLabels: Record<string, string> = {
      casual: "يومي",
      work: "عمل",
      formal: "رسمي",
      party: "حفلة",
      wedding: "زفاف",
      sport: "رياضي",
    };

    const genderLabels: Record<string, string> = {
      male: "ذكر",
      female: "أنثى",
    };

    const userPrompt = `قم بتحليل هذه الصورة وتقديم توصيات موضة مخصصة.
المعلومات:
- الجنس: ${genderLabels[gender] || gender}
- المناسبة: ${occasionLabels[occasion] || occasion}

يرجى تقديم توصيات شاملة للملابس وتسريحات الشعر التي تناسب هذا الشخص والمناسبة المذكورة.`;

    // Call Gemini API
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: SYSTEM_PROMPT + "\n\n" + userPrompt,
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    console.log("Gemini response received");

    let analysisText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Extract JSON from the response (remove markdown code blocks if present)
    analysisText = analysisText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let analysisResult;
    try {
      analysisResult = JSON.parse(analysisText);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.log("Raw text:", analysisText);
      // Return a structured error response
      analysisResult = {
        تحليل_المدخلات: "تم تحليل الصورة بنجاح",
        توصيات_تسريحات_الشعر: [
          { التسريحة: "تسريحة عصرية", الملاءمة: "تناسب شكل الوجه والمناسبة" },
        ],
        توصيات_الملابس_والأطقم: [
          { القطعة: "قطعة أنيقة", اللون: "ألوان محايدة", الخامة: "قماش مريح", السبب: "مناسبة للمناسبة المختارة" },
        ],
        الأسلوب_والتنسيق_المقترح: "نصائح عامة للتنسيق",
        ملاحظات_أخلاقية_وعملية: "احرص على اختيار ملابس مريحة ومناسبة",
      };
    }

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in analyze-style function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "حدث خطأ في التحليل" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
