/** Lightweight placeholder shown instantly while a tab page streams in. */
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="sk" style={{ height: 88, borderRadius: 20, marginBottom: 12 }} />
      <div className="sk" style={{ height: 140, borderRadius: 20, marginBottom: 12 }} />
      {Array.from({ length: rows }).map((_, index) => (
        <div className="sk" key={index} style={{ height: 56, borderRadius: 14, marginBottom: 8 }} />
      ))}
    </div>
  );
}
