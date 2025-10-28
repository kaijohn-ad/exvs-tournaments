import { beforeEach, describe, expect, it } from 'vitest';
import {
	createBracketMatch,
	deleteBracketMatches,
	ensureBracketMatch,
	listBracketMatches,
	setBracketMatches,
	updateBracketMatch,
	__resetForTests
} from './bracket-matches';

describe('bracket matches repository', () => {
	beforeEach(() => {
		__resetForTests();
	});

	it('creates matches and lists them sorted by round then position', () => {
		createBracketMatch('tournament-1', {
			round: 2,
			position: 1,
			participant_a_type: 'pair',
			participant_a_pair_id: 'pair-3',
			participant_b_type: 'pair',
			participant_b_pair_id: 'pair-4'
		});

		createBracketMatch('tournament-1', {
			round: 1,
			position: 2,
			participant_a_type: 'pair',
			participant_a_pair_id: 'pair-2',
			participant_b_type: 'pair',
			participant_b_pair_id: 'pair-5'
		});

		createBracketMatch('tournament-1', {
			round: 1,
			position: 1,
			participant_a_type: 'pair',
			participant_a_pair_id: 'pair-1',
			participant_b_type: 'pair',
			participant_b_pair_id: 'pair-6'
		});

		const matches = listBracketMatches('tournament-1');

		expect(matches.map((m) => `${m.round}-${m.position}`)).toEqual(['1-1', '1-2', '2-1']);
	});

	it('setBracketMatches replaces existing matches and normalizes payload', () => {
		createBracketMatch('tournament-1', {
			round: 1,
			position: 1,
			participant_a_type: 'pair',
			participant_a_pair_id: 'pair-original',
			participant_b_type: 'pair',
			participant_b_pair_id: 'pair-original-2'
		});

		const results = setBracketMatches('tournament-1', [
			{
				id: 'match-1',
				round: 1,
				position: 1,
				participant_a_type: 'pair',
				participant_a_pair_id: ' pair-1 ',
				participant_b_type: 'bye'
			},
			{
				id: 'match-2',
				round: 2,
				position: 1,
				participant_a_type: 'pair',
				participant_a_pair_id: 'pair-9',
				participant_b_type: 'pair',
				participant_b_pair_id: 'pair-10',
				status: 'completed',
				score_a: 2,
				score_b: 1,
				winner_side: 'a'
			},
			{
				round: 0,
				position: 0,
				participant_a_type: 'pair',
				participant_b_type: 'pair'
			}
		]);

		expect(results).toHaveLength(2);
		expect(results[0]).toMatchObject({
			id: 'match-1',
			round: 1,
			position: 1,
			participant_a_pair_id: 'pair-1',
			participant_b_type: 'bye',
			participant_b_pair_id: null,
			status: 'pending',
			score_a: null,
			score_b: null,
			winner_side: null
		});
		expect(results[1]).toMatchObject({
			id: 'match-2',
			status: 'completed',
			score_a: 2,
			score_b: 1,
			winner_side: 'a'
		});
	});

	it('deleteBracketMatches clears tournament scope', () => {
		createBracketMatch('tournament-1', {
			round: 1,
			position: 1,
			participant_a_type: 'pair',
			participant_a_pair_id: 'pair-1',
			participant_b_type: 'bye'
		});

		createBracketMatch('tournament-2', {
			round: 1,
			position: 1,
			participant_a_type: 'pair',
			participant_a_pair_id: 'pair-8',
			participant_b_type: 'pair',
			participant_b_pair_id: 'pair-9'
		});

		deleteBracketMatches('tournament-1');

		expect(listBracketMatches('tournament-1')).toEqual([]);
		expect(listBracketMatches('tournament-2')).toHaveLength(1);
	});

	it('ensureBracketMatch returns existing match and throws for missing', () => {
		const created = createBracketMatch('tournament-ensure', {
			round: 1,
			position: 1,
			participant_a_type: 'pair',
			participant_a_pair_id: 'pair-a',
			participant_b_type: 'pair',
			participant_b_pair_id: 'pair-b'
		});

	const record = ensureBracketMatch('tournament-ensure', created.id);
	expect(record.id).toBe(created.id);

	expect(() =>
		ensureBracketMatch('tournament-ensure', 'missing-match')
	).toThrowError(/Bracket match not found/);
});

	it('updateBracketMatch mutates scores, status, participants and winner metadata', () => {
		const created = createBracketMatch('tournament-update', {
			round: 2,
			position: 3,
			participant_a_type: 'pair',
			participant_a_pair_id: 'pair-a',
			participant_b_type: 'pair',
			participant_b_pair_id: 'pair-b'
		});

		const updated = updateBracketMatch('tournament-update', created.id, {
			round: 3,
			position: 2,
			score_a: 3,
			score_b: 1,
			status: 'completed',
			winner_side: 'a',
			participant_a_type: 'pair',
			participant_a_pair_id: ' pair-a ',
			participant_b_type: 'bye',
			participant_b_pair_id: 'should-be-ignored'
		});

		expect(updated).toMatchObject({
			round: 3,
			position: 2,
			score_a: 3,
			score_b: 1,
			status: 'completed',
			winner_side: 'a',
			participant_a_type: 'pair',
			participant_a_pair_id: 'pair-a',
			participant_b_type: 'bye',
			participant_b_pair_id: null
		});

		const stored = ensureBracketMatch('tournament-update', created.id);
		expect(stored).toMatchObject({
			round: 3,
			position: 2,
			status: 'completed',
			winner_side: 'a'
		});
	});
});
