export function ProposalSkeleton() {
  return (
    <section aria-label="Preparing your experiment" className="mt-8 rounded-card border border-line bg-paper p-6 sm:p-8">
      <p role="status" className="text-lead font-medium">
        Finding a small change you can test…
      </p>
      <p className="mt-2 text-muted">Your plan and forecast will arrive together. This can take a little while.</p>
      <ol aria-label="What goes into your experiment" className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ["01", "A suitable question", "Check that this fits a small habit experiment."],
          ["02", "A plan for your day", "Shape one change around your routine."],
          ["03", "An honest forecast", "Estimate a range, including what is uncertain."],
        ].map(([number, title, description]) => (
          <li key={number} className="border-t border-line pt-3">
            <span aria-hidden="true" className="font-mono text-caption text-moss">{number}</span>
            <p className="mt-1 font-medium">{title}</p>
            <p className="mt-1 text-caption text-muted">{description}</p>
          </li>
        ))}
      </ol>
      <div aria-hidden="true" className="mt-7 space-y-5 motion-safe:animate-pulse">
        <div className="h-8 w-3/4 rounded-pill bg-line" />
        <div className="h-16 rounded-card bg-oat" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 rounded-card bg-oat" />
          <div className="h-24 rounded-card bg-moss-tint" />
        </div>
        <div className="h-24 rounded-card bg-oat" />
      </div>
    </section>
  );
}
