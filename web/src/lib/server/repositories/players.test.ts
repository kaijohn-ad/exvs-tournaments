import { beforeEach, describe, expect, it } from 'vitest';
import {
	createPlayer,
	deletePlayer,
	listPlayers,
	setPlayers,
	updatePlayer,
	__resetForTests
} from './players';

describe('player repository', () => {
	beforeEach(() => {
		__resetForTests();
	});

	it('creates and lists players per event', () => {
		const { id } = createPlayer('event-1', { name: 'Alice', note: 'Ace' });
		expect(listPlayers('event-1')).toEqual([
			{ id, name: 'Alice', note: 'Ace' }
		]);

		createPlayer('event-2', { name: 'Bob' });

		expect(listPlayers('event-1')).toHaveLength(1);
		expect(listPlayers('event-2')).toHaveLength(1);
	});

	it('updates a player', () => {
		const { id } = createPlayer('event-1', { name: 'Alice', note: 'Ace' });

		updatePlayer('event-1', id, { name: 'Alice Prime', note: 'Captain' });

		expect(listPlayers('event-1')).toEqual([
			{ id, name: 'Alice Prime', note: 'Captain' }
		]);
	});

	it('deletes a player', () => {
		const { id } = createPlayer('event-1', { name: 'Alice' });

		deletePlayer('event-1', id);

		expect(listPlayers('event-1')).toEqual([]);
	});

	it('replaces players via setPlayers', () => {
		createPlayer('event-1', { name: 'Legacy' });

		const imported = setPlayers('event-1', [
			{ id: 'p-1', name: 'Alice', note: 'Ace' },
			{ name: 'Bob' }
		]);

		expect(imported).toHaveLength(2);
		expect(listPlayers('event-1').map((p) => p.name)).toEqual(['Alice', 'Bob']);
		// invalid entries are skipped
		setPlayers('event-1', [{ name: '  ' }, { name: 'Charlie' }]);
		expect(listPlayers('event-1').map((p) => p.name)).toEqual(['Charlie']);
	});

	it('throws when updating or deleting unknown player', () => {
		expect(() => updatePlayer('event-1', 'missing', { name: 'New' })).toThrowError(
			/Player not found/
		);
		expect(() => deletePlayer('event-1', 'missing')).toThrowError(/Player not found/);
	});
});
