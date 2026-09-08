/**
 * What a referrer is shown about the people they invited.
 *
 * This module deliberately never joins to your users table (see the schema
 * header), so whatever label you pass to `attachReferral` is what the referrer
 * will read. That makes the choice yours, and it is worth making on purpose:
 * the referrer already knows who they invited, so handing their friend's email
 * address back to them buys nothing and leaks an address your privacy policy
 * probably promised to keep.
 *
 * `maskEmail` is the safe default when you have nothing better than an address.
 * A display name or a company name is better still.
 */

/** `sarah.connor@example.com` -> `s••••••••••@example.com`. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '•••';

  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, 1);

  return `${head}${'•'.repeat(Math.max(local.length - 1, 2))}${domain}`;
}

/**
 * Best label available for an account, preferring what a human chose.
 *
 * Exported because the demo app uses it and because it is the shape most
 * callers want; nothing in the module requires you to use it.
 */
export function accountLabel(input: { name?: string | null; email?: string | null }): string {
  const name = input.name?.trim();
  if (name) return name.slice(0, 80);
  if (input.email) return maskEmail(input.email);
  return 'A referred account';
}
