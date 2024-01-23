export const DECIMALS = 18;

export const BIGINT_ZERO = BigInt(0);

export async function getEntity(entity, id) {
  let item = await entity.loadEntity(id);

  if (!item) {
    item = new entity(id);
  }

  return item;
}
