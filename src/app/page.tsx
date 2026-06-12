import { redirect } from "next/navigation";

/**
 * Root. There is no public landing page in v1 — send everyone to /feed, which
 * the middleware/session gate routes to /login when unauthenticated.
 */
export default function RootPage() {
  redirect("/feed");
}
