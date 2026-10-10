export function BookSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-3 animate-pulse">
      <div className="flex justify-center mb-3">
        <div className="w-[94px] aspect-[3/4] rounded-md bg-muted" />
      </div>
      <div className="space-y-2 text-center">
        <div className="h-4 w-3/4 mx-auto rounded bg-muted" />
        <div className="h-3 w-1/2 mx-auto rounded bg-muted" />
        <div className="flex justify-center gap-1 pt-1">
          <div className="h-5 w-14 rounded-full bg-muted" />
          <div className="h-5 w-10 rounded-full bg-muted" />
        </div>
      </div>
    </div>
  )
}

export function BookSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <BookSkeleton key={i} />
      ))}
    </div>
  )
}
