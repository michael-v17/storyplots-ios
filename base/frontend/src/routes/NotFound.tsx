import { Link } from "react-router-dom";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function NotFound() {
  useDocumentTitle("Not Found");
  return (
    <main data-testid="not-found" style={{ textAlign: "center", padding: "4rem 1rem" }}>
      <h1>Not found</h1>
      <Link to="/">Back to Home</Link>
    </main>
  );
}
