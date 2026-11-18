export default function Loading() {
  return (
    <div className="home" aria-busy="true" aria-label="Loading home">
      <div className="sk" style={{ aspectRatio: "16 / 9", borderRadius: 24 }} />
      <div style={{ display: "flex", gap: 14 }}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="sk"
            style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0 }}
          />
        ))}
      </div>
      <div className="stat-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="sk" style={{ height: 132, borderRadius: 24 }} />
        ))}
      </div>
      <div className="sk" style={{ height: 260, borderRadius: 24 }} />
      <div className="sk" style={{ height: 220, borderRadius: 24 }} />
    </div>
  );
}
