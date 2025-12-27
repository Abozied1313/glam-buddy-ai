import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM_PROMPT = `أنت "Style Nexus" - مستشار أزياء خبير ونظام ذكاء اصطناعي للتنسيق الشخصي.

عند تحميل المستخدم لصورته، حللها وقدم توصيات شاملة حيث:
- يتم تحليل ملامح الوجه، شكل الجسم، ولون البشرة
- تقديم توصيات ملابس مخصصة بناءً على شكل الجسم ولون البشرة والمناسبة
- للنساء: إضافة اقتراحات مكياج مناسب + تنسيق الحجاب (إذا كانت محجبة)
- للرجال: اقتراح تسريحة شعر (إعادة تصفيف الشعر الحالي، ليس قصة جديدة)

[قواعد حاسمة:]
1. كل مستخدم يحصل على توصيات ملابس فريدة بناءً على شكل جسمه ولون بشرته والمناسبة
2. لا تستخدم اقتراحات عامة مثل "بولو وبنطلون تشينو" للجميع
3. للنساء المحجبات: اقتراح لون ولفة الحجاب تتناسب مع الإطلالة
4. للرجال: اقتراح تصفيف شعر (ليس قصة) يتناسب مع طول شعرهم الحالي
5. لغة المخرجات تتطابق مع لغة المستخدم

[المخرجات المطلوبة - JSON فقط:]
{
  "تحليل_المدخلات": "وصف دقيق لشكل الجسم ولون البشرة والستايل الحالي",
  "توصيات_تسريحات_الشعر": [
    {"التسريحة": "اسم التسريحة المحدد", "الملاءمة": "لماذا تناسب هذا المستخدم بالذات"}
  ],
  "توصيات_الملابس_والأطقم": [
    {"القطعة": "اسم القطعة المحددة", "اللون": "اللون المحدد", "الخامة": "نوع القماش", "السبب": "لماذا يناسب هذا المستخدم بالذات"}
  ],
  "اقتراحات_المكياج": "للإناث فقط: مكياج يناسب شكل الوجه ولون البشرة",
  "تنسيق_الحجاب": "للمحجبات فقط: لون ولفة الحجاب المقترحة",
  "الأسلوب_والتنسيق_المقترح": "نصائح التنسيق المخصصة",
  "ملاحظات_أخلاقية_وعملية": "نصائح عملية إضافية",
  "image_generation_prompt": "A photorealistic fashion portrait preserving the analysis context. Technical requirements: professional photography, 8K resolution, natural lighting, fashion magazine style. Include specific outfit details, colors, and styling."
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, occasion, gender, userId, analysisId } = await req.json();
    console.log("Starting analysis for:", { occasion, gender, analysisId });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch and encode image to base64
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const uint8Array = new Uint8Array(imageBuffer);
    const chunkSize = 8192;
    let binaryString = "";
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binaryString += String.fromCharCode(...chunk);
    }
    const base64Image = btoa(binaryString);
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

    // Step 1: Get style analysis from Lovable AI
    const occasionLabels: Record<string, string> = {
      casual: "يومي",
      work: "عمل",
      formal: "رسمي",
      party: "حفلة",
      wedding: "زفاف",
      sport: "رياضي",
    };

    const genderLabel = gender === "male" ? "رجل" : "امرأة";
    const hijabNote = gender === "female" ? " (لاحظ إذا كانت ترتدي حجاب وقدم توصيات مناسبة)" : "";
    const userPrompt = `قم بتحليل هذه الصورة لـ ${genderLabel}${hijabNote} وقدم توصيات أزياء وتسريحات شعر مخصصة ومفصلة للمناسبة: ${occasionLabels[occasion] || occasion}. 
    
تحليل دقيق مطلوب:
1. شكل الجسم ولون البشرة
2. الستايل الحالي
3. توصيات ملابس محددة (ليست عامة) تناسب هذا الشخص بالذات
4. ${gender === "male" ? "تصفيف شعر يناسب طول شعره الحالي" : "مكياج وتسريحة شعر/حجاب مناسبة"}

