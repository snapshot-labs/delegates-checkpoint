import { validateAndParseAddress } from 'starknet';
import { starknet } from '@snapshot-labs/checkpoint';
import { formatUnits } from '@ethersproject/units';
import { TokenHolder, Delegate, Governance } from '../.checkpoint/models';
import { BIGINT_ZERO, DECIMALS, ZERO_ADDRESS, getEntity } from './utils';

export const handleDelegateChanged: starknet.Writer = async ({ event, source }) => {
  if (!event) return;

  console.log('Handle delegate changed', event);

  const governanceId = source?.contract || '';
  const delegator = validateAndParseAddress(event.delegator);
  const fromDelegate = validateAndParseAddress(event.from_delegate);
  const toDelegate = validateAndParseAddress(event.to_delegate);

  const tokenHolder: TokenHolder = await getEntity(TokenHolder, delegator, governanceId);
  const previousDelegate: Delegate = await getEntity(Delegate, fromDelegate, governanceId);
  const newDelegate: Delegate = await getEntity(Delegate, toDelegate, governanceId);

  tokenHolder.delegate = toDelegate;
  await tokenHolder.save();

  previousDelegate.tokenHoldersRepresentedAmount -= 1;
  await previousDelegate.save();

  newDelegate.tokenHoldersRepresentedAmount += 1;
  await newDelegate.save();
};

export const handleDelegateVotesChanged: starknet.Writer = async ({ event, source }) => {
  if (!event) return;

  console.log('Handle delegate votes changed', event);

  const governanceId = source?.contract || '';
  const governance: Governance = await getEntity(Governance, governanceId);
  const delegate: Delegate = await getEntity(
    Delegate,
    validateAndParseAddress(event.delegate),
    governanceId
  );

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

export const handleTransfer: starknet.Writer = async ({ event, source }) => {
  if (!event) return;

  console.log('Handle transfer', event);

  let governanceUpdated = false;
  let fromHolderUpdated = false;
  const from = validateAndParseAddress(event.from);
  const to = validateAndParseAddress(event.to);

  const governanceId = source?.contract || '';
  const [fromHolder, toHolder, governance] = await Promise.all([
    getEntity(TokenHolder, from, governanceId),
    getEntity(TokenHolder, to, governanceId),
    getEntity(Governance, governanceId)
  ]);

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

    fromHolderUpdated = true;
  }

  const toHolderPreviousBalance = toHolder.tokenBalanceRaw;
  toHolder.tokenBalanceRaw = (BigInt(toHolder.tokenBalanceRaw) + BigInt(event.value)).toString();
  toHolder.tokenBalance = formatUnits(toHolder.tokenBalanceRaw, DECIMALS);
  toHolder.totalTokensHeldRaw = (
    BigInt(toHolder.totalTokensHeldRaw) + BigInt(event.value)
  ).toString();
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

  await Promise.all([
    toHolder.save(),
    fromHolderUpdated ? fromHolder.save() : undefined,
    governanceUpdated ? governance.save() : undefined
  ])
};
