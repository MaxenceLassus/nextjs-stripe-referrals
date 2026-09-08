import { switchAccount, signOutAction } from './actions';

/**
 * Switch between demo accounts without a login.
 *
 * Labelled as insecure on screen because it is: there is no authentication in
 * this repository at all, on purpose. The referral module takes a user id from
 * its caller, and pretending otherwise here would hide the one seam an
 * integrator has to think about.
 */
export function AccountSwitcher({
  users,
  currentId,
}: {
  users: Array<{ id: string; email: string; name: string | null }>;
  currentId: string | null;
}) {
  if (users.length === 0) return null;

  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Demo accounts
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        No password, no session security. This exists so you can play both sides of a referral in
        one browser. It is not part of what you copy.
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {users.map((user) => (
          <li key={user.id}>
            <form action={switchAccount}>
              <input type="hidden" name="userId" value={user.id} />
              <button
                type="submit"
                className={`rounded-full border px-4 py-1.5 text-sm ${
                  user.id === currentId
                    ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {user.name || user.email}
              </button>
            </form>
          </li>
        ))}
      </ul>

      {currentId && (
        <form action={signOutAction} className="mt-4">
          <button type="submit" className="text-xs text-slate-500 underline hover:text-slate-700">
            Sign out
          </button>
        </form>
      )}
    </section>
  );
}
