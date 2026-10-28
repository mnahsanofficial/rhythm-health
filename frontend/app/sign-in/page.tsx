import type { Metadata } from "next";
import { Suspense } from "react";
import { SignIn } from "@/components/auth/sign-in";

export const metadata: Metadata = {
  title: "Sign in · Rhythm",
};

export default function SignInPage() {
  return (
    <div className="mx-auto w-full max-w-md flex-1 px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
      {/* SignIn reads ?next=, which only exists in the browser. */}
      <Suspense fallback={<FormSkeleton />}>
        <SignIn />
      </Suspense>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="h-10 w-2/3 rounded-pill bg-line" />
      <div className="mt-8 h-3 w-12 rounded-pill bg-line" />
      <div className="mt-2 h-12 rounded-card bg-line/70" />
      <div className="mt-4 h-3 w-16 rounded-pill bg-line" />
      <div className="mt-2 h-12 rounded-card bg-line/70" />
      <div className="mt-6 h-12 rounded-pill bg-line" />
    </div>
  );
}
