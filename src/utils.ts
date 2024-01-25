import { validateAndParseAddress } from 'starknet';

export const DECIMALS = 18;

export const BIGINT_ZERO = BigInt(0);

export const ZERO_ADDRESS = validateAndParseAddress('0x0');

export async function getEntity(entity, id) {
  let item = await entity.loadEntity(id);

  if (!item) {
    item = new entity(id);
  }

  return item;
}
