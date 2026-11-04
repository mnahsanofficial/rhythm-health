import Link from "next/link";
import { sectionOf } from "@/lib/nav/routes";

/** The one way back from a detail page: top left, and it says where it goes. */
export function BackLink({ href, label, className = "" }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label={`Back to ${label}`}
      className={`-mx-1 inline-flex min-h-11 items-center px-1 text-body text-moss hover:underline ${className}`}
    >
      {"‹ "}
      {label}
    </Link>
  );
}

/** A section you came from wins over the page's usual parent, so a report opened from History goes back to History. */
export function backTarget(previous: string | null, parent: { href: string; label: string }) {
  return sectionOf(previous) ?? parent;
}
