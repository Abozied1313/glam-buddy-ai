export const availabilityText = (date: string | null | undefined) => date ? `الإتاحة التالية: ${new Date(date).toLocaleString('ar-EG')}` : 'تعذر تحديد وقت الإتاحة؛ أعد تحديث الحصة.';
