import { beforeEach, describe, expect, it } from 'vitest';
import { resetForTests } from '$lib/server/db';
import {
	createPlayer,
	listPlayers,
	type PlayerRecord
} from '$lib/server/repositories/players';
import { actions, load } from '../+page.server';

const EVENT_ID = 'event-1';

const createRequestEvent = <T extends keyof typeof actions>(
	action: T,
	formEntries: Record<string, string>
) => {
	const formData = new FormData();

	for (const [key, value] of Object.entries(formEntries)) {
		formData.append(key, value);
	}

	const request = new Request('http://localhost/admin', {
		method: 'POST',
		body: formData
	});

	return {
		params: { eventId: EVENT_ID },
		locals: {},
		url: new URL('http://localhost/admin/events/event-1/entries/players'),
		request,
		fetch,
		platform: undefined,
		cookies: {
			get: () => undefined,
			set: () => undefined,
			delete: () => undefined,
			serialize: () => ''
		},
		setHeaders: () => undefined,
		depends: () => undefined,
		route: { id: 'admin/events/[eventId]/entries/players' }
	} as unknown as Parameters<(typeof actions)[T]>[0];
};

describe('admin players page actions', () => {
	beforeEach(() => {
		resetForTests();
	});

	it('load returns players sorted by name', async () => {
		createPlayer(EVENT_ID, { name: 'Bob' });
		createPlayer(EVENT_ID, { name: 'Alice' });

		const result = (await load({
			params: { eventId: EVENT_ID },
			locals: {},
			url: new URL('http://localhost/admin/events/event-1/entries/players'),
			fetch,
			platform: undefined,
			depends: () => undefined,
			cookies: {
				get: () => undefined,
				set: () => undefined,
				delete: () => undefined,
				serialize: () => ''
			},
			parent: async () => ({})
		} as any)) as { players: PlayerRecord[] };

		expect(result.players.map((player: PlayerRecord) => player.name)).toEqual(['Alice', 'Bob']);
	});

	it('create action stores a player', async () => {
		await actions.create!(createRequestEvent('create', { name: 'Alice', note: 'Ace' }));

		expect(listPlayers(EVENT_ID)).toHaveLength(1);
		expect(listPlayers(EVENT_ID)[0]).toMatchObject({ name: 'Alice', note: 'Ace' });
	});

	it('update action modifies a player', async () => {
		const { id } = createPlayer(EVENT_ID, { name: 'Alice', note: 'Ace' });

		await actions.update!(
			createRequestEvent('update', { playerId: id, name: 'Alice Prime', note: 'Captain' })
		);

		expect(listPlayers(EVENT_ID)[0]).toMatchObject({ name: 'Alice Prime', note: 'Captain' });
	});

	it('delete action removes a player', async () => {
		const { id } = createPlayer(EVENT_ID, { name: 'Alice' });

		await actions.delete!(createRequestEvent('delete', { playerId: id }));

		expect(listPlayers(EVENT_ID)).toHaveLength(0);
	});

	it('import action replaces players from JSON', async () => {
		createPlayer(EVENT_ID, { name: 'Legacy' });

		await actions.import!(
			createRequestEvent('import', {
				payload: JSON.stringify([
					{ id: 'p1', name: 'Alice', note: 'Ace' },
					{ name: 'Bob' }
				])
			})
		);

		expect(listPlayers(EVENT_ID).map((player: PlayerRecord) => player.name)).toEqual([
			'Alice',
			'Bob'
		]);

		const response = await actions.import!(
			createRequestEvent('import', { payload: 'not json' })
		);

		const status = (response as { status?: number } | undefined)?.status;
		expect(status).toBe(400);
	});
});
