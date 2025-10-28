
import { beforeEach, describe, expect, it } from 'vitest';
import { resetForTests } from '$lib/server/db';
import { createPlayer } from '$lib/server/repositories/players';
import { createPair } from '$lib/server/repositories/pairs';
import { createTournament } from '$lib/server/repositories/tournaments';
import { setBracketMatches } from '$lib/server/repositories/bracket-matches';
import { load } from '../+page.server';

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
	} as Parameters<typeof load>[0];
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
