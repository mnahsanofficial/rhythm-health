// Temporary: shows the shell and type scale until the home screen lands in the next chunk.
export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-4 px-4 py-12 sm:px-8">
      <p className="text-caption font-medium text-moss">Shell check</p>
      <h1 className="font-display text-headline tracking-tight sm:text-display">
        Stop guessing what works for you.
        <span className="block text-muted">Test it.</span>
      </h1>
      <p className="max-w-prose text-lead text-muted">
        Body copy in Instrument Sans. Times and numbers use tabular mono:{" "}
        <span className="font-mono tabular-nums text-ink">23:30 → 07:30 · 7.5 h</span>
      </p>
    </div>
  );
}
