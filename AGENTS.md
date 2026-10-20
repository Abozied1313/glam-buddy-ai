# Architecture rules
- Store optional outfit preferences and bounded prior outfit history in the existing analysis_result JSON, avoiding a schema migration for customization.
- Generate retries from the stored original photo and server-read outfit history, never from the generated image, to preserve identity and make variation explicit.
- Keep Google Cloud as the existing image-editing relay; analyze garment references server-side with the existing Gemini analysis model and pass the resulting exact garment description to the unchanged relay contract.- Enforce daily quotas server-side by counting usage_events rows in a rolling 24h window, so resets are automatic and need no cron job.
- Keep the fashion chat text-only in its own edge function, separate from analyze-style, so chat can never trigger image renders.
