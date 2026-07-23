CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'bg')),
  theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  selected_profile_ids text[] NOT NULL DEFAULT ARRAY['software-development', 'hardware-supply']::text[] CHECK (
    cardinality(selected_profile_ids) > 0
    AND selected_profile_ids <@ ARRAY[
      'software-development',
      'maintenance-support',
      'saas-licensing',
      'hardware-supply',
      'networking',
      'cybersecurity',
      'cloud-infrastructure',
      'consulting-integration'
    ]::text[]
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
