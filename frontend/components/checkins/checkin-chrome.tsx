import { button } from "@/components/ui/button";

export const primaryButton = `${button("primary")} text-lead`;
export const secondaryButton = button("secondary");

export function without(errors: Record<string, string>, key: string): Record<string, string> {
  const next = { ...errors };
  delete next[key];
  return next;
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-frame flex-1 pt-6 pb-16 sm:pt-10 [--frame:42rem]">
      {children}
    </div>
  );
}

/** Same shape as the form: header, three questions, the save button. */
export function CheckinSkeleton() {
  return (
    <div aria-hidden="true" className="page-frame pt-6 sm:pt-10 [--frame:42rem]">
      <div className="h-5 w-32 rounded-pill bg-line" />
      <div className="mt-8 h-3 w-36 rounded-pill bg-line" />
      <div className="mt-3 h-10 w-2/3 rounded-pill bg-line" />
      <div className="mt-3 h-4 w-full rounded-pill bg-line" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="mt-8">
          <div className="h-4 w-40 rounded-pill bg-line" />
          <div className="mt-3 grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }, (_, j) => (
              <div key={j} className="h-12 rounded-card bg-line/70" />
            ))}
          </div>
        </div>
      ))}
      <div className="mt-10 h-12 w-56 rounded-pill bg-line" />
    </div>
  );
}
