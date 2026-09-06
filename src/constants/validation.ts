/**
 * Shared shape check for an address. THE only definition of this pattern under
 * `src/`, outside the suite.
 *
 * The literal is byte for byte the one that used to be copied in seven files,
 * under two different names (ADR 0087). Do not "improve" the pattern, do not add
 * the `i` flag and do not replace it with `z.email()`: the behaviour of the
 * seven existing gates has to stay identical, and the SSO gate of F-023 has to
 * agree with the one that guards user creation.
 *
 * NO `g` flag, and that is load-bearing: a global RegExp carries `lastIndex`
 * between calls, so `.test()` would return alternating answers for the same
 * input once a single instance is shared across modules.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
