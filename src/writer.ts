import { validateAndParseAddress } from 'starknet';
import { CheckpointWriter } from '@snapshot-labs/checkpoint';
import { formatUnits } from '@ethersproject/units';
import { TokenHolder, Delegate, Governance } from '../.checkpoint/models';
import { BIGINT_ZERO, DECIMALS, getEntity } from './utils';

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

  // @TODO handle transfer https://github.com/snapshot-labs/delegates-subgraph/blob/main/src/mapping.ts#L48-L84
};
