-- Optional last day of a trip so a stay can be stored as a range
-- (for example 26–30 October). Existing rows stay single-day until edited.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS return_date DATE;
