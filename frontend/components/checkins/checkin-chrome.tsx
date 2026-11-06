import { button } from "@/components/ui/button";

export const primaryButton = `${button("primary")} text-lead`;
export const secondaryButton = button("secondary");

export function without(errors: Record<string, string>, key: string): Record<string, string> {
  const next = { ...errors };
  delete next[key];
  return next;
}

export function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`page-frame flex-1 pt-6 pb-16 sm:pt-10 ${wide ? "[--frame:70rem]" : "[--frame:42rem]"}`}>
      {children}
    </div>
  );
}

/** Reserve the question, scene and choices while the saved answers load. */
export function CheckinSkeleton() {
  return <div role="status" aria-label="Loading check-in" className="page-frame pt-6 sm:pt-10 [--frame:70rem]">
    <span className="sr-only">Loading your check-in…</span>
    <div aria-hidden="true">
      <div className="h-5 w-36 rounded-pill bg-line" />
      <div className="mt-6 h-1 rounded-pill bg-line" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-x-12">
        <div className="lg:col-start-1 lg:row-start-1"><div className="h-10 w-4/5 rounded-pill bg-line" /><div className="mt-4 h-5 w-full rounded-pill bg-line" /></div>
        <div className="h-44 rounded-card bg-chart-band/50 sm:h-56 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:h-96" />
        <div className="grid grid-cols-5 gap-3 lg:col-start-1 lg:row-start-2">{Array.from({ length: 10 }, (_, i) => <div key={i} className="h-16 rounded-control bg-line/60" />)}</div>
      </div>
      <div className="mt-8 h-12 w-28 rounded-pill bg-line" />
    </div>
  </div>;
}
