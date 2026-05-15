import { AuthForm } from "../features/auth/AuthForm";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function ResetPassword() {
  useDocumentTitle("Reset Password");
  return <AuthForm mode="reset" />;
}
