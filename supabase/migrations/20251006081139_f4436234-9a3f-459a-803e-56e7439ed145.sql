-- Rename default_price to price_per_unit to match code expectations
ALTER TABLE public.services 
RENAME COLUMN default_price TO price_per_unit;

-- Add schedulable column with default value true
ALTER TABLE public.services 
ADD COLUMN schedulable BOOLEAN NOT NULL DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.services.schedulable IS 'Indicates whether this service can be scheduled for appointments';
COMMENT ON COLUMN public.services.price_per_unit IS 'Price per unit for this service';