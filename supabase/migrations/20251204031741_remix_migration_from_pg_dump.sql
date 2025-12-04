CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: get_user_daily_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_daily_usage(p_user_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(DISTINCT project_id)::INT
  FROM analyses a
  JOIN projects p ON p.id = a.project_id
  WHERE p.user_id = p_user_id
    AND a.created_at >= date_trunc('day', now());
$$;


--
-- Name: get_user_monthly_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_monthly_usage(p_user_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(DISTINCT project_id)::INT
  FROM analyses a
  JOIN projects p ON p.id = a.project_id
  WHERE p.user_id = p_user_id
    AND a.created_at >= date_trunc('month', now());
$$;


--
-- Name: get_user_plan(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_plan(p_user_id uuid) RETURNS TABLE(plan_id uuid, plan_name text, plan_slug text, monthly_analyses integer, daily_analyses integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as plan_id,
    p.name as plan_name,
    p.slug as plan_slug,
    p.monthly_analyses,
    p.daily_analyses
  FROM user_subscriptions us
  JOIN plans p ON p.id = us.plan_id
  WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    AND (us.expires_at IS NULL OR us.expires_at > now())
  ORDER BY us.created_at DESC
  LIMIT 1;
  
  -- If no subscription, return free plan
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      p.id as plan_id,
      p.name as plan_name,
      p.slug as plan_slug,
      p.monthly_analyses,
      p.daily_analyses
    FROM plans p
    WHERE p.slug = 'free'
    LIMIT 1;
  END IF;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


SET default_table_access_method = heap;

--
-- Name: analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analyses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    type text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT analyses_type_check CHECK ((type = ANY (ARRAY['prd'::text, 'divulgacao'::text, 'captacao'::text, 'seguranca'::text, 'ui_theme'::text, 'ferramentas'::text, 'features'::text, 'melhorias'::text])))
);


--
-- Name: analysis_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analysis_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    project_id uuid,
    analysis_type text NOT NULL,
    tokens_estimated integer DEFAULT 0,
    cost_estimated numeric(10,6) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    model_used text DEFAULT 'google/gemini-2.5-flash'::text,
    depth_level text DEFAULT 'balanced'::text
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    monthly_analyses integer DEFAULT 0,
    daily_analyses integer DEFAULT 0,
    price_monthly numeric(10,2) DEFAULT 0,
    features jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    github_url text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    analysis_status text DEFAULT 'pending'::text,
    error_message text,
    user_id uuid,
    github_data jsonb
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value text NOT NULL,
    description text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_checklist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    analysis_id uuid NOT NULL,
    item_hash text NOT NULL,
    is_completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid,
    status text DEFAULT 'active'::text,
    started_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: analyses analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analyses
    ADD CONSTRAINT analyses_pkey PRIMARY KEY (id);


--
-- Name: analysis_usage analysis_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analysis_usage
    ADD CONSTRAINT analysis_usage_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: plans plans_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: projects projects_github_url_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_github_url_user_id_key UNIQUE (github_url, user_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: analyses unique_project_analysis_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analyses
    ADD CONSTRAINT unique_project_analysis_type UNIQUE (project_id, type);


--
-- Name: user_checklist_items user_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_checklist_items
    ADD CONSTRAINT user_checklist_items_pkey PRIMARY KEY (id);


--
-- Name: user_checklist_items user_checklist_items_user_id_analysis_id_item_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_checklist_items
    ADD CONSTRAINT user_checklist_items_user_id_analysis_id_item_hash_key UNIQUE (user_id, analysis_id, item_hash);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: user_subscriptions user_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: idx_analyses_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analyses_project_id ON public.analyses USING btree (project_id);


--
-- Name: idx_analyses_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analyses_type ON public.analyses USING btree (type);


--
-- Name: idx_analysis_usage_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analysis_usage_date ON public.analysis_usage USING btree (created_at DESC);


--
-- Name: idx_analysis_usage_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analysis_usage_model ON public.analysis_usage USING btree (model_used);


--
-- Name: idx_projects_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_created_at ON public.projects USING btree (created_at DESC);


--
-- Name: idx_projects_github_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_github_data ON public.projects USING gin (github_data);


--
-- Name: idx_user_checklist_analysis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_checklist_analysis ON public.user_checklist_items USING btree (user_id, analysis_id);


--
-- Name: analyses analyses_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analyses
    ADD CONSTRAINT analyses_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: analysis_usage analysis_usage_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analysis_usage
    ADD CONSTRAINT analysis_usage_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: user_checklist_items user_checklist_items_analysis_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_checklist_items
    ADD CONSTRAINT user_checklist_items_analysis_id_fkey FOREIGN KEY (analysis_id) REFERENCES public.analyses(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_subscriptions user_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: system_settings Admins can manage settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage settings" ON public.system_settings USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_subscriptions Admins can manage subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage subscriptions" ON public.user_subscriptions USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: analyses Admins can view all analyses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all analyses" ON public.analyses FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: projects Admins can view all projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all projects" ON public.projects FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_subscriptions Admins can view all subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all subscriptions" ON public.user_subscriptions FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: analysis_usage Admins can view all usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all usage" ON public.analysis_usage FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: system_settings Admins can view settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view settings" ON public.system_settings FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: plans Only admins can manage plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can manage plans" ON public.plans USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: plans Plans are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Plans are viewable by everyone" ON public.plans FOR SELECT USING (true);


--
-- Name: system_settings Service role can read settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can read settings" ON public.system_settings FOR SELECT USING (true);


--
-- Name: analyses Users can create analyses for own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create analyses for own projects" ON public.analyses FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects
  WHERE ((projects.id = analyses.project_id) AND (projects.user_id = auth.uid())))));


--
-- Name: user_checklist_items Users can create own checklist items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own checklist items" ON public.user_checklist_items FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: projects Users can create own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own projects" ON public.projects FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_checklist_items Users can delete own checklist items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own checklist items" ON public.user_checklist_items FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: projects Users can delete own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: analysis_usage Users can insert own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own usage" ON public.analysis_usage FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_checklist_items Users can update own checklist items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own checklist items" ON public.user_checklist_items FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: projects Users can update own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: analyses Users can view own analyses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own analyses" ON public.analyses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.projects
  WHERE ((projects.id = analyses.project_id) AND (projects.user_id = auth.uid())))));


--
-- Name: user_checklist_items Users can view own checklist items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own checklist items" ON public.user_checklist_items FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: projects Users can view own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_subscriptions Users can view own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own subscription" ON public.user_subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: analysis_usage Users can view own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own usage" ON public.analysis_usage FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: analyses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

--
-- Name: analysis_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analysis_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_checklist_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_checklist_items ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


