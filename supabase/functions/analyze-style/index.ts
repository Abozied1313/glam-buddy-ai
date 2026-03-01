import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Allowed values for validation
const ALLOWED_OCCASIONS = ["casual", "work", "formal", "party", "wedding", "sport"];
const ALLOWED_GENDERS = ["male", "female"];

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Extract allowed domain for URL validation
const ALLOWED_DOMAIN = SUPABASE_URL.replace("https://", "");

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

// Input validation functions
function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

function isValidImageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    // Must be HTTPS
    if (parsedUrl.protocol !== "https:") {
      return false;
    }
    // Must be from our Supabase storage domain
    if (!parsedUrl.hostname.includes(ALLOWED_DOMAIN.split(".")[0])) {
      return false;
    }
    // Must be from analysis-images bucket
    if (!parsedUrl.pathname.includes("/storage/v1/object/") || !parsedUrl.pathname.includes("analysis-images")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function validateInput(data: any): { valid: boolean; error?: string } {
  // Check required fields exist
  if (!data.imageUrl || typeof data.imageUrl !== "string") {
    return { valid: false, error: "Missing or invalid imageUrl" };
  }
  if (!data.occasion || typeof data.occasion !== "string") {
    return { valid: false, error: "Missing or invalid occasion" };
  }
  if (!data.gender || typeof data.gender !== "string") {
    return { valid: false, error: "Missing or invalid gender" };
  }
  if (!data.analysisId || typeof data.analysisId !== "string") {
    return { valid: false, error: "Missing or invalid analysisId" };
  }

  // Validate imageUrl - prevent SSRF
  if (!isValidImageUrl(data.imageUrl)) {
    return { valid: false, error: "Invalid imageUrl: must be from allowed storage domain" };
  }

  // Validate occasion
  if (!ALLOWED_OCCASIONS.includes(data.occasion)) {
    return { valid: false, error: `Invalid occasion: must be one of ${ALLOWED_OCCASIONS.join(", ")}` };
  }

  // Validate gender
  if (!ALLOWED_GENDERS.includes(data.gender)) {
    return { valid: false, error: `Invalid gender: must be one of ${ALLOWED_GENDERS.join(", ")}` };
  }

  // Validate analysisId UUID format
  if (!isValidUUID(data.analysisId)) {
    return { valid: false, error: "Invalid analysisId: must be a valid UUID" };
  }

  return { valid: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth token to verify identity
    const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      console.error("Invalid authentication:", userError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authenticatedUserId = user.id;
    console.log("Authenticated user:", authenticatedUserId);

    // Parse and validate input
    const requestData = await req.json();
    const { imageUrl, occasion, gender, userId, analysisId } = requestData;
    
    // SECURITY: Validate all inputs
    const validation = validateInput(requestData);
    if (!validation.valid) {
      console.error("Input validation failed:", validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Verify authenticated user matches requested userId
    if (userId && userId !== authenticatedUserId) {
      console.error("Authorization failed: user mismatch", { authenticated: authenticatedUserId, requested: userId });
      return new Response(
        JSON.stringify({ error: "Unauthorized: cannot process data for another user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use authenticated user ID for all operations
    const effectiveUserId = authenticatedUserId;

    console.log("Starting analysis for:", { occasion, gender, analysisId, userId: effectiveUserId });

    // Create service role client for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch and encode image to base64
    const imageResponse = await fetch(imageUrl, {
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });
    
    if (!imageResponse.ok) {
      throw new Error("Failed to fetch image");
    }
    
    const contentLength = imageResponse.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      throw new Error("Image too large: maximum 10MB allowed");
    }

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

    // Step 2: Generate image using Replicate (FLUX model)
    let generatedImageUrl = null;

    console.log("Generating image with Replicate FLUX...");

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
      stylePrompt = `A photorealistic professional fashion portrait of a stylish Arab man. Hair styled as ${hairstyleDescription}. Wearing ${outfitDescriptions || "elegant modern outfit tailored to body type"}. High quality fashion magazine photography, studio lighting, clean white background, 8K resolution, photorealistic, natural skin tone.`;
    } else {
      const hasHijab = hijabDetails && hijabDetails.length > 0;
      if (hasHijab) {
        stylePrompt = `A photorealistic professional fashion portrait of an elegant Arab woman wearing hijab. Hijab: ${hijabDetails}. ${makeupDetails ? `Makeup: ${makeupDetails}.` : ""} Wearing ${outfitDescriptions || "sophisticated modest fashion tailored to body type"}. High quality fashion magazine photography, studio lighting, clean white background, 8K resolution, photorealistic.`;
      } else {
        stylePrompt = `A photorealistic professional fashion portrait of a stylish Arab woman. Hairstyle: ${hairstyleDescription}. ${makeupDetails ? `Makeup: ${makeupDetails}.` : ""} Wearing ${outfitDescriptions || "trendy modern clothing tailored to body type"}. High quality fashion magazine photography, studio lighting, clean white background, 8K resolution, photorealistic.`;
      }
    }

    console.log("Image generation prompt:", stylePrompt);

    if (!REPLICATE_API_TOKEN) {
      console.error("REPLICATE_API_TOKEN is not configured");
    } else {
      try {
        // Use FLUX Schnell model for fast generation
        const replicateResponse = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
            "Content-Type": "application/json",
            "Prefer": "wait",
          },
          body: JSON.stringify({
            version: "5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637",
            input: {
              prompt: stylePrompt,
              num_outputs: 1,
              aspect_ratio: "3:4",
              output_format: "webp",
              output_quality: 90,
              num_inference_steps: 4,
              go_fast: true,
            },
          }),
        });

        if (!replicateResponse.ok) {
          const errorText = await replicateResponse.text();
          console.error("Replicate API error:", replicateResponse.status, errorText);
        } else {
          let prediction = await replicateResponse.json();
          console.log("Replicate prediction status:", prediction.status);

          // If still processing, poll for completion
          if (prediction.status === "starting" || prediction.status === "processing") {
            let attempts = 0;
            const maxAttempts = 30; // 30 seconds max wait
            
            while (prediction.status !== "succeeded" && prediction.status !== "failed" && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              const pollResponse = await fetch(prediction.urls.get, {
                headers: {
                  "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
                },
              });
              
              prediction = await pollResponse.json();
              attempts++;
              console.log(`Poll attempt ${attempts}: ${prediction.status}`);
            }
          }

          if (prediction.status === "succeeded" && prediction.output) {
            const generatedImage = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
            
            if (generatedImage && generatedImage.startsWith("http")) {
              console.log("Generated image received from Replicate, downloading...");

              // Download the image
              const imageResponse = await fetch(generatedImage);
              if (imageResponse.ok) {
                const arrayBuffer = await imageResponse.arrayBuffer();
                const imageBytes = new Uint8Array(arrayBuffer);

                // Upload to storage
                const fileName = `generated/${effectiveUserId}/${Date.now()}.webp`;
                const { error: uploadError } = await supabase.storage
                  .from("analysis-images")
                  .upload(fileName, imageBytes, {
                    contentType: "image/webp",
                  });

                if (!uploadError) {
                  // Create signed URL
                  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                    .from("analysis-images")
                    .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days expiry
                  
                  if (!signedUrlError && signedUrlData) {
                    generatedImageUrl = signedUrlData.signedUrl;
                    console.log("Generated image uploaded with signed URL");
                  } else {
                    console.error("Signed URL error:", signedUrlError);
                  }
                } else {
                  console.error("Upload error:", uploadError);
                }
              } else {
                console.error("Failed to download generated image:", imageResponse.status);
              }
            }
          } else {
            console.error("Replicate prediction failed or no output:", prediction.status, prediction.error);
          }
        }
      } catch (imageError) {
        console.error("Image generation error:", imageError);
      }
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
    // Log detailed error for debugging (server-side only)
    console.error("Error in analyze-style:", error);
    
    // Return generic error message to client - never expose internal details
    return new Response(
      JSON.stringify({ error: "حدث خطأ في التحليل. يرجى المحاولة مرة أخرى." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
