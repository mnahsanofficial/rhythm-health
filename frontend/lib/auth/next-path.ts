/** Where to go after signing in. Only same-site paths, so `?next=` can't send anyone off-site. */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
