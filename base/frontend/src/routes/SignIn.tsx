import { AuthForm } from "../features/auth/AuthForm";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function SignIn() {
  useDocumentTitle("Sign In");
  return <AuthForm mode="signin" />;
}
