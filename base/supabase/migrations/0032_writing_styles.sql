-- Cycle 0026 — Writing Styles (schema.md §2.18; architecture.md §4.1 position 1).
-- Built-ins (user_id NULL, is_built_in TRUE) readable by every authenticated user.
-- User rows fully owner-scoped (user_id = auth.uid()). Completes the FK stub from
-- supabase/migrations/0004_characters.sql:24. Seeds the 3 built-ins verbatim
-- from References/PersonaLLM/ExtraDocuments/PresetPrompts.md.

create table public.writing_styles (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references public.users(id) on delete cascade,
  name                   text not null,
  is_built_in            boolean not null default false,
  writing_instructions   text not null,
  default_authors_note   text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.writing_styles enable row level security;

-- Built-ins visible to every authenticated user.
create policy writing_styles_select_builtin on public.writing_styles
  for select using (is_built_in = true);

-- Owner-scoped CRUD for user rows. Insert/update/delete forbidden for built-ins.
create policy writing_styles_select_own on public.writing_styles
  for select using (user_id = auth.uid());
create policy writing_styles_insert_own on public.writing_styles
  for insert with check (user_id = auth.uid() and is_built_in = false);
create policy writing_styles_update_own on public.writing_styles
  for update using (user_id = auth.uid() and is_built_in = false)
             with check (user_id = auth.uid() and is_built_in = false);
create policy writing_styles_delete_own on public.writing_styles
  for delete using (user_id = auth.uid() and is_built_in = false);

create trigger writing_styles_touch_updated_at
  before update on public.writing_styles
  for each row execute function public.touch_updated_at();

-- FK deferred from 0004_characters.sql:24. ON DELETE SET NULL so deleting a
-- writing style doesn't cascade-delete characters that reference it.
alter table public.characters
  add constraint characters_default_writing_style_id_fkey
    foreign key (default_writing_style_id)
    references public.writing_styles(id)
    on delete set null;

create index writing_styles_user_id_idx
  on public.writing_styles (user_id) where user_id is not null;

-- Seed built-ins (verbatim from References/PersonaLLM/ExtraDocuments/PresetPrompts.md).
insert into public.writing_styles (user_id, name, is_built_in, writing_instructions, default_authors_note) values
  (null, 'Roleplay', true,
   'Write from the character''s perspective using first person (I/me/my). Match the character''s established voice and vocabulary. Use "quotation marks" for spoken dialogue. Use *asterisks* for actions, thoughts, and physical descriptions. Show emotions through body language and actions — don''t narrate feelings directly. React naturally to what the user says and does. Never control the user''s character — don''t write their actions, dialogue, or feelings. Keep responses to 1-2 short paragraphs. Favor quick back-and-forth over long monologues.',
   'Each response must move the scene forward — never repeat, recap, or stall. Stay grounded in the moment — react to what just happened before introducing anything new. End on something the user can react to: a question, an action, a shift in tension. Match the scene''s energy — don''t force humor into serious moments or drama into lighthearted ones.'),
  (null, 'Storybook', true,
   'You are a skilled author collaborating with the user on an interactive story. Write in close third person, giving voice to characters through their actions, dialogue, and inner thoughts. The user may write as their character or direct the story — embellish their stated actions with vivid prose, but never invent new actions, decisions, or feelings for the user''s character beyond what they describe. Favor strong verbs over adjective clusters — one precise sensory detail beats three vague ones. Aim for roughly 60% dialogue and character interaction, 40% narration and scene-setting. Show emotion through body language, dialogue cadence, and physical sensation — never state feelings directly. Give each character a distinct voice and mannerisms. Write 2-4 paragraphs per response. Vary sentence length and openings. End at a moment of tension, decision, or discovery — never wrap up a scene completely.',
   'Advance the plot every response — never recap or stall. Alternate action beats with quiet moments. Never describe the same emotion twice in a scene. Match the energy of the user''s input — terse action gets focused intensity, expansive writing gets met in kind. Maintain tonal consistency — tension resolves through story events, not sudden mood shifts. End on a hook.'),
  (null, 'Texting', true,
   'Write in first person as the character. Short, direct, and conversational — like talking face to face. 1-3 short lines per response. Keep actions minimal — a brief gesture or expression at most, not a scene. The focus is on what the character says, not what they do. React to the part of the user''s message that hits hardest — don''t address everything. Let tone come through word choice and rhythm. Incomplete thoughts are natural. Emoji only if it genuinely fits the character. A cold character is blunt and spare. A warm character is open and easy. The way someone speaks IS their personality — lean into that. Never over-explain. Never recap what the user said.',
   'Hard limit: 1-4 short lines. If you wrote more than 4 lines, cut it down. Each line should be a single thought — not a run-on sentence. No paragraphs. No monologues. No walls of text. If the character has a lot to say, pick the most impactful part and say only that. Short answers carry weight — not every message needs a follow-up question. Stay in the character''s voice — don''t drift toward formal or helpful. Match the user''s energy — terse gets terse, playful gets playful.');
