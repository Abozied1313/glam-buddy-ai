# Dedicated chat credential migration
- [x] Prepare direct text-only Gemini streaming with the existing Gateway path retained only while the dedicated secret is absent.
- [x] Validate synthetic stream, persistence, errors and refund tests (16 chat tests; 29 application tests total).
- [x] Activation authorized: GEMINI_CHAT_API_KEY presence verified; only fashion-chat deployed; one synthetic direct Gemini request returned HTTP 200 and STOP with text. Website and all other functions unchanged.

# Current repair round (prepared only; no production migration or deployment)
- [ ] Atomic render/chat reservations, idempotency, rolling availability, regression tests.
- [ ] Direct configurable Gemini analysis/chat; trust boundaries and relay safeguards.
- [ ] Honest copy, consent, privacy, owner-only deletion controls.
- [ ] Backend/source safeguards, repository cleanup, operations document.
- [ ] Synthetic verification and explicit activation blockers.

# Outfit customization
- [x] Add optional garment photo and written outfit request.
- [x] Preserve preferences and original photo across retries; request a wholly different outfit and personalized colors.
- [x] Validate private reference uploads and test the rules (5 passing tests).
- [x] Deploy analysis changes; authenticated written-request and retry calls returned generated images successfully.
- [ ] Verify reference-photo generation visually end-to-end: blocked by unavailable stored photos; needs a new user-uploaded original and garment reference.
# Remaining specs
- [x] Replace fixed occasions with optional free-text "where are you heading" field.
- [x] Text-only fashion chat (one conversation, saved) on analysis and results pages; images only via "ولّد إطلالتي".
- [x] Daily quotas: 3 renders, 15 chat messages, rolling 24h, counters + disabled inputs.
