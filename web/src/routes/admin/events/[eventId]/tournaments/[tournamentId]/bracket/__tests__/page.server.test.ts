
import { beforeEach, describe, expect, it } from 'vitest';
import { resetForTests } from '$lib/server/db';
import { createPlayer } from '$lib/server/repositories/players';
import { createPair } from '$lib/server/repositories/pairs';
import { createTournament } from '$lib/server/repositories/tournaments';
import { setBracketMatches } from '$lib/server/repositories/bracket-matches';
import { actions, load } from '../+page.server';

const EVENT_ID = 'event-1';

const createLoadEvent = (tournamentId: string) => {
	return {
		params: { eventId: EVENT_ID, tournamentId },
		locals: {},
		url: new URL(`http://localhost/admin/events/${EVENT_ID}/tournaments/${tournamentId}/bracket`),
		fetch,
		platform: undefined,
		depends: () => undefined,
		parent: async () => ({}),
		cookies: {
			get: () => undefined,
			set: () => undefined,
			delete: () => undefined,
			serialize: () => ''
		}
	} as unknown as Parameters<typeof load>[0];
};

const createActionEvent = (params: { eventId: string; tournamentId: string }, formData?: FormData) => {
	return {
		params,
		request: {
			formData: async () => formData ?? new FormData()
		},
		locals: {},
		url: new URL(`http://localhost/admin/events/${params.eventId}/tournaments/${params.tournamentId}/bracket`),
		platform: undefined,
		depends: () => {},
		fetch,
		parent: async () => ({}),
	cookies: {
			get: () => undefined,
			set: () => undefined,
			delete: () => undefined,
			serialize: () => ''
		}
	} as any;
};

describe('admin tournaments bracket page load', () => {
	beforeEach(() => {
		resetForTests();
	});

	it('returns tournament with bracket data', async () => {
		const tournament = createTournament(EVENT_ID, { name: 'Autumn Cup' });
		const playerA1 = createPlayer(EVENT_ID, { name: 'Alice' });
		const playerA2 = createPlayer(EVENT_ID, { name: 'Bob' });
		const playerB1 = createPlayer(EVENT_ID, { name: 'Carol' });
		const playerB2 = createPlayer(EVENT_ID, { name: 'Dave' });

		const pairA = createPair(EVENT_ID, { player1_id: playerA1.id, player2_id: playerA2.id });
		const pairB = createPair(EVENT_ID, { player1_id: playerB1.id, player2_id: playerB2.id });

		setBracketMatches(tournament.id, [
			{
				round: 1,
				position: 1,
				participant_a_type: 'pair',
				participant_a_pair_id: pairA.id,
				participant_b_type: 'pair',
				participant_b_pair_id: pairB.id,
				status: 'pending'
			}
		]);

		const result = await load(createLoadEvent(tournament.id));
		if (!result) {
			throw new Error('Expected load result');
		}

		expect(result.tournament.id).toBe(tournament.id);
		expect(result.pairs).toHaveLength(2);
		expect(result.players).toHaveLength(4);
		expect(result.bracketMatches).toHaveLength(1);
		expect(result.bracketMatches[0]).toMatchObject({
			round: 1,
			position: 1,
			participant_a_pair_id: pairA.id,
			participant_b_pair_id: pairB.id
		});
	});

	it('throws 404 when tournament is missing', async () => {
		await expect(load(createLoadEvent('missing-tournament'))).rejects.toMatchObject({ status: 404 });
	});
});

