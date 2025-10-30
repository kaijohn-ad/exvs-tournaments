import { describe, expect, it, vi } from 'vitest';
import { pairSoloParticipants, type SoloPairingContext } from '../solo-pairing';
import type { PairRecord } from '../pairs';
import type { TournamentParticipantRecord } from '../tournament-participants';

const createParticipant = (
	id: string,
	playerId: string
): TournamentParticipantRecord => ({
	id,
	tournament_id: 'tournament-1',
	participant_type: 'solo',
	pair_id: null,
	player_id: playerId,
	seed: null,
	note: null,
	status: 'active',
	created_at: new Date().toISOString()
});

const createPair = (
	id: string,
	player1_id: string,
	player2_id: string,
	seed?: number | null
): PairRecord => ({
	id,
	event_id: 'event-1',
	player1_id,
	player2_id,
	seed: seed ?? null,
	created_at: new Date().toISOString()
});

describe('pairSoloParticipants', () => {
	const eventId = 'event-1';
	const tournamentId = 'tournament-1';

	const createMockContext = (
		participants: TournamentParticipantRecord[],
		existingPairs: PairRecord[] = []
	): SoloPairingContext => {
		return {
			listParticipants: vi.fn().mockResolvedValue(participants),
			listPairs: vi.fn().mockResolvedValue(existingPairs),
			createPair: vi.fn().mockImplementation(async (eid, data) => {
				return createPair(`pair-new-${Date.now()}`, data.player1_id, data.player2_id);
			})
		};
	};

	it('throws error when participants less than 2', async () => {
		const participants = [createParticipant('p1', 'player-1')];
		const context = createMockContext(participants);

		await expect(
			pairSoloParticipants(eventId, tournamentId, context)
		).rejects.toThrow('少なくとも2名の個別参加者が参加登録されている必要があります');
	});

	it('throws error when participants count is odd', async () => {
		const participants = [
			createParticipant('p1', 'player-1'),
			createParticipant('p2', 'player-2'),
			createParticipant('p3', 'player-3')
		];
		const context = createMockContext(participants);

		await expect(
			pairSoloParticipants(eventId, tournamentId, context)
		).rejects.toThrow('個別参加者の人数が奇数です');
	});

	it('pairs 2 solo participants without existing pairs', async () => {
		const participants = [
			createParticipant('p1', 'player-1'),
			createParticipant('p2', 'player-2')
		];
		const context = createMockContext(participants);

		const result = await pairSoloParticipants(eventId, tournamentId, context);

		expect(result).toHaveLength(1);
		expect(context.createPair).toHaveBeenCalledTimes(1);
		expect(context.createPair).toHaveBeenCalledWith(eventId, {
			player1_id: expect.any(String),
			player2_id: expect.any(String)
		});
	});

	it('reuses existing pairs when both players are solo participants', async () => {
		const participants = [
			createParticipant('p1', 'player-1'),
			createParticipant('p2', 'player-2'),
			createParticipant('p3', 'player-3'),
			createParticipant('p4', 'player-4')
		];
		const existingPair = createPair('pair-existing', 'player-1', 'player-2');
		const context = createMockContext(participants, [existingPair]);

		const result = await pairSoloParticipants(eventId, tournamentId, context);

		expect(result).toHaveLength(2);
		expect(result.some(p => p.id === 'pair-existing')).toBe(true);
		expect(context.createPair).toHaveBeenCalledTimes(1); // Only one new pair created
	});

	it('does not reuse pairs if not both players are solo participants', async () => {
		const participants = [
			createParticipant('p1', 'player-1'),
			createParticipant('p2', 'player-2')
		];
		// Existing pair with one solo participant and gray one
		const existingPair = createPair('pair-existing', 'player-1', 'player-other');
		const context = createMockContext(participants, [existingPair]);

		const result = await pairSoloParticipants(eventId, tournamentId, context);

		expect(result).toHaveLength(1);
		expect(result[0].id).not.toBe('pair-existing');
		expect(context.createPair).toHaveBeenCalledTimes(1);
	});

	it('handles 4 solo participants with mixed existing pairs', async () => {
		const participants = [
			createParticipant('p1', 'player-1'),
			createParticipant('p2', 'player-2'),
			createParticipant('p3', 'player-3'),
			createParticipant('p4', 'player-4')
		];
		// One existing pair matches
		const existingPair1 = createPair('pair-1', 'player-1', 'player-2');
		// One existing pair doesn't match (player-5 is not a solo participant)
		const existingPair2 = createPair('pair-2', 'player-3', 'player-5');
		const context = createMockContext(participants, [existingPair1, existingPair2]);

		const result = await pairSoloParticipants(eventId, tournamentId, context);

		expect(result).toHaveLength(2);
		expect(result.some(p => p.id === 'pair-1')).toBe(true);
		expect(result.some(p => p.id === 'pair-2')).toBe(false);
		expect(context.createPair).toHaveBeenCalledTimes(1); // player-3 and player-4 paired
	});

	it('normalizes pair player IDs (smaller first)', async () => {
		const participants = [
			createParticipant('p1', 'player-z'),
			createParticipant('p2', 'player-a')
		];
		const context = createMockContext(participants);

		await pairSoloParticipants(eventId, tournamentId, context);

		expect(context.createPair).toHaveBeenCalledWith(eventId, {
			player1_id: 'player-a',
			player2_id: 'player-z'
		});
	});

	it('reuses existing pair even if player order differs', async () => {
		const participants = [
			createParticipant('p1', 'player-1'),
			createParticipant('p2', 'player-2')
		];
		// Existing pair has reverse order
		const existingPair = createPair('pair-existing', 'player-2', 'player-1');
		const context = createMockContext(participants, [existingPair]);

		const result = await pairSoloParticipants(eventId, tournamentId, context);

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('pair-existing');
		expect(context.createPair).not.toHaveBeenCalled();
	});

	it('uses custom RNG for shuffling', async () => {
		const participants = [
			createParticipant('p1', 'player-1'),
			createParticipant('p2', 'player-2'),
			createParticipant('p3', 'player-3'),
			createParticipant('p4', 'player-4')
		];
		const context = createMockContext(participants);
		
		// Fixed RNG that returns 0.5 (middle value)
		const fixedRng = vi.fn().mockReturnValue(0.5);

		await pairSoloParticipants(eventId, tournamentId, context, fixedRng);

		expect(fixedRng).toHaveBeenCalled();
		expect(context.createPair).toHaveBeenCalledTimes(2);
	});
});

