import { AuthForm } from "../features/auth/AuthForm";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function SignUp() {
  useDocumentTitle("Sign Up");
  return <AuthForm mode="signup" />;
}
