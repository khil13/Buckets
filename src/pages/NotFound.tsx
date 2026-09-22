import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="rounded-lg border border-bucket-border bg-bucket-surface p-4 text-sm">
      <p className="mb-2 font-medium">Page not found.</p>
      <p className="mb-3 text-bucket-muted">
        This can also happen if this tab was open from before an update — try a hard refresh.
      </p>
      <Link to="/" className="text-bucket-orange hover:underline">
        Back to today's slate
      </Link>
    </div>
  );
}
