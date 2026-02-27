-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enums
create type page_type as enum (
  'homepage', 'blog_post', 'category', 'product',
  'service', 'landing', 'about', 'contact', 'other'
);
create type confidence_level as enum ('low', 'medium', 'high');
create type suggestion_status as enum ('pending', 'approved', 'rejected');
create type crawl_status as enum ('running', 'completed', 'failed');
create type article_source as enum ('paste', 'google_doc');

-- Projects
create table projects (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  domain text not null,
  sitemap_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, domain)
);

-- Pages (site inventory)
create table pages (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  url text not null,
  title text,
  meta_description text,
  h1 text,
  h2s text[],
  page_type page_type not null default 'other',
  priority integer not null default 50 check (priority between 0 and 100),
  word_count integer,
  status_code integer,
  last_crawled_at timestamptz,
  unique (project_id, url)
);

-- Articles (drafts to be linked)
create table articles (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  source article_source not null default 'paste',
  google_doc_id text,
  content_text text not null,
  word_count integer,
  created_at timestamptz not null default now()
);

-- Link suggestions
create table suggestions (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid not null references articles(id) on delete cascade,
  target_page_id uuid references pages(id) on delete set null,
  target_url text not null,
  anchor_text text not null,
  anchor_refinement text,
  page_type page_type,
  relevance_score numeric(3,2) not null check (relevance_score between 0 and 1),
  confidence confidence_level not null default 'medium',
  paragraph_index integer,
  sentence_index integer,
  char_start integer not null,
  char_end integer not null,
  justification text not null,
  duplicate_flag boolean not null default false,
  over_optimization_flag boolean not null default false,
  status suggestion_status not null default 'pending',
  gdoc_start_index integer,
  gdoc_end_index integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Google OAuth tokens
create table google_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text not null,
  unique (user_id)
);

-- Crawl logs
create table crawl_logs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  status crawl_status not null default 'running',
  total_urls integer,
  crawled_urls integer not null default 0,
  failed_urls integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Updated_at trigger for projects
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

-- Row Level Security
alter table projects enable row level security;
alter table pages enable row level security;
alter table articles enable row level security;
alter table suggestions enable row level security;
alter table google_tokens enable row level security;
alter table crawl_logs enable row level security;

-- RLS Policies: projects
create policy "Users see own projects" on projects
  for all using (owner_id = auth.uid());

-- RLS Policies: pages (via project ownership)
create policy "Users see own pages" on pages
  for all using (
    project_id in (select id from projects where owner_id = auth.uid())
  );

-- RLS Policies: articles
create policy "Users see own articles" on articles
  for all using (
    project_id in (select id from projects where owner_id = auth.uid())
  );

-- RLS Policies: suggestions
create policy "Users see own suggestions" on suggestions
  for all using (
    article_id in (
      select a.id from articles a
      join projects p on p.id = a.project_id
      where p.owner_id = auth.uid()
    )
  );

-- RLS Policies: google_tokens
create policy "Users see own tokens" on google_tokens
  for all using (user_id = auth.uid());

-- RLS Policies: crawl_logs
create policy "Users see own crawl logs" on crawl_logs
  for all using (
    project_id in (select id from projects where owner_id = auth.uid())
  );

-- Indexes for performance
create index pages_project_id_idx on pages (project_id);
create index articles_project_id_idx on articles (project_id);
create index suggestions_article_id_idx on suggestions (article_id);
create index crawl_logs_project_id_idx on crawl_logs (project_id);
