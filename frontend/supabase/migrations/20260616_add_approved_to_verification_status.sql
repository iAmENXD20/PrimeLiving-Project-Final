-- Add 'approved' to verification_status CHECK constraint for owner approval flow
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_verification_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_verification_status_check 
  CHECK (verification_status IN ('pending_verification', 'verified', 'approved', 'rejected'));
