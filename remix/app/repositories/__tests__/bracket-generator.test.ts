import { describe, expect, it, vi } from 'vitest';
import {
	generateAndStoreSingleEliminationBracket,
	generateSingleEliminationBracketMatches
} from '../bracket-generator';
import type { PairRecord } from '../pairs';

const createPair = (id: string, seed?: number | null): PairRecord => ({
	id,
	event_id: 'event-1',
	player1_id: `${id}-p1`,
	player2_id: `${id}-p2`,
	seed: seed ?? null,
	created_at: new Date().toISOString()
});

describe('generateSingleEliminationBracketMatches', () => {
	it('returns empty array for no pairs', () => {
		const result = generateSingleEliminationBracketMatches({
			tournamentId: 't-1',
			pairs: [],
			seedingMode: 'random'
		});

		expect(result).toEqual([]);
	});

	it('generates bracket for 2 pairs', () => {
		const pairs = [createPair('pair-1'), createPair('pair-2')];
		const result = generateSingleEliminationBracketMatches({
			tournamentId: 't-1',
			pairs,
			seedingMode: 'random'
		});

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			round: 1,
			position: 1,
			participant_a_type: 'pair',
			participant_a_pair_id: expect.any(String),
			participant_b_type: 'pair',
			participant_b_pair_id: expect.any(String),
			status: 'pending',
			score_a: null,
			score_b: null,
			winner_side: null
		});
	});

	it('generates bracket for 4 pairs', () => {
		const pairs = [
			createPair('pair-1'),
			createPair('pair-2'),
			createPair('pair-3'),
			createPair('pair-4')
		];
		const result = generateSingleEliminationBracketMatches({
			tournamentId: 't-1',
			pairs,
			seedingMode: 'random'
		});

		expect(result).toHaveLength(3); // 2 first round + 1 final
		expect(result[0]).toMatchObject({ round: 1, position: 1 });
		expect(result[1]).toMatchObject({ round: 1, position: 2 });
		expect(result[2]).toMatchObject({ round: 2, position: 1 });
	});

	it('handles manual seeding', () => {
		const pairs = [
			createPair('pair-1', 1),
			createPair('pair-2', 2),
			createPair('pair-3', 3),
			createPair('pair-4', 4)
		];
		const result = generateSingleEliminationBracketMatches({
			tournamentId: 't-1',
			pairs,
			seedingMode: 'manual'
		});

		expect(result).toHaveLength(3);
		// With manual seeding, pair-1 (seed 1) should be in first position
		expect(result[0]).toMatchObject({
			round: 1,
			position: 1,
			participant_a_pair_id: 'pair-1'
		});
	});

	it('handles random seeding', () => {
		const pairs = [createPair('pair-1'), createPair('pair-2')];
		const result = generateSingleEliminationBracketMatches({
			tournamentId: 't-1',
			pairs,
			seedingMode: 'random'
		});

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			round: 1,
			position: 1,
			participant_a_type: 'pair',
			participant_b_type: 'pair'
		});
	});

	it('handles odd number of pairs with byes', () => {
		const pairs = [createPair('pair-1'), createPair('pair-2'), createPair('pair-3')];
		const result = generateSingleEliminationBracketMatches({
			tournamentId: 't-1',
			pairs,
			seedingMode: 'random'
		});

		expect(result).toHaveLength(3); // 2 first round + 1 final
		// One match should have a bye
		const hasBye = result.some(match => 
			match.participant_a_type === 'bye' || match.participant_b_type === 'bye'
		);
		expect(hasBye).toBe(true);
	});
});

describe('generateAndStoreSingleEliminationBracket', () => {
	it('delegates to setMatches with generated bracket', () => {
		const setMatches = vi.fn();

		generateAndStoreSingleEliminationBracket({
			tournamentId: 't-1',
			seedingMode: 'manual',
			pairs: [createPair('pair-1', 1), createPair('pair-2', 2)],
			setMatches
		});

		expect(setMatches).toHaveBeenCalledTimes(1);
		expect(setMatches.mock.calls[0][0]).toBe('t-1');
		const payload = setMatches.mock.calls[0][1];
		expect(Array.isArray(payload)).toBe(true);
		expect(payload).toHaveLength(1);
	});
});
