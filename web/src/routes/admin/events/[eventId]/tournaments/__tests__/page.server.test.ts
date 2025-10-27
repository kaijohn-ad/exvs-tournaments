import { beforeEach, describe, expect, it } from 'vitest';
import { resetForTests } from '$lib/server/db';
import {
	createTournament,
	listTournaments,
	type TournamentRecord
} from '$lib/server/repositories/tournaments';
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
		url: new URL('http://localhost/admin/events/event-1/tournaments'),
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
		route: { id: 'admin/events/[eventId]/tournaments' }
	} as unknown as Parameters<(typeof actions)[T]>[0];
};

describe('admin tournaments page actions', () => {
	beforeEach(() => {
		resetForTests();
	});

	it('load returns tournaments sorted by name', async () => {
		createTournament(EVENT_ID, { name: 'Summer Tournament' });
		createTournament(EVENT_ID, { name: 'Spring Tournament' });

		const result = (await load({
			params: { eventId: EVENT_ID },
			locals: {},
			url: new URL('http://localhost/admin/events/event-1/tournaments'),
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
		} as any)) as { tournaments: TournamentRecord[] };

		expect(result.tournaments.map((t: TournamentRecord) => t.name)).toEqual(['Spring Tournament', 'Summer Tournament']);
	});

	it('create action stores a tournament', async () => {
		await actions.create!(createRequestEvent('create', { 
			name: 'Spring Tournament',
			format: 'single-elimination',
			seedingMode: 'random'
		}));

		expect(listTournaments(EVENT_ID)).toHaveLength(1);
		expect(listTournaments(EVENT_ID)[0]).toMatchObject({ 
			name: 'Spring Tournament',
			format: 'single-elimination',
			seedingMode: 'random'
		});
	});

	it('create action uses defaults for format and seedingMode', async () => {
		await actions.create!(createRequestEvent('create', { name: 'Test Tournament' }));

		expect(listTournaments(EVENT_ID)[0]).toMatchObject({
			name: 'Test Tournament',
			format: 'single-elimination',
			seedingMode: 'random'
		});
	});

	it('update action modifies a tournament', async () => {
		const { id } = createTournament(EVENT_ID, { name: 'Spring Tournament' });

		await actions.update!(
			createRequestEvent('update', { 
				tournamentId: id, 
				name: 'Spring Championship',
				seedingMode: 'manual'
			})
		);

		expect(listTournaments(EVENT_ID)[0]).toMatchObject({ 
			name: 'Spring Championship',
			seedingMode: 'manual'
		});
	});

	it('delete action removes a tournament', async () => {
		const { id } = createTournament(EVENT_ID, { name: 'Spring Tournament' });

		await actions.delete!(createRequestEvent('delete', { tournamentId: id }));

		expect(listTournaments(EVENT_ID)).toHaveLength(0);
	});

	it('import action replaces tournaments from JSON', async () => {
		createTournament(EVENT_ID, { name: 'Legacy Tournament' });

		await actions.import!(
			createRequestEvent('import', {
				payload: JSON.stringify([
					{ id: 't1', name: 'Tournament A', format: 'single-elimination', seedingMode: 'random' },
					{ name: 'Tournament B', seedingMode: 'manual' }
				])
			})
		);

		expect(listTournaments(EVENT_ID).map((t: TournamentRecord) => t.name)).toEqual([
			'Tournament A',
			'Tournament B'
		]);

		const response = await actions.import!(
			createRequestEvent('import', { payload: 'not json' })
		);

		const status = (response as { status?: number } | undefined)?.status;
		expect(status).toBe(400);
	});

	it('create action fails without name', async () => {
		const response = await actions.create!(createRequestEvent('create', { name: '' }));
		const status = (response as { status?: number } | undefined)?.status;
		expect(status).toBe(400);
	});

	it('create action trims whitespace-only names', async () => {
		const response = await actions.create!(createRequestEvent('create', { name: '   ' }));
		const status = (response as { status?: number } | undefined)?.status;
		expect(status).toBe(400);
		expect(listTournaments(EVENT_ID)).toHaveLength(0);
	});

	it('update action fails without tournamentId', async () => {
		const response = await actions.update!(createRequestEvent('update', { name: 'Test' }));
		const status = (response as { status?: number } | undefined)?.status;
		expect(status).toBe(400);
	});

	it('delete action fails without tournamentId', async () => {
		const response = await actions.delete!(createRequestEvent('delete', {}));
		const status = (response as { status?: number } | undefined)?.status;
		expect(status).toBe(400);
	});

	it('import action skips invalid entries', async () => {
		const response = await actions.import!(
			createRequestEvent('import', {
				payload: JSON.stringify([
					{ name: 'Valid Tournament', seedingMode: 'manual' },
					{ name: '   ' },
					{ id: 'invalid', format: 'single-elimination' },
					'not-an-object'
				])
			})
		);

		expect((response as { success?: boolean } | undefined)?.success).toBe(true);
		expect(listTournaments(EVENT_ID)).toHaveLength(1);
		expect(listTournaments(EVENT_ID)[0]).toMatchObject({
			name: 'Valid Tournament',
			seedingMode: 'manual'
		});
	});
});
