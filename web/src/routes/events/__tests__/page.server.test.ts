import { beforeEach, describe, expect, it } from 'vitest';
import { resetForTests } from '$lib/server/db';
import { createEvent } from '$lib/server/repositories/events';
import { createTournament } from '$lib/server/repositories/tournaments';
import { load } from '../+page.server';

const createRequestEvent = () =>
	({
		params: {},
		locals: {},
		url: new URL('http://localhost/events'),
		fetch,
		platform: undefined,
		depends: () => undefined,
		parent: async () => ({})
	}) as Parameters<typeof load>[0];

describe('public events page load', () => {
	beforeEach(() => {
		resetForTests();
	});

	it('returns empty list when no events registered', async () => {
		const result = await load(createRequestEvent());

		expect(result.events).toEqual([]);
	});

	it('returns events with tournament summaries', async () => {
		const event = createEvent({ id: 'event-public', name: 'Public Event', slug: 'public-event' });
		createTournament(event.id, { name: '予選トーナメント' });
		createTournament(event.id, { name: '決勝トーナメント' });

		const result = await load(createRequestEvent());

		expect(result.events).toHaveLength(1);
		const [summary] = result.events;
		expect(summary.id).toBe('event-public');
		expect(summary.slug).toBe('public-event');
		expect(summary.tournaments.map((tournament) => tournament.name)).toEqual([
			'予選トーナメント',
			'決勝トーナメント'
		]);
	});
});
