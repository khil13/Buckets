import { Link } from "react-router-dom";

export function NavBar() {
  return (
    <header className="border-b border-bucket-border bg-bucket-surface">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-bucket-orange" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">Buckets</span>
        </Link>
        <Link to="/props" className="text-sm text-bucket-muted hover:text-bucket-text">
          Props
        </Link>
      </div>
    </header>
  );
}
