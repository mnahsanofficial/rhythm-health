import { notFound } from "next/navigation";
import { FailureDrill } from "./trigger";

export default function Page() {
  if (process.env.NODE_ENV !== "development" || process.env.DEV_FAILURE_DRILL !== "1") notFound();
  return <FailureDrill />;
}
