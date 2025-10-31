import { describe, expect, it, vi } from 'vitest';
import {
	generateAndStoreSingleEliminationBracket,
	generateSingleEliminationBracketMatches,
	generateDoubleEliminationBracketMatches,
	generateAndStoreDoubleEliminationBracket
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

describe('generateDoubleEliminationBracketMatches', () => {
	it('returns empty array for no pairs', () => {
		const result = generateDoubleEliminationBracketMatches({
			tournamentId: 't-1',
			pairs: [],
			seedingMode: 'random',
			grandFinalsFormat: 'single'
		});

		expect(result).toEqual([]);
	});

	it('generates bracket for 2 pairs', () => {
		const pairs = [createPair('pair-1'), createPair('pair-2')];
		const result = generateDoubleEliminationBracketMatches({
			tournamentId: 't-1',
			pairs,
			seedingMode: 'random',
			grandFinalsFormat: 'single'
		});

		// Winners: 1 match, Losers: none (no losers yet), Grand Finals: 1 match
		expect(result.length).toBeGreaterThanOrEqual(2);
		
		const winnersMatches = result.filter(m => m.bracket === 'winners');
		const grandFinalsMatches = result.filter(m => m.bracket === 'grand-finals');
		
		expect(winnersMatches.length).toBeGreaterThanOrEqual(1);
		expect(grandFinalsMatches.length).toBeGreaterThanOrEqual(1);
	});

	it('generates bracket for 4 pairs', () => {
		const pairs = [
			createPair('pair-1'),
			createPair('pair-2'),
			createPair('pair-3'),
			createPair('pair-4')
		];
		const result = generateDoubleEliminationBracketMatches({
			tournamentId: 't-1',
			pairs,
			seedingMode: 'random',
			grandFinalsFormat: 'single'
		});

		// Winners: 2 first round + 1 final = 3 matches
		// Losers: Round 1 (1 match) + Round 2 (1 match) = 2 matches
		// Grand Finals: 1 match
		// Total: 6 matches
		const winnersMatches = result.filter(m => m.bracket === 'winners');
		const losersMatches = result.filter(m => m.bracket === 'losers');
		const grandFinalsMatches = result.filter(m => m.bracket === 'grand-finals');
		
		expect(winnersMatches.length).toBe(3);
		expect(losersMatches.length).toBe(2);
		expect(grandFinalsMatches.length).toBe(1);
		expect(result.length).toBe(6);
		
		// Losers Round 1 should have 1 match
		const losersRound1 = losersMatches.filter(m => m.round === 1);
		expect(losersRound1.length).toBe(1);
		
		// Losers Round 2 should have 1 match (final)
		const losersRound2 = losersMatches.filter(m => m.round === 2);
		expect(losersRound2.length).toBe(1);
	});

	it('generates reset format grand finals when specified', () => {
		const pairs = [createPair('pair-1'), createPair('pair-2')];
		const result = generateDoubleEliminationBracketMatches({
			tournamentId: 't-1',
			pairs,
			seedingMode: 'random',
			grandFinalsFormat: 'reset'
		});

		const grandFinalsMatches = result.filter(m => m.bracket === 'grand-finals');
		// Reset format should have 2 grand finals matches
		expect(grandFinalsMatches.length).toBeGreaterThanOrEqual(2);
	});

	it('handles manual seeding', () => {
		const pairs = [
			createPair('pair-1', 1),
			createPair('pair-2', 2),
			createPair('pair-3', 3),
			createPair('pair-4', 4)
		];
		const result = generateDoubleEliminationBracketMatches({
			tournamentId: 't-1',
			pairs,
			seedingMode: 'manual',
			grandFinalsFormat: 'single'
		});

		expect(result.length).toBeGreaterThanOrEqual(5);
		// With manual seeding, pair-1 (seed 1) should be in first position
		const firstWinnersMatch = result.find(m => m.bracket === 'winners' && m.round === 1 && m.position === 1);
		expect(firstWinnersMatch).toBeDefined();
		if (firstWinnersMatch) {
			expect(firstWinnersMatch.participant_a_pair_id).toBe('pair-1');
		}
	});

	it('includes bracket field in all matches', () => {
		const pairs = [createPair('pair-1'), createPair('pair-2')];
		const result = generateDoubleEliminationBracketMatches({
			tournamentId: 't-1',
			pairs,
			seedingMode: 'random',
			grandFinalsFormat: 'single'
		});

		for (const match of result) {
			expect(['winners', 'losers', 'grand-finals']).toContain(match.bracket);
		}
	});

	it('generates bracket for 8 pairs', () => {
		const pairs = Array.from({ length: 8 }, (_, i) => createPair(`pair-${i + 1}`));
		const result = generateDoubleEliminationBracketMatches({
			tournamentId: 't-1',
			pairs,
			seedingMode: 'random',
			grandFinalsFormat: 'single'
		});

		// Winners: 4 + 2 + 1 = 7 matches
		// Losers: Round 1 (2) + Round 2 (1) + Round 3 (1) = 4 matches (approximately)
		// Grand Finals: 1 match
		expect(result.length).toBeGreaterThanOrEqual(10);
		
		const winnersMatches = result.filter(m => m.bracket === 'winners');
		const losersMatches = result.filter(m => m.bracket === 'losers');
		const grandFinalsMatches = result.filter(m => m.bracket === 'grand-finals');
		
		expect(winnersMatches.length).toBe(7);
		expect(losersMatches.length).toBeGreaterThanOrEqual(3);
		expect(grandFinalsMatches.length).toBe(1);
		
		// Losers should have at most 3 rounds (for 8 pairs, totalRounds = 3)
		const maxLosersRound = Math.max(...losersMatches.map(m => m.round), 0);
		expect(maxLosersRound).toBeLessThanOrEqual(3);
	});
});

describe('generateAndStoreDoubleEliminationBracket', () => {
	it('delegates to setMatches with generated bracket', () => {
		const setMatches = vi.fn();

		generateAndStoreDoubleEliminationBracket({
			tournamentId: 't-1',
			seedingMode: 'manual',
			pairs: [createPair('pair-1', 1), createPair('pair-2', 2)],
			grandFinalsFormat: 'single',
			setMatches
		});

		expect(setMatches).toHaveBeenCalledTimes(1);
		expect(setMatches.mock.calls[0][0]).toBe('t-1');
		const payload = setMatches.mock.calls[0][1];
		expect(Array.isArray(payload)).toBe(true);
		expect(payload.length).toBeGreaterThanOrEqual(2);
	});
});
