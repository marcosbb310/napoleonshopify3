-- Check pgcrypto extension status
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

-- If pgcrypto is not installed, run this:
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
