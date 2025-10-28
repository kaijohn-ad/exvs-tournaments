import { beforeEach, describe, expect, it } from 'vitest';
import { resetForTests } from '$lib/server/db';
import { createEvent, deleteEvent } from '$lib/server/repositories/events';
import { createTournament } from '$lib/server/repositories/tournaments';
import { createPlayer } from '$lib/server/repositories/players';
import { createPair } from '$lib/server/repositories/pairs';
import { setBracketMatches } from '$lib/server/repositories/bracket-matches';
import { load } from '../+page.server';

const EVENT_ID = 'event-public';

const createLoadEvent = (params: { eventId: string; tournamentId: string }) => {
	return {
		params,
		locals: {},
		url: new URL(`http://localhost/events/${params.eventId}/tournaments/${params.tournamentId}/bracket`),
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

describe('public tournaments bracket page load', () => {
	beforeEach(() => {
		resetForTests();
	});

	it('returns public data for a tournament', async () => {
		const event = createEvent({ id: EVENT_ID, name: 'Spring Cup' });
		const tournament = createTournament(event.id, { name: 'Top 8' });

		const playerA1 = createPlayer(event.id, { name: 'Player A1' });
		const playerA2 = createPlayer(event.id, { name: 'Player A2' });
		const playerB1 = createPlayer(event.id, { name: 'Player B1' });
		const playerB2 = createPlayer(event.id, { name: 'Player B2' });

		const pairA = createPair(event.id, { player1_id: playerA1.id, player2_id: playerA2.id });
		const pairB = createPair(event.id, { player1_id: playerB1.id, player2_id: playerB2.id });

		setBracketMatches(tournament.id, [
			{
				id: 'match-public-1',
				round: 1,
				position: 1,
				participant_a_type: 'pair',
				participant_a_pair_id: pairA.id,
				participant_b_type: 'pair',
				participant_b_pair_id: pairB.id,
				status: 'completed',
				score_a: 3,
				score_b: 1,
				winner_side: 'a'
			}
		]);

		const result = await load(createLoadEvent({ eventId: event.id, tournamentId: tournament.id }));
		if (!result) {
			throw new Error('Expected load result');
		}

		expect(result.event.id).toBe(event.id);
		expect(result.tournament.id).toBe(tournament.id);
		expect(result.pairs).toHaveLength(2);
		expect(result.players).toHaveLength(4);
		expect(result.bracketMatches).toHaveLength(1);
		expect(result.loadedAt).toBeTypeOf('string');
		const [match] = result.bracketMatches;
		expect(match).toMatchObject({
			id: 'match-public-1',
			round: 1,
			winner_side: 'a',
			score_a: 3,
			score_b: 1
		});
	});

	it('throws 404 when tournament is missing', async () => {
		createEvent({ id: EVENT_ID, name: 'Missing Tournament Event' });
		await expect(
			load(createLoadEvent({ eventId: EVENT_ID, tournamentId: 'missing-tournament' }))
		).rejects.toMatchObject({ status: 404 });
	});

	it('throws 404 when event is missing', async () => {
		const event = createEvent({ id: EVENT_ID, name: 'Temporal Event' });
		const tournament = createTournament(event.id, { name: 'Temporal Bracket' });
		deleteEvent(EVENT_ID);

		await expect(
			load(createLoadEvent({ eventId: EVENT_ID, tournamentId: tournament.id }))
		).rejects.toMatchObject({ status: 404 });
	});
});
