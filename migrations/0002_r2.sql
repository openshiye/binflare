-- Large ciphertext can live in R2; small pastes stay in D1.
ALTER TABLE pastes ADD COLUMN r2_key TEXT;
