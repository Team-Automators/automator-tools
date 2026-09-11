// Shimmering placeholder blocks shown while a page's data loads — reads as
// "content is coming" instead of a blank spinner, which feels faster.

export function Skeleton({ w = '100%', h = 14, r = 8, style }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />
}

// A row of stat-card placeholders (dashboard header).
export function SkeletonStats({ count = 4 }) {
  return (
    <div className="skel-stats">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card skel-stat">
          <Skeleton w="40%" h={12} />
          <Skeleton w="60%" h={26} style={{ marginTop: 12 }} />
        </div>
      ))}
    </div>
  )
}

// A list of row placeholders (recent items, tables, cards).
export function SkeletonList({ rows = 5 }) {
  return (
    <div className="skel-list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card skel-row">
          <Skeleton w={38} h={38} r={10} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skeleton w="45%" h={13} />
            <Skeleton w="70%" h={11} style={{ marginTop: 8 }} />
          </div>
          <Skeleton w={64} h={24} r={12} />
        </div>
      ))}
    </div>
  )
}
