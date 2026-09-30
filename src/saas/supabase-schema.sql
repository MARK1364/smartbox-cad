-- ==============================================================================
-- SMARTPANEL CAD / BLOKI SAAS DATABASE SCHEMA (POSTGRESQL / SUPABASE)
-- ==============================================================================

-- 1. Tabela profili użytkowników (rozszerzenie auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    company_name TEXT,
    avatar_url TEXT,
    tier TEXT NOT NULL DEFAULT 'FREE' CHECK (tier IN ('FREE', 'PRO', 'ENTERPRISE')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela projektów CAD w chmurze
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    thumbnail_base64 TEXT,
    tags TEXT[] DEFAULT ARRAY['Meble'],
    version INTEGER NOT NULL DEFAULT 1,
    is_public_shared BOOLEAN DEFAULT FALSE,
    share_id TEXT UNIQUE,
    cad_document JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Indeksy pod szybkie wyszukiwanie
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_share_id ON public.projects(share_id) WHERE share_id IS NOT NULL;

-- 4. Włączenie Row Level Security (RLS) - Bezpieczeństwo wielodostępne
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Polityki dla profiles
CREATE POLICY "Użytkownicy mogą odczytywać swój profil" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Użytkownicy mogą edytować swój profil" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Polityki dla projects
CREATE POLICY "Właściciel ma pełny dostęp do swoich projektów" 
    ON public.projects FOR ALL 
    USING (auth.uid() = user_id);

CREATE POLICY "Publiczny odczyt udostępnionych projektów 3D" 
    ON public.projects FOR SELECT 
    USING (is_public_shared = TRUE);

-- 5. Funkcja automatycznego tworzenia profilu po rejestracji w Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, tier)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'tier', 'FREE')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger po rejestracji
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
