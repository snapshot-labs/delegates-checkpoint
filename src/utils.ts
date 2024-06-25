import { validateAndParseAddress } from 'starknet';
import { TokenHolder, Delegate, Governance } from '../.checkpoint/models';

export const DECIMALS = 18;

export const BIGINT_ZERO = BigInt(0);

export const ZERO_ADDRESS = validateAndParseAddress('0x0');

export async function getEntity(entity, id: string, governanceId?: string) {
  let item = await entity.loadEntity(governanceId ? `${governanceId}/${id}` : id);

  if (!item) {
    item = new entity(governanceId ? `${governanceId}/${id}` : id);

    if (governanceId) {
      item.governance = governanceId;
      item.user = id;
    }
  }

  if (entity === TokenHolder && id != ZERO_ADDRESS && governanceId) {
    const governance = await getEntity(Governance, governanceId);
    governance.totalTokenHolders += 1;
    await governance.save();
  }

  if (entity === Delegate && id != ZERO_ADDRESS && governanceId) {
    const governance = await getEntity(Governance, governanceId);
    governance.totalDelegates += 1;
    await governance.save();
  }

  return item;
}
