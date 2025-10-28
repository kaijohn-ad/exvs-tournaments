import { describe, expect, it, vi } from 'vitest';
import {
	generateAndStoreSingleEliminationBracket,
	generateSingleEliminationBracketMatches
} from './bracket-generator';
import type { PairRecord } from './pairs';

const createPair = (id: string, seed?: number): PairRecord => ({
	id,
	player1_id: `${id}-p1`,
	player2_id: `${id}-p2`,
	seed
});

describe('generateSingleEliminationBracketMatches', () => {
	it('arranges manual seeds in standard bracket order', () => {
		const matches = generateSingleEliminationBracketMatches({
			tournamentId: 't-1',
			seedingMode: 'manual',
			pairs: [
				createPair('pair-1', 1),
				createPair('pair-2', 2),
				createPair('pair-3', 3),
				createPair('pair-4', 4)
			]
		});

		expect(matches).toHaveLength(3);
		expect(matches[0]).toMatchObject({
			round: 1,
			position: 1,
			participant_a_pair_id: 'pair-1',
			participant_b_pair_id: 'pair-4',
			status: 'pending',
			winner_side: null
		});
		expect(matches[1]).toMatchObject({
			round: 1,
			position: 2,
			participant_a_pair_id: 'pair-2',
			participant_b_pair_id: 'pair-3'
		});
		expect(matches[2]).toMatchObject({
			round: 2,
			position: 1,
			participant_a_type: 'pair',
			participant_a_pair_id: null,
			participant_b_type: 'pair',
			participant_b_pair_id: null,
			status: 'pending',
			winner_side: null
		});
	});

	it('assigns byes to top seeds in manual seeding and auto-advances winners', () => {
		const matches = generateSingleEliminationBracketMatches({
			tournamentId: 't-1',
			seedingMode: 'manual',
			pairs: [createPair('pair-1', 1), createPair('pair-2', 2), createPair('pair-3', 3)]
		});

		expect(matches).toHaveLength(3);
		expect(matches[0]).toMatchObject({
			round: 1,
			position: 1,
			participant_a_pair_id: 'pair-1',
			participant_b_type: 'bye',
			status: 'completed',
			winner_side: 'a'
		});
		expect(matches[1]).toMatchObject({
			round: 1,
			position: 2,
			participant_a_pair_id: 'pair-2',
			participant_b_pair_id: 'pair-3',
			status: 'pending',
			winner_side: null
		});
		expect(matches[2]).toMatchObject({
			round: 2,
			position: 1,
			participant_a_type: 'pair',
			participant_a_pair_id: 'pair-1',
			participant_b_type: 'pair',
			participant_b_pair_id: null,
			status: 'pending',
			winner_side: null
		});
	});

	it('uses provided RNG for random seeding', () => {
		const rngValues = [0.6, 0.2, 0.8];
		let rngIndex = 0;
		const rng = () => {
			const value = rngValues[rngIndex] ?? rngValues[rngValues.length - 1];
			rngIndex += 1;
			return value;
		};

		const matches = generateSingleEliminationBracketMatches({
			tournamentId: 't-1',
			seedingMode: 'random',
			pairs: [
				createPair('pair-1'),
				createPair('pair-2'),
				createPair('pair-3'),
				createPair('pair-4')
			],
			rng
		});

		expect(matches).toHaveLength(3);
		expect(matches[0]).toMatchObject({
			participant_a_pair_id: 'pair-4',
			participant_b_pair_id: 'pair-3'
		});
		expect(matches[1]).toMatchObject({
			participant_a_pair_id: 'pair-2',
			participant_b_pair_id: 'pair-1'
		});
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
