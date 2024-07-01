import { validateAndParseAddress } from 'starknet';
import { starknet } from '@snapshot-labs/checkpoint';
import { formatUnits } from '@ethersproject/units';
import { Delegate, Governance } from '../.checkpoint/models';
import { BIGINT_ZERO, DECIMALS, getGovernance, getDelegate } from './utils';

export const handleDelegateChanged: starknet.Writer = async ({ event, source }) => {
  if (!event) return;

  console.log('Handle delegate changed', event);

  const governanceId = source?.contract || '';
  const fromDelegate = validateAndParseAddress(event.from_delegate);
  const toDelegate = validateAndParseAddress(event.to_delegate);

  const previousDelegate: Delegate = await getDelegate(fromDelegate, governanceId);
  const newDelegate: Delegate = await getDelegate(toDelegate, governanceId);

  previousDelegate.tokenHoldersRepresentedAmount -= 1;
  await previousDelegate.save();

  newDelegate.tokenHoldersRepresentedAmount += 1;
  await newDelegate.save();
};

export const handleDelegateVotesChanged: starknet.Writer = async ({ event, source }) => {
  if (!event) return;

  console.log('Handle delegate votes changed', event);

  const governanceId = source?.contract || '';
  const governance: Governance = await getGovernance(governanceId);
  const delegate: Delegate = await getDelegate(
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
