-- Run this in Supabase SQL Editor to set up the database

-- Users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User books
CREATE TABLE public.user_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT DEFAULT '',
  genre TEXT DEFAULT '',
  cover_url TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User photos (bookshelf uploads)
CREATE TABLE public.user_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_user_books_user_id ON public.user_books(user_id);
CREATE INDEX idx_user_photos_user_id ON public.user_photos(user_id);

-- RLS: users and books are publicly readable, writable only by owner
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_photos ENABLE ROW LEVEL SECURITY;

-- Users: anyone can read, only owner can insert/update
CREATE POLICY "Users are publicly readable"
  ON public.users FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE USING (auth.uid() = id);

-- Books: anyone can read, only owner can modify
CREATE POLICY "Books are publicly readable"
  ON public.user_books FOR SELECT USING (true);

CREATE POLICY "Owner can insert books"
  ON public.user_books FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update books"
  ON public.user_books FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Owner can delete books"
  ON public.user_books FOR DELETE USING (auth.uid() = user_id);

-- Photos: owner only (private)
CREATE POLICY "Owner can read own photos"
  ON public.user_photos FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert photos"
  ON public.user_photos FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update photos"
  ON public.user_photos FOR UPDATE USING (auth.uid() = user_id);

-- Storage bucket: bookshelf-photos (create via Supabase dashboard)
-- Set to private, with policy: authenticated users can upload to their own folder
-- Path pattern: {user_id}/*
