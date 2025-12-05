import { createClient } from '@supabase/supabase-js'

// IMPORTANT: 
// 1. Create a new project at https://supabase.com/dashboard/projects
// 2. Go to Project Settings > API
// 3. Copy your Project URL and anon key and paste them here.
// FIX: Explicitly type constants as strings to avoid literal type comparison errors.
const supabaseUrl: string = "https://rsidzuktqudnhdqzkzso.supabase.co"
const supabaseAnonKey: string = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzaWR6dWt0cXVkbmhkcXprenNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMjgyMjcsImV4cCI6MjA3OTkwNDIyN30.Tqk2BFh2KeVG8BpsXhuC0ap3X_CsBUOFeEEh7CtuyCE"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const isSupabaseConfigured = supabaseUrl !== "YOUR_SUPABASE_URL" && supabaseAnonKey !== "YOUR_SUPABASE_ANON_KEY";