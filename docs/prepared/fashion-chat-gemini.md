# Dedicated fashion chat Gemini migration (prepared, not deployed)

- Only fashion-chat changes. Image analysis, GEMINI_API_KEY, relay, UI, authentication and rolling quotas are unchanged.
- With GEMINI_CHAT_API_KEY absent, the existing Lovable Gateway model/path remains selected and uses existing Lovable credits.
- With GEMINI_CHAT_API_KEY configured, use direct Google REST `streamGenerateContent?alt=sse`, model `gemini-3.5-flash-lite`. Do not retry through Gateway on rate limits, invalid credentials, refusals, truncated streams or any other direct-path error.
- Dedicated key is sent only via server-side `x-goog-api-key`. No frontend credential, query-string credential, key logging or raw provider error exposure.
- Preserve the system prompt, 30-message server history, user-first persistence, OpenAI-shaped client SSE deltas, DONE after successful assistant persistence, quota refund before any visible response, and partial-response persistence without refund.

## Official verification (2026-11-11, no inference)

- [Model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite): stable exact model ID, text output; no image generation.
- [Pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite): standard text input and output are free on the free tier.
- [Streaming API](https://ai.google.dev/api/generate-content): official `POST /v1beta/models/{model}:streamGenerateContent` contract.
- Catalog/docs establish model availability, not access for this owner's key. Account-specific availability remains unverified until secure configuration and an authorized check.
- Google free-tier access has rate limits and eligibility conditions. A paid-tier Google project may charge for the same endpoint; REST has no request field to enforce free-tier billing. Configure a key from a free-tier project without enabling billing. Free-tier data handling is governed by Google's terms (pricing says requests may be used to improve Google's products).

## Pending secure activation

GEMINI_CHAT_API_KEY is absent in the project secret-name listing. Owner must add it in Project Settings → Secrets (never chat/source). Existing GEMINI_API_KEY is not read or modified by this chat migration. No credentials, billing, production functions or website have been changed by this preparation. Deploy fashion-chat only after owner approval; deployed chat remains unchanged until then. No SQL migration is needed.

## Validation

Synthetic Vitest coverage: provider selection, native payload/history, single request/no fallback, split UTF-8 SSE, thought filtering, completion, errors/refusals/malformed frames, truncated/partial responses, persistence failures and unchanged 15-message fail-closed quota. No real AI generation or real-data writes/deletion.