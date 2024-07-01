import { Delegate, Governance } from '../.checkpoint/models';

export const DECIMALS = 18;

export const BIGINT_ZERO = BigInt(0);

export async function getDelegate(id: string, governanceId: string): Promise<Delegate> {
  let delegate = await Delegate.loadEntity(`${governanceId}/${id}`);

  if (!delegate) {
    delegate = new Delegate(`${governanceId}/${id}`);
    delegate.governance = governanceId;
    delegate.user = id;
  }

  return delegate;
}

export async function getGovernance(id: string): Promise<Governance> {
  let governance = await Governance.loadEntity(id);

  if (!governance) {
    governance = new Governance(id);
  }

  return governance;
}
