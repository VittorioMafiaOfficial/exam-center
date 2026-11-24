create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'student'
    check (role in ('admin', 'student')),
  grade integer check (grade in (10, 11, 12)),
  created_at timestamptz default now()
);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  grade integer not null check (grade in (10, 11, 12)),
  duration_minutes integer not null,
  is_published boolean default false,
  created_at timestamptz default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.exams(id) on delete cascade,
  question_text text not null,
  options jsonb not null,
  correct_answer text not null
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.exams(id),
  student_id uuid references public.profiles(id),
  answers jsonb default '{}',
  score numeric,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;

create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "Admins can read all profiles"
on public.profiles for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);
