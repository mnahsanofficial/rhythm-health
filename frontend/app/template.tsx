/** Moving between screens: a short settle that keeps your place. Not used for sections within a page. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div data-screen className="screen-enter flex flex-1 flex-col">{children}</div>;
}
