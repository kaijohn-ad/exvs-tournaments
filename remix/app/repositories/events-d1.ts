import type { EventData, EventRecord } from './events';

export const createEventsRepositoryD1 = (db: D1Database) => {
	const normalizeText = (value: string | null | undefined) => value?.trim() ?? '';

	const slugify = (value: string | undefined): string => {
		if (!value) return '';
		const ascii = value
			.normalize('NFKC')
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-');
		return ascii.replace(/^-+|-+$/g, '');
	};

	return {
		async listEvents(): Promise<EventRecord[]> {
			const result = await db
				.prepare('SELECT id, name, slug, created_at FROM events ORDER BY created_at DESC')
				.all<{ id: string; name: string; slug: string | null; created_at: string }>();

			return (
				result.results?.map((row) => ({
					id: row.id,
					name: row.name,
					slug: row.slug ?? undefined,
					createdAt: row.created_at
				})) ?? []
			);
		},

		async ensureEvent(eventId: string): Promise<EventRecord> {
			const id = normalizeText(eventId);
			if (!id) {
				throw new Error('Event ID is required');
			}

			const result = await db
				.prepare('SELECT id, name, slug, created_at FROM events WHERE id = ?')
				.bind(id)
				.first<{ id: string; name: string; slug: string | null; created_at: string }>();

			if (!result) {
				throw new Error('Event not found');
			}

			return {
				id: result.id,
				name: result.name,
				slug: result.slug ?? undefined,
				createdAt: result.created_at
			};
		},

		async createEvent(data: EventData): Promise<EventRecord> {
			const name = normalizeText(data.name);
			if (!name) {
				throw new Error('Event name is required');
			}

			const desiredSlug = slugify(data.slug ?? name);
			const preferredId = normalizeText(data.id) || desiredSlug;
			const id = preferredId || crypto.randomUUID();

			const existing = await db.prepare('SELECT id FROM events WHERE id = ?').bind(id).first();
			if (existing) {
				throw new Error('Event ID already exists');
			}

			if (desiredSlug) {
				const slugConflict = await db
					.prepare('SELECT id FROM events WHERE slug = ?')
					.bind(desiredSlug)
					.first();

				if (slugConflict) {
					throw new Error('Event slug already exists');
				}
			}

			const createdAt = new Date().toISOString();

			await db
				.prepare('INSERT INTO events (id, name, slug, created_at) VALUES (?, ?, ?, ?)')
				.bind(id, name, desiredSlug || null, createdAt)
				.run();

			return {
				id,
				name,
				slug: desiredSlug || undefined,
				createdAt
			};
		},

		async updateEvent(eventId: string, data: EventData): Promise<EventRecord> {
			const existing = await this.ensureEvent(eventId);
			const name = normalizeText(data.name ?? existing.name);
			if (!name) {
				throw new Error('Event name is required');
			}

			const desiredSlug = slugify(data.slug ?? existing.slug ?? name);

			if (desiredSlug) {
				const slugConflict = await db
					.prepare('SELECT id FROM events WHERE slug = ? AND id != ?')
					.bind(desiredSlug, existing.id)
					.first();
				if (slugConflict) {
					throw new Error('Event slug already exists');
				}
			}

			await db
				.prepare('UPDATE events SET name = ?, slug = ? WHERE id = ?')
				.bind(name, desiredSlug || null, existing.id)
				.run();

			return {
				id: existing.id,
				name,
				slug: desiredSlug || undefined,
				createdAt: existing.createdAt
			};
		},

		async deleteEvent(eventId: string): Promise<void> {
			const id = normalizeText(eventId);
			if (!id) {
				throw new Error('Event ID is required');
			}

			const result = await db.prepare('DELETE FROM events WHERE id = ?').bind(id).run();
			if (result.meta.changes === 0) {
				throw new Error('Event not found');
			}
		}
	};
};

export type EventsRepositoryD1 = ReturnType<typeof createEventsRepositoryD1>;