describe('admin tournaments bracket actions', () => {
	beforeEach(() => {
		resetForTests();
	});

	it('records a match result, advances winner, writes match log, and updates player stats', async () => {
		const baseEvent = createActionEvent({ eventId: EVENT_ID, tournamentId: 'pending' });
		const db = (await import('$lib/server/db')).getDatabase(baseEvent);

		const tournament = await db.tournaments.createTournament(EVENT_ID, { name: 'Winter Cup' });
		baseEvent.params.tournamentId = tournament.id;

		const playerA1 = await db.players.createPlayer(EVENT_ID, { name: 'Player A1' });
		const playerA2 = await db.players.createPlayer(EVENT_ID, { name: 'Player A2' });
		const playerB1 = await db.players.createPlayer(EVENT_ID, { name: 'Player B1' });
		const playerB2 = await db.players.createPlayer(EVENT_ID, { name: 'Player B2' });
		const playerC1 = await db.players.createPlayer(EVENT_ID, { name: 'Player C1' });
		const playerC2 = await db.players.createPlayer(EVENT_ID, { name: 'Player C2' });
		const playerD1 = await db.players.createPlayer(EVENT_ID, { name: 'Player D1' });
		const playerD2 = await db.players.createPlayer(EVENT_ID, { name: 'Player D2' });

		const pairA = await db.pairs.createPair(EVENT_ID, {
			player1_id: playerA1.id,
			player2_id: playerA2.id
		});
		const pairB = await db.pairs.createPair(EVENT_ID, {
			player1_id: playerB1.id,
			player2_id: playerB2.id
		});
		const pairC = await db.pairs.createPair(EVENT_ID, {
			player1_id: playerC1.id,
			player2_id: playerC2.id
		});
		const pairD = await db.pairs.createPair(EVENT_ID, {
			player1_id: playerD1.id,
			player2_id: playerD2.id
		});

		await db.bracketMatches.setBracketMatches(tournament.id, [
			{
				id: 'match-1',
				round: 1,
				position: 1,
				participant_a_type: 'pair',
				participant_a_pair_id: pairA.id,
				participant_b_type: 'pair',
				participant_b_pair_id: pairB.id,
				status: 'pending'
			},
			{
				id: 'match-2',
				round: 1,
				position: 2,
				participant_a_type: 'pair',
				participant_a_pair_id: pairC.id,
				participant_b_type: 'pair',
				participant_b_pair_id: pairD.id,
				status: 'pending'
			},
			{
				id: 'match-final',
				round: 2,
				position: 1,
				participant_a_type: 'pair',
				participant_a_pair_id: null,
				participant_b_type: 'pair',
				participant_b_pair_id: null,
				status: 'pending'
			}
		]);

		const formData = new FormData();
		formData.set('matchId', 'match-1');
		formData.set('winnerSide', 'a');
		formData.set('scoreA', '3');
		formData.set('scoreB', '1');

		const actionEvent = createActionEvent(
			{ eventId: EVENT_ID, tournamentId: tournament.id },
			formData
		);

		const result = (await actions.record(actionEvent)) as any;
		expect(result?.success).toBe(true);

		const recordedMatch = await db.bracketMatches.ensureBracketMatch(tournament.id, 'match-1');
		expect(recordedMatch.status).toBe('completed');
		expect(recordedMatch.winner_side).toBe('a');
		expect(recordedMatch.score_a).toBe(3);
		expect(recordedMatch.score_b).toBe(1);

		const finalMatch = await db.bracketMatches.ensureBracketMatch(tournament.id, 'match-final');
		expect(finalMatch.participant_a_pair_id).toBe(pairA.id);
		expect(finalMatch.status).toBe('pending');
		expect(finalMatch.winner_side).toBeNull();

		const matchLogs = await db.matches.listMatches('bracket', 'match-1');
		expect(matchLogs).toHaveLength(1);
		expect(matchLogs[0]).toMatchObject({
			context: 'bracket',
			context_id: 'match-1',
			score_a: 3,
			score_b: 1,
			winner_side: 'a'
		});

		const stats = await db.playerStats.listPlayerStats('tournament', tournament.id);
		const statsByPlayer = new Map(stats.map((stat) => [stat.player_id, stat]));

		expect(statsByPlayer.get(playerA1.id)).toMatchObject({ wins: 1, losses: 0 });
		expect(statsByPlayer.get(playerA2.id)).toMatchObject({ wins: 1, losses: 0 });
		expect(statsByPlayer.get(playerB1.id)).toMatchObject({ wins: 0, losses: 1 });
		expect(statsByPlayer.get(playerB2.id)).toMatchObject({ wins: 0, losses: 1 });
	});

	it('fails when match participants are not ready', async () => {
		const baseEvent = createActionEvent({ eventId: EVENT_ID, tournamentId: 'pending' });
		const db = (await import('$lib/server/db')).getDatabase(baseEvent);

		const tournament = await db.tournaments.createTournament(EVENT_ID, { name: 'Spring Cup' });
		baseEvent.params.tournamentId = tournament.id;

		const player1 = await db.players.createPlayer(EVENT_ID, { name: 'Solo A' });
		const player2 = await db.players.createPlayer(EVENT_ID, { name: 'Solo B' });
		const pairA = await db.pairs.createPair(EVENT_ID, {
			player1_id: player1.id,
			player2_id: player2.id
		});

		await db.bracketMatches.setBracketMatches(tournament.id, [
			{
				id: 'match-1',
				round: 1,
				position: 1,
				participant_a_type: 'pair',
				participant_a_pair_id: pairA.id,
				participant_b_type: 'pair',
				participant_b_pair_id: null,
				status: 'pending'
			}
		]);

		const formData = new FormData();
		formData.set('matchId', 'match-1');
		formData.set('winnerSide', 'a');
		formData.set('scoreA', '2');
		formData.set('scoreB', '0');

		const actionEvent = createActionEvent(
			{ eventId: EVENT_ID, tournamentId: tournament.id },
			formData
		);

		const failure = (await actions.record(actionEvent)) as any;
		expect(failure.status).toBe(400);
		expect(failure.data?.error).toContain('両サイドのペアが確定してから結果を入力してください。');

		const matchLogs = await db.matches.listMatches('bracket', 'match-1');
		expect(matchLogs).toHaveLength(0);

		const stats = await db.playerStats.listPlayerStats('tournament', tournament.id);
		expect(stats).toHaveLength(0);
	});
});
