import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { reserve, finish, RequestError } from "../_shared/quota.ts";
import { geminiModel } from "../_shared/gemini.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildOutfitInstructions, outfitSignature, validateOutfitPreferences } from "./outfit-rules.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_ANALYSIS_MODEL = geminiModel("GEMINI_ANALYSIS_MODEL");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLOUD_IMAGE_EDIT_URL = Deno.env.get("GOOGLE_CLOUD_IMAGE_EDIT_URL") ||
  "https://special-style-image-editor-1030501980458.us-central1.run.app/edit";

const MAX_INPUT_IMAGE_BYTES = 7 * 1024 * 1024;

// Allowed values for validation

const ALLOWED_GENDERS = ["male", "female"];

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Extract allowed domain for URL validation
const ALLOWED_DOMAIN = SUPABASE_URL.replace("https://", "");

const SYSTEM_PROMPT = `أنت "Style Nexus" - مستشار أزياء خبير ونظام ذكاء اصطناعي للتنسيق الشخصي.

عند تحميل المستخدم لصورته، حللها وقدم توصيات شاملة حيث:
- يتم تحليل ملامح الوجه، شكل الجسم، ولون البشرة
- تقديم توصيات ملابس مخصصة بناءً على شكل الجسم ولون البشرة والمناسبة
- للنساء: إضافة اقتراحات مكياج مناسب؛ تنسيق الحجاب فقط عند طلب المستخدم الصريح، ولا تستنتج الدين أو المعتقد
- للرجال: اقتراح تسريحة شعر (إعادة تصفيف الشعر الحالي، ليس قصة جديدة)

[قواعد حاسمة:]
1. كل مستخدم يحصل على توصيات ملابس فريدة بناءً على شكل جسمه ولون بشرته والمناسبة
2. لا تستخدم اقتراحات عامة مثل "بولو وبنطلون تشينو" للجميع
3. تنسيق الحجاب عند طلب صريح فقط؛ خلاف ذلك أعد تنسيق_الحجاب كسلسلة فارغة
4. للرجال: اقتراح تصفيف شعر (ليس قصة) يتناسب مع طول شعرهم الحالي
5. لغة المخرجات تتطابق مع لغة المستخدم، باستثناء حقل image_generation_prompt يجب أن يكون بالإنجليزية فقط لأنه يُرسل مباشرة إلى نموذج توليد الصور

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
  "image_generation_prompt": "English-only image edit instruction. List the exact visible outfit pieces, colors, layering order, and accessories as mandatory requirements. It must match توصيات_الملابس_والأطقم exactly and must not request changes to face, expression, hair, pose, lighting, background, or camera angle."
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
    if (!(parsedUrl.hostname === ALLOWED_DOMAIN)) {
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

  // Validate free-text occasion
  if (data.occasion.length > 300 || /[\u0000-\u001f]/.test(data.occasion)) {
    return { valid: false, error: "Invalid occasion: max 300 characters" };
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

function normalizePromptValue(value: unknown): string {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildOutfitPrompt(outfitDetails: any[]): string {
  const pieces = outfitDetails
    .slice(0, 5)
    .map((item: any, index: number) => {
      const piece = normalizePromptValue(item?.القطعة || item?.piece || "");
      const color = normalizePromptValue(item?.اللون || item?.color || "");
      const fabric = normalizePromptValue(item?.الخامة || item?.fabric || "");
      if (!piece) return null;

      const parts = [`${index + 1}. ${piece}`];
      if (color) parts.push(`exact color: ${color}`);
      if (fabric) parts.push(`fabric: ${fabric}`);
      return parts.join(" — ");
    })
    .filter(Boolean);

  return pieces.length > 0
    ? pieces.join("; ")
    : "1. complete elegant outfit with clearly visible top, lower garment, and appropriate shoes";
}

async function verifyAnalysisOwnership(supabase: any, analysisId: string, userId: string) {
  const { data, error } = await supabase
    .from("style_analyses")
    .select("id,user_id,image_url,occasion,gender,analysis_result")
    .eq("id", analysisId)
    .maybeSingle();

  if (error) throw new Error("Failed to verify analysis ownership");
  if (!data || data.user_id !== userId) throw new Error("Analysis not found or access denied");

  return data;
}

async function saveGeneratedDataUri(supabase: any, effectiveUserId: string, dataUri: string) {
  if (typeof dataUri !== "string" || dataUri.length > 24 * 1024 * 1024) throw new Error("Invalid generated image size");
  const match = dataUri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid generated image payload");
  }

  const contentType = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1] || "png";
  const fileName = `generated/${effectiveUserId}/${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("analysis-images")
    .upload(fileName, new Blob([bytes], { type: contentType }), { contentType });

  if (uploadError) {
    console.error("image_upload_failed");
    throw new Error("Failed to upload generated image to storage");
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("analysis-images")
    .createSignedUrl(fileName, 60 * 60 * 24 * 7);

  if (signedUrlError || !signedUrlData) {
    console.error("image_sign_failed");
    throw new Error("Failed to create signed URL for generated image");
  }

  console.log("Generated image uploaded with signed URL");
  return signedUrlData.signedUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let reservationId: string | null = null;
  let owner: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;
  let outcome: "released" | "uncertain" = "released";
  const deadline = Date.now() + 140000; // Below documented 150s request idle timeout; not a plan assumption.
  const remainingSignal = () => AbortSignal.timeout(Math.max(1, deadline - Date.now()));
  try {
    if (req.method !== "POST") throw new RequestError(405, "طريقة الطلب غير مدعومة.");
    if (Number(req.headers.get("content-length")) > 12000) throw new RequestError(413,"الطلب كبير جداً.");
    // SECURITY: Verify authentication (explicit validation for Lovable Cloud ES256 compatibility)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Create client with user's auth token to verify identity
    const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // SECURITY: Must validate token explicitly when verify_jwt=false
    const { data: { user }, error: userError } = await userSupabase.auth.getUser(token);
    if (userError || !user) {
      console.error("Invalid authentication:", userError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authenticatedUserId = user.id;
    owner = authenticatedUserId;

    // Parse request and create service role client for storage/database operations
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 12000) throw new RequestError(413,"الطلب كبير جداً.");
    const requestData = JSON.parse(raw);
    const { action, userId, analysisId } = requestData;
    
    // Use authenticated user ID for all operations
    const effectiveUserId = authenticatedUserId;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    admin = supabase;

    // SECURITY: Validate all inputs
    const validation = validateInput(requestData);
    if (!validation.valid) {
      console.error("Input validation failed:", validation.error);
      return new Response(
        JSON.stringify({ error: "بيانات الطلب غير صالحة." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Verify authenticated user matches requested userId
    if (userId && userId !== authenticatedUserId) {
      console.error("authorization_mismatch");
      return new Response(
        JSON.stringify({ error: "Unauthorized: cannot process data for another user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ownedAnalysis = await verifyAnalysisOwnership(supabase, analysisId, effectiveUserId);
    const {image_url: imageUrl, occasion, gender} = ownedAnalysis;
    const previousResult = ownedAnalysis.analysis_result || {};
    const regenerating = action === "regenerate";
    const preferences = regenerating ? (previousResult.outfit_preferences || {}) : {
      outfitRequest: requestData.outfitRequest || "",
      outfitReferencePath: requestData.outfitReferencePath || null,
    };
    const preferenceError = validateOutfitPreferences(preferences, effectiveUserId);
    if (preferenceError) return new Response(JSON.stringify({ error: preferenceError }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const previousOutfits = regenerating ? [
      ...(Array.isArray(previousResult.outfit_history) ? previousResult.outfit_history.slice(-5) : []),
      { توصيات_الملابس_والأطقم: previousResult.توصيات_الملابس_والأطقم || [] },
    ] : [];
    const variation = regenerating ? Math.min(10000, Number(previousResult.outfit_variation || 0) + 1) : 0;

    if (action && action !== "regenerate") throw new RequestError(400,"نوع الطلب غير صالح.");
    if (!GEMINI_API_KEY) throw new RequestError(503,"خدمة تحليل الصور غير مهيأة حالياً.");
    const reservation = await reserve(supabase,effectiveUserId,"render",requestData.requestId,{analysisId,action: action || "analyze",preferences},analysisId);
    if (reservation.replay) return new Response(JSON.stringify(reservation.replay),{headers:{...corsHeaders,"Content-Type":"application/json"}});
    reservationId = reservation.id;

    // Download image from private bucket using service role client
    // Extract the storage path from the URL
    const storagePathMatch = imageUrl.match(/analysis-images\/(.+?)(\?|$)/);
    if (!storagePathMatch) {
      throw new Error("Invalid image URL format");
    }
    const storagePath = decodeURIComponent(storagePathMatch[1]);

    // Ownership check: the storage path must belong to the authenticated caller
    const pathSegments = storagePath.split("/");
    const ownerSegment = pathSegments[0];
    if (ownerSegment !== effectiveUserId || storagePath.includes("..") || /[\\?#\x00-\x1f]/.test(storagePath)) throw new RequestError(403,"غير مصرح بالوصول إلى الصورة.");

    const { data: imageData, error: downloadError } = await supabase.storage
      .from("analysis-images")
      .download(storagePath);

    if (downloadError || !imageData) {
      console.error("Storage download error:", downloadError?.message);
      throw new Error("Failed to fetch image from storage");
    }

    if (!imageData.size || imageData.size > MAX_INPUT_IMAGE_BYTES || !["image/jpeg","image/png","image/webp"].includes(imageData.type)) throw new RequestError(413,"اختر صورة JPG أو PNG أو WebP بحجم لا يتجاوز ٧ ميجابايت.");

    const imageBuffer = await imageData.arrayBuffer();
    const uint8Array = new Uint8Array(imageBuffer);
    const chunkSize = 8192;
    let binaryString = "";
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binaryString += String.fromCharCode(...chunk);
    }
    const base64Image = btoa(binaryString);
    const mimeType = imageData.type || "image/jpeg";
    let referenceImagePart: { inline_data: { mime_type: string; data: string } } | null = null;
    if (preferences.outfitReferencePath) {
      const { data: reference, error: referenceError } = await supabase.storage.from("analysis-images").download(preferences.outfitReferencePath);
      if (referenceError || !reference) throw new RequestError(400,"تعذر تحميل صورة الملابس.");
      if (!reference.size || reference.size > MAX_INPUT_IMAGE_BYTES || !["image/jpeg","image/png","image/webp"].includes(reference.type)) throw new RequestError(413,"صورة الملابس غير صالحة أو كبيرة جداً.");
      const bytes = new Uint8Array(await reference.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.slice(i, i + 8192));
      referenceImagePart = { inline_data: { mime_type: reference.type, data: btoa(binary) } };
    }

    // Step 1: Direct Gemini analysis; no gateway fallback.
    const occasionLabels: Record<string, string> = {
      casual: "يومي",
      work: "عمل",
      formal: "رسمي",
      party: "حفلة",
      wedding: "زفاف",
      sport: "رياضي",
      general: "إطلالة عامة مناسبة لشخصيته ويومه",
    };

    const genderLabel = gender === "male" ? "رجل" : "امرأة";
    const hijabNote = " (لا تستنتج معتقداً أو ديانة. تنسيق الحجاب أو الاحتشام فقط عند طلب صريح في تفضيلات الملابس)";
    const userPrompt = `قم بتحليل هذه الصورة لـ ${genderLabel}${hijabNote} وقدم توصيات أزياء وتسريحات شعر مخصصة ومفصلة للمناسبة: ${occasionLabels[occasion] || occasion}. 
    
تحليل دقيق مطلوب:
1. شكل الجسم ولون البشرة
2. الستايل الحالي
3. توصيات ملابس محددة (ليست عامة) تناسب هذا الشخص بالذات
4. ${gender === "male" ? "تصفيف شعر يناسب طول شعره الحالي" : "مكياج وتسريحة شعر/حجاب مناسبة"}

أعد النتيجة بتنسيق JSON فقط.`;

    outcome = "uncertain"; // Dispatch can be billed even if the connection times out.
    const analysisResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_ANALYSIS_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
        signal: remainingSignal(),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{
            role: "user",
            parts: [
              { text: `${userPrompt}\n${buildOutfitInstructions(preferences, previousOutfits, variation)}` },
              { inline_data: { mime_type: mimeType, data: base64Image } },
              ...(referenceImagePart ? [referenceImagePart] : []),
            ],
          }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );

    if (!analysisResponse.ok) {
      console.error("analysis_upstream", analysisResponse.status);
      if ([400,401,403,404,429].includes(analysisResponse.status)) outcome = "released";
      throw new RequestError(analysisResponse.status === 429 ? 429 : 502,"تعذر تحليل الصورة لدى Gemini؛ راجع إعداد الخدمة أو حاول لاحقاً.");
    }

    const analysisData = await analysisResponse.json();
    const analysisText = (analysisData.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("");
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
    } catch {
      outcome = "released"; // No image service was invoked; provider definitively returned an unusable analysis.
      throw new RequestError(502,"تعذر الحصول على وصف صالح؛ احتفظنا بالنتيجة السابقة.");
    }
    if (!Array.isArray(analysisResult?.توصيات_الملابس_والأطقم) || !analysisResult.توصيات_الملابس_والأطقم.length || typeof analysisResult.image_generation_prompt !== "string" || analysisResult.image_generation_prompt.length > 12000 ||
      (regenerating && previousOutfits.some(outfit => outfitSignature(outfit) === outfitSignature(analysisResult)))) {
      outcome = "released";
      throw new RequestError(422,"لم يقترح النموذج طقماً صالحاً جديداً؛ احتفظنا بالنتيجة السابقة.");
    }

    // Step 2: Edit the original photo through the credited Google Cloud project.
    let generatedImageUrl: string | null = null;

    console.log("Generating face-preserving image with Google Cloud...");

    // Build dynamic prompt based on gender and analysis
    const outfitDetails = analysisResult.توصيات_الملابس_والأطقم || [];
    const modelOutfitPrompt = normalizePromptValue(analysisResult.image_generation_prompt || "");
    const hijabDetails = analysisResult.تنسيق_الحجاب || "";
    const outfitDescriptions = modelOutfitPrompt || buildOutfitPrompt(outfitDetails);

    let stylePrompt = "";

    // Keep the image edit intentionally narrow:
    // changing studio/background/hair/expression often causes face drift and outfit hallucination.
    const identityLock = "Identity lock: preserve the exact same face, facial features, expression, eyes, nose, mouth, skin tone, head shape, hair, body shape, pose, camera angle, framing, lighting, and background from the input image. Do not beautify, age, slim, reshape, redraw, or reinterpret the face. Keep the original facial expression unchanged.";
    const outfitLock = `Edit only the clothing area. Replace the current outfit with exactly these visible garments and colors, no substitutions, no missing layers, no extra colors: ${outfitDescriptions}. Every listed garment must be visible in the final image. If a shirt, tie, jacket, dress, hijab, trousers, or shoes are listed, they must appear clearly and in the stated color.`;
    const negativeLock = "Negative instructions: no bare chest, no open jacket without the listed shirt, no changing facial expression, no new person, no different face, no different pose, no different background, no costume, no invented outfit pieces, no wrong garment colors.";

    if (gender === "male") {
      stylePrompt = `${identityLock} ${outfitLock} Keep the existing hair exactly as in the input image; do not change hairstyle. ${negativeLock}`;
    } else {
      const hasHijab = /حجاب|hijab/i.test(preferences.outfitRequest || "") && hijabDetails && hijabDetails.length > 0;
      if (hasHijab) {
        stylePrompt = `${identityLock} ${outfitLock} Hijab edit only if needed: ${normalizePromptValue(hijabDetails)}. Preserve the original makeup and face unchanged. ${negativeLock}`;
      } else {
        stylePrompt = `${identityLock} ${outfitLock} Preserve the original hair, makeup, face and expression unchanged. ${negativeLock}`;
      }
    }

    // Do not log personal outfit preferences or reference details.

    const {error: readyError} = await supabase.rpc("prepare_image_render", {p_user:effectiveUserId,p_id:reservationId});
    if (readyError) { outcome="released"; throw new RequestError(503,"تعذر تجهيز حجز الصورة."); }
    outcome="uncertain";
    const imageResponse = await fetch(GOOGLE_CLOUD_IMAGE_EDIT_URL, {
      method:"POST", headers:{Authorization:authHeader,"Content-Type":"application/json"},
      body:JSON.stringify({analysisId,storagePath,prompt:stylePrompt}), signal:remainingSignal(),
    });
    if (!imageResponse.ok) {
      if ([400,401,403,413,415,429].includes(imageResponse.status)) outcome="released";
      console.error("image_upstream",imageResponse.status);
      throw new RequestError(imageResponse.status===429?429:502,"تعذر تعديل الصورة. قد يبقى الطلب محجوزاً إذا كانت نتيجته غير مؤكدة.");
    }
    const generated = await imageResponse.json();
    if (!generated?.dataUri) throw new RequestError(502,"لم تصل صورة صالحة؛ لن نكرر الطلب تلقائياً.");
    generatedImageUrl = await saveGeneratedDataUri(supabase,effectiveUserId,generated.dataUri);

    const result = {
      ...analysisResult,
      outfit_preferences: preferences,
      outfit_history: previousOutfits,
      outfit_variation: variation,
      generated_image_url: generatedImageUrl,
      image_generation_error: null,
      image_generation_provider: "google-cloud",
      image_generation_model: "gemini-nano-banana-2.1",
    };


    const {error: saveError} = await supabase.from("style_analyses").update({analysis_result:result,generated_image_url:generatedImageUrl}).eq("id",analysisId).eq("user_id",effectiveUserId);
    if (saveError) throw new RequestError(503,"تعذر حفظ النتيجة؛ لن نكرر عملية التوليد تلقائياً.");
    await finish(supabase,effectiveUserId,reservationId,"completed",result);
    reservationId=null;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (admin && owner && reservationId) {
      try { await finish(admin,owner,reservationId,outcome); } catch { console.error("reservation_finalize_failed"); }
    }
    console.error("analysis_failed",error instanceof Error ? error.name : "unknown");
    return new Response(JSON.stringify({error:error instanceof RequestError ? error.message : "تعذر إتمام التحليل. لم نكرر التوليد تلقائياً."}),{status:error instanceof RequestError?error.status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});
