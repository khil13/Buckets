export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-bucket-border bg-bucket-surface p-4">
      <div className="mb-3 h-3 w-16 rounded bg-bucket-border" />
      <div className="mb-2 h-4 w-40 rounded bg-bucket-border" />
      <div className="h-4 w-32 rounded bg-bucket-border" />
    </div>
  );
}
