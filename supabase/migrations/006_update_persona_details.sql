-- Update default persona names, taglines, and emojis

-- Mean guy → Marcus, with purple devil emoji
UPDATE personas SET name = 'Marcus', emoji = '😈', tagline = 'The bad apple'
  WHERE name = 'Mean guy' AND is_default = true;

-- Sol tagline
UPDATE personas SET tagline = 'The eternal optimist'
  WHERE name = 'Sol' AND is_default = true;

-- Mira tagline
UPDATE personas SET tagline = 'The reflective thinker'
  WHERE name = 'Mira' AND is_default = true;

-- Dash tagline
UPDATE personas SET tagline = 'The builder'
  WHERE name = 'Dash' AND is_default = true;

-- Rex: dinosaur emoji, new tagline
UPDATE personas SET emoji = '🦖', tagline = 'The straight-shooter'
  WHERE name = 'Rex' AND is_default = true;

-- Atlas tagline
UPDATE personas SET tagline = 'The unhelpful'
  WHERE name = 'Atlas' AND is_default = true;
