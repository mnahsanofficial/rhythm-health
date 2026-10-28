import { AuthPanel } from "@/components/auth-panel";
import { BackendStatus } from "@/components/backend-status";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center gap-3 px-4 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Rhythm Health Lab
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Stop guessing what works for you. Test it.
      </h1>
      <BackendStatus />
      <AuthPanel />
    </main>
  );
}
