import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { SessionContext, type SessionState } from "./lib/session";
import { Home } from "./routes/Home";
import { Profile } from "./routes/Profile";
import { Characters } from "./routes/Characters";
import { CharacterNew } from "./routes/CharacterNew";
import { CharacterCreate } from "./routes/CharacterCreate";
import { CharacterEdit } from "./routes/CharacterEdit";
import { CharacterImport } from "./routes/CharacterImport";
import { CharacterGenerate } from "./routes/CharacterGenerate";
import { Chat } from "./routes/Chat";
import { Grammar } from "./routes/Grammar";
import { GrammarSettings } from "./routes/GrammarSettings";
import { Settings } from "./routes/Settings";
import { Gallery } from "./routes/Gallery";
import { ImageEngineSettings } from "./routes/ImageEngineSettings";
import { TextToSpeechSettings } from "./routes/TextToSpeechSettings";
import { VisualRoleplaySettings } from "./routes/VisualRoleplaySettings";
import { DataSecuritySettings } from "./routes/DataSecuritySettings";
import { TextEngineSettings } from "./routes/TextEngineSettings";
import { WritingStylesSettings } from "./routes/WritingStylesSettings";
import { MemoryEngineSettings } from "./routes/MemoryEngineSettings";
import { MemorySettings } from "./routes/MemorySettings";
import { RoleplaySettings } from "./routes/RoleplaySettings";
import { PromptEditor } from "./routes/PromptEditor";
import { SignIn } from "./routes/SignIn";
import { SignUp } from "./routes/SignUp";
import { ResetPassword } from "./routes/ResetPassword";
import { VerifyEmail } from "./routes/VerifyEmail";
import { NotFound } from "./routes/NotFound";
import { AppShell } from "./features/shell/AppShell";
import { SettingsLayout } from "./features/settings/SettingsLayout";

export function App() {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on subscribe, so no separate
    // getSession() call is needed to hydrate the initial state.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      setState({ status: "ready", session });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <SessionContext.Provider value={state}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/characters" element={<Characters />} />
            <Route path="/character/new" element={<CharacterNew />} />
            <Route path="/character/new/manual" element={<CharacterCreate />} />
            <Route path="/character/new/import" element={<CharacterImport />} />
            <Route path="/character/new/ai-generate" element={<CharacterGenerate />} />
            <Route path="/character/:id/edit" element={<CharacterEdit />} />
            <Route path="/chat/:characterId/:conversationId" element={<Chat />} />
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<Settings />} />
              <Route path="text-engine" element={<TextEngineSettings />} />
              <Route path="image-engine" element={<ImageEngineSettings />} />
              <Route path="visual-roleplay" element={<VisualRoleplaySettings />} />
              <Route path="text-to-speech" element={<TextToSpeechSettings />} />
              <Route path="grammar" element={<GrammarSettings />} />
              <Route path="prompt-editor" element={<PromptEditor />} />
              <Route path="writing-styles" element={<WritingStylesSettings />} />
              <Route path="memory" element={<MemorySettings />} />
              <Route path="roleplay" element={<RoleplaySettings />} />
              <Route path="memory-engine" element={<MemoryEngineSettings />} />
              <Route path="data-security" element={<DataSecuritySettings />} />
            </Route>
            <Route path="/grammar" element={<Grammar />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
        </Routes>
      </BrowserRouter>
    </SessionContext.Provider>
  );
}
