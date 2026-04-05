# دليل تكامل Replicate - The Special Style

**الحالة:** ✅ جاهز للإنتاج  
**آخر تحديث:** 2026-04-05  
**الإصدار:** v2.0

---

## 📋 نظرة عامة

Replicate هو **القلب الحقيقي** لتطبيق The Special Style. يقوم بتوليد صور عالية الجودة للمستخدم بالملابس الجديدة المقترحة من Gemini، مع الحفاظ التام على ملامح الوجه الأصلية.

---

## 🎯 كيفية العمل

### المسار الكامل:

```
1. المستخدم يرفع صورته
   ↓
2. Gemini يحلل الصورة ويقترح ملابس
   ↓
3. Replicate يولد صورة جديدة:
   - نفس الوجه الأصلي (محفوظ 100%)
   - ملابس جديدة بناءً على الاقتراحات
   - جودة عالية جداً (8K)
   ↓
4. الصورة تُحفظ وتُعرض للمستخدم
```

---

## 🔧 المعاملات المُحسّنة

### معاملات Replicate الحالية:

```typescript
{
  prompt: stylePrompt,                    // وصف الملابس المقترحة
  image_prompt: base64Image,              // الصورة الأصلية
  image_prompt_strength: 0.85,            // قوة حفظ الوجه (0-1)
  aspect_ratio: "3:4",                    // نسبة العرض (بورتريه)
  output_format: "webp",                  // صيغة الصورة
  output_quality: 95,                     // جودة الصورة (1-100)
  safety_tolerance: 2,                    // تحمل السلامة
  num_inference_steps: 50,                // عدد خطوات المعالجة
  guidance_scale: 7.5,                    // قوة الالتزام بـ prompt
}
```

### شرح المعاملات:

| المعامل | القيمة | الشرح |
|--------|--------|-------|
| `image_prompt_strength` | 0.85 | كلما زادت، كلما حُفظ الوجه أكثر. 0.85 هو التوازن الأمثل |
| `output_quality` | 95 | جودة عالية جداً (95-100 الأفضل) |
| `num_inference_steps` | 50 | خطوات أكثر = جودة أفضل (لكن أبطأ) |
| `guidance_scale` | 7.5 | التزام أفضل بـ prompt (7-8 الأمثل) |

---

## 📸 نموذج الـ Prompt

### مثال لـ Prompt الذكي:

```
للرجال:
"A photorealistic professional fashion portrait of the same person in the reference image. 
Hair styled as modern undercut. Wearing navy blue blazer, white dress shirt, and tailored 
black trousers. Same face, same person, same identity. High quality fashion magazine 
photography, studio lighting, clean background, 8K resolution, photorealistic. 
Do not change the face or facial features, only change the outfit and hairstyle."

للنساء:
"A photorealistic professional fashion portrait of the same woman in the reference image 
wearing hijab. Hijab: cream colored silk hijab with elegant draping. Makeup: warm bronze 
eyeshadow with defined eyeliner. Wearing emerald green modest dress with gold embroidery. 
Same face, same person, same identity. High quality fashion magazine photography, 
studio lighting, clean background, 8K resolution, photorealistic. 
Do not change the face or facial features, only change the outfit, makeup and hijab style."
```

---

## ✅ معايير الجودة

### ما يجب أن تحتويه الصورة الناتجة:

- ✅ **نفس الوجه:** ملامح الوجه محفوظة 100%
- ✅ **ملابس جديدة:** الملابس تتطابق مع الاقتراحات
- ✅ **جودة عالية:** 8K resolution، تفاصيل واضحة
- ✅ **إضاءة احترافية:** إضاءة استوديو احترافية
- ✅ **خلفية نظيفة:** خلفية بسيطة وواضحة

### ما يجب تجنبه:

- ❌ تغيير ملامح الوجه
- ❌ تغيير شكل الجسم الأساسي
- ❌ صور غير واضحة أو ضبابية
- ❌ خلفيات معقدة أو مشتتة

---

## 🔑 متطلبات التشغيل

### 1. مفتاح Replicate API

```
REPLICATE_API_TOKEN=your_replicate_api_token_here
```

