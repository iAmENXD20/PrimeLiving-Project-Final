-- Drop old CHECK constraint and add new one with expanded payment modes
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_mode_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_mode_check 
  CHECK (payment_mode IN ('gcash', 'maya', 'cash', 'bank_transfer'));

-- Update any existing 'qr' values to 'gcash' (most common QR payment in PH)
UPDATE payments SET payment_mode = 'gcash' WHERE payment_mode = 'qr';
