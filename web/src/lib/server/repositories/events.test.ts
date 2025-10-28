import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
	createEvent,
	deleteEvent,
	ensureEvent,
	listEvents,
	updateEvent,
	__resetForTests
} from './events';

describe('events repository (memory)', () => {
	beforeEach(() => {
		__resetForTests();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('createEvent', () => {
		it('creates event with generated id and slug', () => {
			const event = createEvent({ name: ' 秋大会2024 ' });

			expect(event.id).toBeTruthy();
			expect(event.slug).toBe('2024');
			expect(event.name).toBe('秋大会2024');
		});

		it('fails when name missing', () => {
			expect(() => createEvent({ name: '  ' })).toThrow('Event name is required');
		});

		it('supports custom id and slug', () => {
			const event = createEvent({ id: 'event-custom', name: 'Custom Event', slug: 'custom-event' });

			expect(event.id).toBe('event-custom');
			expect(event.slug).toBe('custom-event');
		});

		it('rejects duplicate id or slug', () => {
			createEvent({ id: 'event-1', name: 'Event 1', slug: 'event-1' });

			expect(() => createEvent({ id: 'event-1', name: 'Event 2' })).toThrow('Event ID already exists');
			expect(() => createEvent({ name: 'Event 3', slug: 'event-1' })).toThrow('Event slug already exists');
		});
	});

	describe('listEvents', () => {
		it('returns events sorted by createdAt desc', () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
			const first = createEvent({ id: 'a', name: 'A Event' });
			vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
			const second = createEvent({ id: 'b', name: 'B Event' });

			const events = listEvents();
			expect(events[0].id).toBe(second.id);
			expect(events[1].id).toBe(first.id);
			expect(events[0].createdAt > events[1].createdAt).toBe(true);
		});
	});

	describe('ensureEvent', () => {
		it('returns event when exists', () => {
			const created = createEvent({ id: 'event-ensure', name: 'Ensure' });
			const ensured = ensureEvent('event-ensure');

			expect(ensured).toEqual(created);
		});

		it('throws when not found', () => {
			expect(() => ensureEvent('nope')).toThrow('Event not found');
		});
	});

	describe('updateEvent', () => {
		it('updates name and slug', () => {
			const created = createEvent({ id: 'event-update', name: 'Old Name' });
			const updated = updateEvent(created.id, { name: 'New Name', slug: 'new-name' });

			expect(updated.name).toBe('New Name');
			expect(updated.slug).toBe('new-name');
		});

		it('prevents slug collisions', () => {
			createEvent({ id: 'event-a', name: 'Event A', slug: 'event-a' });
			const target = createEvent({ id: 'event-b', name: 'Event B' });

			expect(() => updateEvent(target.id, { name: 'Event B', slug: 'event-a' })).toThrow(
				'Event slug already exists'
			);
		});
	});

	describe('deleteEvent', () => {
		it('removes event', () => {
			createEvent({ id: 'event-delete', name: 'Delete Me' });
			deleteEvent('event-delete');

			expect(() => ensureEvent('event-delete')).toThrow('Event not found');
		});

		it('throws when missing', () => {
			expect(() => deleteEvent('missing')).toThrow('Event not found');
		});
	});
});