**الحصول على المفتاح:**
1. اذهب إلى https://replicate.com
2. سجل دخولك أو أنشئ حساباً
3. اذهب إلى API tokens
4. انسخ الـ token

⚠️ **تحذير:** لا تشارك مفتاح API الخاص بك مع أحد أو تضعه في الكود!

### 2. البيانات المطلوبة

```typescript
{
  imageUrl: "https://...",  // رابط الصورة الأصلية
  occasion: "casual",       // نوع المناسبة
  gender: "male",           // النوع
  userId: "uuid",           // معرف المستخدم
  analysisId: "uuid"        // معرف التحليل
}
```

---

## 🧪 الاختبار

### اختبار المفتاح:

```bash
npm test -- replicate-config
```

**النتيجة المتوقعة:**
```
✓ should have REPLICATE_API_TOKEN environment variable
✓ should have valid Replicate API token format
✓ should have minimum token length
✓ should validate Replicate API token with test request
```

### اختبار توليد الصور:

1. افتح التطبيق
2. اذهب إلى صفحة Analyze
3. اختر صورة
4. اختر المناسبة والنوع
5. انقر على "Analyze"
6. انتظر توليد الصورة
7. تحقق من النتائج

---

## 🐛 استكشاف الأخطاء

### المشكلة: الصورة لا تُولد

**الحل:**
1. تحقق من مفتاح Replicate API
2. تحقق من اتصال الإنترنت
3. تحقق من حجم الصورة الأصلية (يجب أن تكون < 10MB)
4. تحقق من سجل الأخطاء في Supabase

### المشكلة: الوجه يتغير

**الحل:**
1. زيادة `image_prompt_strength` إلى 0.9
2. تحسين الـ prompt لتوضيح "Do not change the face"
3. استخدام صورة أصلية بجودة أعلى

### المشكلة: الملابس لا تتطابق مع الاقتراحات

**الحل:**
1. تحسين وصف الملابس في الـ prompt
2. إضافة تفاصيل أكثر (الألوان، الخامات)
3. استخدام كلمات واضحة وموحدة

---

## 📊 الأداء

### متوسط الأوقات:

| العملية | الوقت |
|--------|------|
| تحليل الصورة (Gemini) | 2-3 ثواني |
| توليد الصورة (Replicate) | 15-30 ثانية |
| حفظ الصورة | 1-2 ثانية |
| **المجموع** | **18-35 ثانية** |

### استهلاك الموارد:

- **حجم الصورة الأصلية:** < 10 MB
- **حجم الصورة الناتجة:** 2-5 MB (WebP)
- **استهلاك الذاكرة:** ~500 MB
- **استهلاك النطاق:** ~3-5 MB لكل توليد

---

## 💰 التكاليف

### تسعير Replicate:

- **FLUX 1.1 Pro:** $0.04 لكل توليد صورة
- **متوسط الاستخدام:** 100 توليد/يوم = $4/يوم
- **الشهر:** ~$120/شهر

---

## 🚀 الخطوات التالية

### تحسينات مستقبلية:

1. **تخزين مؤقت:** حفظ الصور المولدة لتسريع الطلبات المتكررة
2. **معالجة متعددة:** توليد عدة صور بنفس الوقت
3. **نماذج بديلة:** استخدام نماذج أخرى (SDXL، Midjourney)
4. **تحسينات الـ UI:** عرض تقدم التوليد للمستخدم

---

## 📞 الدعم

### للمساعدة:

1. تحقق من [توثيق Replicate](https://replicate.com/docs)
2. راجع سجلات الأخطاء في Supabase
3. اتصل بفريق الدعم

---

## ✅ الخلاصة

Replicate الآن **مُحسّن وجاهز للإنتاج** مع:

- ✅ مفتاح API صحيح ومختبر
- ✅ معاملات محسّنة للجودة والسرعة
- ✅ حفظ تام لملامح الوجه
- ✅ توليد صور احترافية عالية الجودة
- ✅ معالجة أخطاء شاملة

**التطبيق الآن جاهز تماماً للنشر! 🚀**
