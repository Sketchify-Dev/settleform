/**
 * NEAR account ids, and the one thing this product has to say about them.
 *
 * 1Click runs on mainnet: its token list carries no testnet asset, and every quote
 * settles to `intents.near`. A `foo.testnet` account is shaped exactly like a
 * mainnet one, so a validator that only checks the shape accepts it happily, and
 * then either the delivery leg has nowhere to land or a failed swap refunds to an
 * account that does not exist on mainnet. Money does not come back from that, so
 * both routes that take an account id use these checks rather than their own.
 */
export const NEAR_ACCOUNT = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

const TESTNET_SUFFIXES = [".testnet", ".betanet"];

export function isNearAccount(value: string): boolean {
  const account = value.trim();
  return account.length > 0 && account.length <= 64 && NEAR_ACCOUNT.test(account);
}

/** Whether an account id is on a NEAR test network, where no settlement can reach it. */
export function isTestnetAccount(value: string): boolean {
  const account = value.trim().toLowerCase();
  return TESTNET_SUFFIXES.some((suffix) => account.endsWith(suffix) || account === suffix.slice(1));
}

/** The settlement-account message, for the invoice routes and the create form alike. */
export function nearAccountError(value: string): string | null {
  if (!isNearAccount(value)) return "Enter a valid NEAR account, for example you.near.";
  if (isTestnetAccount(value))
    return "Settlement arrives on NEAR mainnet. A testnet account cannot receive it.";
  return null;
}
