import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM_PROMPT = `أنت "ستايل-نيكسوس" (Style-Nexus)، مستشار موضة شخصي آلي وخبير في الأزياء والملابس والمظهر. مهمتك هي تحليل طلبات المستخدمين وتقديم توصيات شاملة ومفصلة.

[المبادئ التوجيهية:]
1. الملاءمة قبل كل شيء: يجب أن تتناسب التوصيات مع المناسبة ونوع جسم المستخدم.
2. التخصص في الموضة: لا تتطرق لأي مواضيع خارج نطاق الأزياء والستايل.
3. الاحترافية والود: حافظ على نبرة ودية واحترافية.

[المخرجات المطلوبة - JSON فقط:]
{
  "تحليل_المدخلات": "ملخص شامل لمدخلات المستخدم",
  "توصيات_تسريحات_الشعر": [
    {"التسريحة": "اسم التسريحة", "الملاءمة": "سبب الملاءمة"}
  ],
  "توصيات_الملابس_والأطقم": [
    {"القطعة": "اسم القطعة", "اللون": "اللون", "الخامة": "نوع القماش", "السبب": "سبب الاختيار"}
  ],
  "الأسلوب_والتنسيق_المقترح": "نصائح التنسيق",
  "ملاحظات_أخلاقية_وعملية": "نصائح إضافية"
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
    const userPrompt = `قم بتحليل هذه الصورة لـ ${genderLabel} وقدم توصيات أزياء وتسريحات شعر مناسبة للمناسبة: ${occasionLabels[occasion] || occasion}. أعد النتيجة بتنسيق JSON فقط.`;

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

    const outfitDescriptions = outfitDetails
      .slice(0, 2)
      .map((item: any) => `${item.القطعة || 'elegant outfit'} in ${item.اللون || 'neutral'} color`)
      .join(", ");

    const hairstyleDescription = hairstyleDetails[0]?.التسريحة || "modern stylish hairstyle";

    let stylePrompt = "";

    if (gender === "male") {
      stylePrompt = `Create a professional fashion portrait of a stylish Arab man with ${hairstyleDescription}, wearing ${outfitDescriptions || "elegant modern outfit"}. High quality, fashion magazine style, studio lighting, clean background. Photorealistic, 8k quality.`;
    } else {
      const isModestOccasion = ["formal", "work", "wedding"].includes(occasion);
      if (isModestOccasion) {
        stylePrompt = `Create a professional fashion portrait of an elegant Arab woman wearing modern hijab and modest fashion, ${hairstyleDescription}, wearing ${outfitDescriptions || "sophisticated modest outfit"}. High quality, fashion magazine style, studio lighting, clean background. Photorealistic, 8k quality.`;
      } else {
        stylePrompt = `Create a professional fashion portrait of a stylish Arab woman with ${hairstyleDescription}, wearing ${outfitDescriptions || "trendy modern clothing"}. High quality, fashion magazine style, studio lighting, clean background. Photorealistic, 8k quality.`;
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
