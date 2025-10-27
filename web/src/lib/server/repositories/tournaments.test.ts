import { beforeEach, describe, expect, it } from 'vitest';
import {
	createTournament,
	deleteTournament,
	listTournaments,
	setTournaments,
	updateTournament,
	__resetForTests
} from './tournaments';

describe('tournament repository', () => {
	beforeEach(() => {
		__resetForTests();
	});

	it('creates and lists tournaments per event', () => {
		const { id } = createTournament('event-1', { name: 'Spring Tournament' });
		const tournaments = listTournaments('event-1');
		
		expect(tournaments).toHaveLength(1);
		expect(tournaments[0]).toMatchObject({
			id,
			eventId: 'event-1',
			name: 'Spring Tournament',
			format: 'single-elimination',
			seedingMode: 'random'
		});
		expect(tournaments[0].createdAt).toBeDefined();

		createTournament('event-2', { name: 'Summer Tournament' });

		expect(listTournaments('event-1')).toHaveLength(1);
		expect(listTournaments('event-2')).toHaveLength(1);
	});

	it('creates tournament with custom format and seeding', () => {
		const { id } = createTournament('event-1', {
			name: 'Custom Tournament',
			format: 'single-elimination',
			seedingMode: 'manual'
		});

		const tournaments = listTournaments('event-1');
		expect(tournaments[0]).toMatchObject({
			id,
			name: 'Custom Tournament',
			format: 'single-elimination',
			seedingMode: 'manual'
		});
	});

	it('updates a tournament', () => {
		const { id } = createTournament('event-1', { name: 'Spring Tournament' });

		updateTournament('event-1', id, {
			name: 'Spring Championship',
			seedingMode: 'manual'
		});

		const tournaments = listTournaments('event-1');
		expect(tournaments[0]).toMatchObject({
			id,
			name: 'Spring Championship',
			seedingMode: 'manual'
		});
	});

	it('deletes a tournament', () => {
		const { id } = createTournament('event-1', { name: 'Spring Tournament' });

		deleteTournament('event-1', id);

		expect(listTournaments('event-1')).toEqual([]);
	});

	it('replaces tournaments via setTournaments', () => {
		createTournament('event-1', { name: 'Legacy Tournament' });

		const imported = setTournaments('event-1', [
			{ id: 't-1', name: 'Tournament A', format: 'single-elimination' },
			{ name: 'Tournament B', seedingMode: 'manual' }
		]);

		expect(imported).toHaveLength(2);
		expect(listTournaments('event-1').map((t) => t.name)).toEqual(['Tournament A', 'Tournament B']);
		
		setTournaments('event-1', [{ name: '  ' }, { name: 'Tournament C' }]);
		expect(listTournaments('event-1').map((t) => t.name)).toEqual(['Tournament C']);
	});

	it('throws when updating or deleting unknown tournament', () => {
		expect(() => updateTournament('event-1', 'missing', { name: 'New' })).toThrowError(
			/Tournament not found/
		);
		expect(() => deleteTournament('event-1', 'missing')).toThrowError(/Tournament not found/);
	});
});
