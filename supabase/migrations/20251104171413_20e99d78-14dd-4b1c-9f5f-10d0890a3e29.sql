-- Add generated_image_url column to style_analyses table
ALTER TABLE style_analyses ADD COLUMN IF NOT EXISTS generated_image_url TEXT;