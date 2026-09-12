-- BYOK across providers.
--
-- One key per provider rather than one key: switching provider used to mean
-- the stored key belonged to the *previous* one, which fails as an opaque 401
-- rather than as "you haven't given me an OpenAI key".
--
-- The provider is deliberately its own plain column and not folded into the
-- encrypted value. It isn't a secret, and putting it inside the ciphertext
-- would mean a misconfigured ENCRYPTION_KEY leaves you unable to tell which
-- provider a user even chose.
--
-- Safe to run more than once.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS api_provider TEXT  NOT NULL DEFAULT 'anthropic',
    -- { "anthropic": "<iv:tag:ciphertext>", "openai": "...", "gemini": "..." }
    ADD COLUMN IF NOT EXISTS api_keys     JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Everyone who has a key today gave an Anthropic one, since that was the only
-- provider. Move it under that name, leaving api_key_encrypted alone so a
-- rollback to the previous deploy still finds it.
UPDATE users
SET api_keys = jsonb_build_object('anthropic', api_key_encrypted)
WHERE api_key_encrypted IS NOT NULL
  AND NOT (api_keys ? 'anthropic');