أعد النتيجة بتنسيق JSON فقط.`;

    console.log("Calling Lovable AI for style analysis...");

    const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            ],
          },
        ],
      }),
    });

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error("Lovable AI error:", errorText);
      throw new Error("Failed to get style analysis");
    }

    const analysisData = await analysisResponse.json();
    const analysisText = analysisData.choices?.[0]?.message?.content || "";
    console.log("Raw analysis response received");

    // Parse the JSON response
    let analysisResult;
    try {
      const cleanedText = analysisText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      analysisResult = {
        تحليل_المدخلات: "تم تحليل الصورة بنجاح",
        توصيات_تسريحات_الشعر: [{ التسريحة: "تسريحة عصرية أنيقة", الملاءمة: "تناسب شكل الوجه والمناسبة" }],
        توصيات_الملابس_والأطقم: [{ القطعة: "طقم أنيق", اللون: "ألوان محايدة", الخامة: "قماش عالي الجودة", السبب: "مناسب للمناسبة" }],
        الأسلوب_والتنسيق_المقترح: "تنسيق عصري ومريح",
        ملاحظات_أخلاقية_وعملية: "احرص على اختيار ملابس مريحة",
      };
    }

    // Step 2: Generate image using Lovable AI (Gemini Image Generation)
    let generatedImageUrl = null;

    console.log("Generating image with Lovable AI...");

    // Build dynamic prompt based on gender and analysis
    const outfitDetails = analysisResult.توصيات_الملابس_والأطقم || [];
    const hairstyleDetails = analysisResult.توصيات_تسريحات_الشعر || [];
    const makeupDetails = analysisResult.اقتراحات_المكياج || "";
    const hijabDetails = analysisResult.تنسيق_الحجاب || "";

    const outfitDescriptions = outfitDetails
      .slice(0, 3)
      .map((item: any) => `${item.القطعة || 'elegant piece'} in ${item.اللون || 'neutral'} color made of ${item.الخامة || 'quality fabric'}`)
      .join(", ");

    const hairstyleDescription = hairstyleDetails[0]?.التسريحة || "modern stylish hairstyle";

    let stylePrompt = "";

    if (gender === "male") {
      stylePrompt = `Create a photorealistic professional fashion portrait of a stylish Arab man. 
Hair: ${hairstyleDescription} (restyled, not a new haircut).
Outfit: ${outfitDescriptions || "elegant modern outfit tailored to body type"}.
Technical: High quality fashion magazine photography, studio lighting, clean background, 8K resolution, photorealistic, preserve natural skin tone and features.
Negative prompt: cartoon, anime, illustration, deformed features, different person.`;
    } else {
      const hasHijab = hijabDetails && hijabDetails.length > 0;
      if (hasHijab) {
        stylePrompt = `Create a photorealistic professional fashion portrait of an elegant Arab woman wearing hijab.
Hijab: ${hijabDetails}.
${makeupDetails ? `Makeup: ${makeupDetails}.` : ""}
Outfit: ${outfitDescriptions || "sophisticated modest fashion tailored to body type"}.
Technical: High quality fashion magazine photography, studio lighting, clean background, 8K resolution, photorealistic, preserve natural skin tone and features.
Negative prompt: cartoon, anime, illustration, deformed features, different person.`;
      } else {
        stylePrompt = `Create a photorealistic professional fashion portrait of a stylish Arab woman.
Hairstyle: ${hairstyleDescription}.
${makeupDetails ? `Makeup: ${makeupDetails}.` : ""}
Outfit: ${outfitDescriptions || "trendy modern clothing tailored to body type"}.
Technical: High quality fashion magazine photography, studio lighting, clean background, 8K resolution, photorealistic, preserve natural skin tone and features.
Negative prompt: cartoon, anime, illustration, deformed features, different person.`;
      }
    }

    console.log("Image generation prompt:", stylePrompt);

    try {
      const imageGenResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [
            {
              role: "user",
              content: stylePrompt,
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!imageGenResponse.ok) {
        const errorText = await imageGenResponse.text();
        console.error("Lovable AI Image Generation error:", errorText);
      } else {
        const imageGenData = await imageGenResponse.json();
        console.log("Image generation response received");

        const generatedImage = imageGenData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (generatedImage && generatedImage.startsWith("data:image")) {
          console.log("Generated image received, uploading to storage...");

          // Extract base64 data and upload to Supabase storage
          const base64Data = generatedImage.split(",")[1];
          const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

          const fileName = `generated/${userId}/${Date.now()}.png`;
          const { error: uploadError } = await supabase.storage
            .from("analysis-images")
            .upload(fileName, imageBytes, {
              contentType: "image/png",
            });

          if (!uploadError) {
            const {
              data: { publicUrl },
            } = supabase.storage.from("analysis-images").getPublicUrl(fileName);
            generatedImageUrl = publicUrl;
            console.log("Generated image uploaded:", generatedImageUrl);
          } else {
            console.error("Upload error:", uploadError);
          }
        } else {
          console.log("No valid image in response");
        }
      }
    } catch (imageError) {
      console.error("Image generation error:", imageError);
    }

    const result = {
      ...analysisResult,
      generated_image_url: generatedImageUrl,
    };

    console.log("Analysis complete");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in analyze-style:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
