-- Add number_of_rooms column for Boarding House and Dormitory classifications
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS number_of_rooms TEXT;
ALTER TABLE apartment_owners ADD COLUMN IF NOT EXISTS number_of_rooms TEXT;
