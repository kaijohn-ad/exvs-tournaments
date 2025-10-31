import { describe, expect, it, vi } from 'vitest';
import {
	generateAndStoreFfa2UpBracket,
	generateFfa2UpBracketGroups
} from '../ffa-generator';
import type { TournamentParticipantRecord } from '../tournament-participants';

const createParticipant = (playerId: string, seed?: number | null): TournamentParticipantRecord => ({
	id: `participant-${playerId}`,
	tournament_id: 't-1',
	participant_type: 'solo',
	pair_id: null,
	player_id: playerId,
	seed: seed ?? null,
	note: null,
	status: 'active',
	created_at: new Date().toISOString()
});

describe('generateFfa2UpBracketGroups', () => {
	it('returns empty array for no players', () => {
		const result = generateFfa2UpBracketGroups({
			tournamentId: 't-1',
			players: [],
			seedingMode: 'random'
		});

		expect(result).toEqual([]);
	});

	it('throws error for non-multiple-of-4 players', () => {
		const players = [
			createParticipant('player-1'),
			createParticipant('player-2'),
			createParticipant('player-3')
		];

		expect(() => {
			generateFfa2UpBracketGroups({
				tournamentId: 't-1',
				players,
				seedingMode: 'random'
			});
		}).toThrow('FFA 2-up形式では参加者数が4の倍数である必要があります');
	});

	it('generates groups for 4 players', () => {
		const players = [
			createParticipant('player-1'),
			createParticipant('player-2'),
			createParticipant('player-3'),
			createParticipant('player-4')
		];
		const result = generateFfa2UpBracketGroups({
			tournamentId: 't-1',
			players,
			seedingMode: 'random'
		});

		expect(result).toHaveLength(1); // 1 group in round 1
		expect(result[0]).toMatchObject({
			round: 1,
			position: 1,
			participant_1_type: 'player',
			participant_2_type: 'player',
			participant_3_type: 'player',
			participant_4_type: 'player',
			status: 'pending',
			winner1_player_id: null,
			winner2_player_id: null
		});
		// All 4 players should be assigned
		const participantIds = [
			result[0].participant_1_player_id,
			result[0].participant_2_player_id,
			result[0].participant_3_player_id,
			result[0].participant_4_player_id
		];
		expect(participantIds.every(id => id !== null)).toBe(true);
		expect(new Set(participantIds).size).toBe(4); // All unique
	});

	it('generates groups for 8 players', () => {
		const players = [
			createParticipant('player-1'),
			createParticipant('player-2'),
			createParticipant('player-3'),
			createParticipant('player-4'),
			createParticipant('player-5'),
			createParticipant('player-6'),
			createParticipant('player-7'),
			createParticipant('player-8')
		];
		const result = generateFfa2UpBracketGroups({
			tournamentId: 't-1',
			players,
			seedingMode: 'random'
		});

		expect(result).toHaveLength(3); // 2 groups in round 1 + 1 group in round 2
		const round1Groups = result.filter(g => g.round === 1);
		const round2Groups = result.filter(g => g.round === 2);
		expect(round1Groups).toHaveLength(2);
		expect(round2Groups).toHaveLength(1);

		// Round 2 group should have empty participants initially
		expect(round2Groups[0]).toMatchObject({
			round: 2,
			position: 1,
			participant_1_type: 'empty',
			participant_2_type: 'empty',
			participant_3_type: 'empty',
			participant_4_type: 'empty'
		});
	});

	it('handles manual seeding', () => {
		const players = [
			createParticipant('player-1', 1),
			createParticipant('player-2', 2),
			createParticipant('player-3', 3),
			createParticipant('player-4', 4)
		];
		const result = generateFfa2UpBracketGroups({
			tournamentId: 't-1',
			players,
			seedingMode: 'manual'
		});

		expect(result).toHaveLength(1);
		// With manual seeding, player-1 (seed 1) should be first
		expect(result[0].participant_1_player_id).toBe('player-1');
	});

	it('applies cross-seeding rule for next round', () => {
		const players = [
			createParticipant('player-1'),
			createParticipant('player-2'),
			createParticipant('player-3'),
			createParticipant('player-4'),
			createParticipant('player-5'),
			createParticipant('player-6'),
			createParticipant('player-7'),
			createParticipant('player-8')
		];
		const result = generateFfa2UpBracketGroups({
			tournamentId: 't-1',
			players,
			seedingMode: 'random'
		});

		const round1Group1 = result.find(g => g.round === 1 && g.position === 1);
		const round1Group2 = result.find(g => g.round === 1 && g.position === 2);
		const round2Group1 = result.find(g => g.round === 2 && g.position === 1);

		expect(round1Group1).toBeDefined();
		expect(round1Group2).toBeDefined();
		expect(round2Group1).toBeDefined();

		// Round 2 group structure should be set up for cross-seeding
		// Odd group (position 1): winner1 -> slot1, winner2 -> slot3
		// Even group (position 2): winner1 -> slot2, winner2 -> slot4
		expect(round2Group1).toMatchObject({
			round: 2,
			position: 1,
			participant_1_type: 'empty', // Will be filled by odd group winner1
			participant_2_type: 'empty', // Will be filled by even group winner1
			participant_3_type: 'empty', // Will be filled by odd group winner2
			participant_4_type: 'empty'  // Will be filled by even group winner2
		});
	});

	it('generates correct number of rounds for 16 players', () => {
		const players = Array.from({ length: 16 }, (_, i) => 
			createParticipant(`player-${i + 1}`)
		);
		const result = generateFfa2UpBracketGroups({
			tournamentId: 't-1',
			players,
			seedingMode: 'random'
		});

		// 16 players = 4 groups in round 1, 2 groups in round 2, 1 group in round 3
		expect(result.filter(g => g.round === 1)).toHaveLength(4);
		expect(result.filter(g => g.round === 2)).toHaveLength(2);
		expect(result.filter(g => g.round === 3)).toHaveLength(1);
		expect(result).toHaveLength(7);
	});
});

describe('generateAndStoreFfa2UpBracket', () => {
	it('delegates to setGroups with generated groups', () => {
		const setGroups = vi.fn();

		generateAndStoreFfa2UpBracket({
			tournamentId: 't-1',
			seedingMode: 'random',
			players: [
				createParticipant('player-1'),
				createParticipant('player-2'),
				createParticipant('player-3'),
				createParticipant('player-4')
			],
			setGroups
		});

		expect(setGroups).toHaveBeenCalledTimes(1);
		expect(setGroups.mock.calls[0][0]).toBe('t-1');
		const payload = setGroups.mock.calls[0][1];
		expect(Array.isArray(payload)).toBe(true);
		expect(payload).toHaveLength(1);
	});
});

