// Shimmering placeholder blocks shown while a page's data loads — reads as
// "content is coming" instead of a blank spinner, which feels faster.

export function Skeleton({ w = '100%', h = 14, r = 8, style }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />
}

// A row of stat-card placeholders (dashboard header).
// Layout via Tailwind utilities; `.card` is the existing design-system class.
export function SkeletonStats({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4.5">
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
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center gap-3.5 px-4.5 py-4">
          <Skeleton w={38} h={38} r={10} />
          <div className="min-w-0 flex-1">
            <Skeleton w="45%" h={13} />
            <Skeleton w="70%" h={11} style={{ marginTop: 8 }} />
          </div>
          <Skeleton w={64} h={24} r={12} />
        </div>
      ))}
    </div>
  )
}
