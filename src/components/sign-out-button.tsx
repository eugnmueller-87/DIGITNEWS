import { signOut } from "@/app/(app)/actions";

/**
 * Sign-out control. Uses a server action + form so it works without client JS
 * and clears the session cookie server-side.
 */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        Abmelden
      </button>
    </form>
  );
}
