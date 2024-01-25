import { validateAndParseAddress } from 'starknet';
import { CheckpointWriter } from '@snapshot-labs/checkpoint';
import { formatUnits } from '@ethersproject/units';
import { TokenHolder, Delegate, Governance } from '../.checkpoint/models';
import { BIGINT_ZERO, DECIMALS, ZERO_ADDRESS, getEntity } from './utils';

export const handleDelegateChanged: CheckpointWriter = async ({ event }) => {
  if (!event) return;

  console.log('Handle delegate changed', event);

  const delegator = validateAndParseAddress(event.delegator);
  const fromDelegate = validateAndParseAddress(event.from_delegate);
  const toDelegate = validateAndParseAddress(event.to_delegate);

  const tokenHolder: TokenHolder = await getEntity(TokenHolder, delegator);
  const previousDelegate: Delegate = await getEntity(Delegate, fromDelegate);
  const newDelegate: Delegate = await getEntity(Delegate, toDelegate);

  tokenHolder.delegate = toDelegate;
  await tokenHolder.save();

  previousDelegate.tokenHoldersRepresentedAmount -= 1;
  await previousDelegate.save();

  newDelegate.tokenHoldersRepresentedAmount += 1;
  await newDelegate.save();
};

export const handleDelegateVotesChanged: CheckpointWriter = async ({ event }) => {
  if (!event) return;

  console.log('Handle delegate votes changed', event);

  const governance: Governance = await getEntity(Governance, 'GOVERNANCE');
  const delegate: Delegate = await getEntity(Delegate, validateAndParseAddress(event.delegate));

  delegate.delegatedVotesRaw = BigInt(event.new_votes).toString();
  delegate.delegatedVotes = formatUnits(event.new_votes, DECIMALS);
  await delegate.save();

  if (event.previous_votes == BIGINT_ZERO && event.new_votes > BIGINT_ZERO)
    governance.currentDelegates += 1;

  if (event.new_votes == BIGINT_ZERO) governance.currentDelegates -= 1;

  const votesDiff = BigInt(event.new_votes) - BigInt(event.previous_votes);
  governance.delegatedVotesRaw = (BigInt(governance.delegatedVotesRaw) + votesDiff).toString();
  governance.delegatedVotes = formatUnits(governance.delegatedVotesRaw, DECIMALS);
  await governance.save();
};

export const handleTransfer: CheckpointWriter = async ({ event }) => {
  if (!event) return;

  console.log('Handle transfer', event);

  let governanceUpdated = false;
  const from = validateAndParseAddress(event.from);
  const to = validateAndParseAddress(event.to);

  const fromHolder: TokenHolder = await getEntity(TokenHolder, from);
  const toHolder: TokenHolder = await getEntity(TokenHolder, to);
  const governance: Governance = await getEntity(Governance, 'GOVERNANCE');

  if (from != ZERO_ADDRESS) {
    const fromHolderPreviousBalance = fromHolder.tokenBalanceRaw;
    fromHolder.tokenBalanceRaw = (
      BigInt(fromHolder.tokenBalanceRaw) - BigInt(event.value)
    ).toString();
    fromHolder.tokenBalance = formatUnits(fromHolder.tokenBalanceRaw, DECIMALS);

    if (
      BigInt(fromHolder.tokenBalanceRaw) == BIGINT_ZERO &&
      BigInt(fromHolderPreviousBalance) > BIGINT_ZERO
    ) {
      governance.currentTokenHolders -= 1;
      governanceUpdated = true;
    } else if (
      BigInt(fromHolder.tokenBalanceRaw) > BIGINT_ZERO &&
      BigInt(fromHolderPreviousBalance) == BIGINT_ZERO
    ) {
      governance.currentTokenHolders += 1;
      governanceUpdated = true;
    }

    await fromHolder.save();
  }

  const toHolderPreviousBalance = toHolder.tokenBalanceRaw;
  toHolder.tokenBalanceRaw = toHolder.tokenBalanceRaw + BigInt(event.value);
  toHolder.tokenBalance = formatUnits(toHolder.tokenBalanceRaw, DECIMALS);
  toHolder.totalTokensHeldRaw = toHolder.totalTokensHeldRaw + BigInt(event.value);
  toHolder.totalTokensHeld = formatUnits(toHolder.totalTokensHeldRaw, DECIMALS);

  if (
    BigInt(toHolder.tokenBalanceRaw) == BIGINT_ZERO &&
    BigInt(toHolderPreviousBalance) > BIGINT_ZERO
  ) {
    governance.currentTokenHolders -= 1;
    governanceUpdated = true;
  } else if (
    BigInt(toHolder.tokenBalanceRaw) > BIGINT_ZERO &&
    BigInt(toHolderPreviousBalance) == BIGINT_ZERO
  ) {
    governance.currentTokenHolders += 1;
    governanceUpdated = true;
  }

  await toHolder.save();

  if (governanceUpdated) await governance.save();
};
