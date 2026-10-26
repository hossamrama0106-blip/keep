-- شغّل هذا مرة واحدة في Supabase → SQL Editor (مشروع مجاني خاص بك)
create table if not exists train_state (
  id text primary key,          -- المعرّف السري الطويل الذي تكتبه في إعدادات التطبيق
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table train_state enable row level security;

-- تنبيه: أي شخص يملك anon key يستطيع قراءة/كتابة الصفوف. لذلك:
--  1) استخدم معرّفاً طويلاً عشوائياً (٣٠+ حرفاً) ولا تشاركه.
--  2) لا تضع مفتاح service_role في التطبيق أبداً.
create policy "anon read"   on train_state for select to anon using (true);
create policy "anon insert" on train_state for insert to anon with check (true);
create policy "anon update" on train_state for update to anon using (true) with check (true);

-- «الدستور»: ملف الـ 50 سؤالاً كـ JSON، يقرأه المدرب قبل أي نصيحة أو تعديل.
-- (نفس المعرّف السري كما في train_state)
create table if not exists user_neuro_profile (
  id text primary key,
  profile jsonb not null default '{}'::jsonb,   -- {"q1":{"q":"...","a":"..."}, ... "q50":{...}}
  answered int not null default 0,
  updated_at timestamptz default now()
);
alter table user_neuro_profile enable row level security;
create policy "anon read"   on user_neuro_profile for select to anon using (true);
create policy "anon insert" on user_neuro_profile for insert to anon with check (true);
create policy "anon update" on user_neuro_profile for update to anon using (true) with check (true);
-- تحذير: هذا الملف حساس (صحة نفسية). المعرّف الطويل العشوائي هو الحماية الوحيدة هنا؛
-- للحماية الحقيقية استخدم Supabase Auth وسياسات auth.uid().
