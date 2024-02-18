import { validateAndParseAddress } from 'starknet';
import { TokenHolder, Delegate, Governance } from '../.checkpoint/models';

export const DECIMALS = 18;

export const BIGINT_ZERO = BigInt(0);

export const ZERO_ADDRESS = validateAndParseAddress('0x0');

export async function getEntity(entity, id) {
  let item = await entity.loadEntity(id);

  if (!item) {
    item = new entity(id);
  }

  if (entity === TokenHolder && id != ZERO_ADDRESS) {
    const governance = await getEntity(Governance, 'GOVERNANCE');
    governance.totalTokenHolders += 1;
    await governance.save();
  }

  if (entity === Delegate && id != ZERO_ADDRESS) {
    const governance = await getEntity(Governance, 'GOVERNANCE');
    governance.totalDelegates += 1;
    await governance.save();
  }

  return item;
}
