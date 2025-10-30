export interface EventData {
	id?: string;
	name: string;
	slug?: string;
}

export interface EventRecord {
	id: string;
	name: string;
	slug: string | null;
	createdAt: string;
}

const store = new Map<string, EventRecord>();

const normalizeId = (value: string | undefined) => value?.trim() ?? '';

const slugify = (value: string | undefined): string => {
	if (!value) return '';
	const ascii = value
		.normalize('NFKC')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-');
	return ascii.replace(/^-+|-+$/g, '');
};

const ensureUniqueSlug = (slug: string, ignoreId?: string) => {
	if (!slug) return;
	const conflict = Array.from(store.values()).find((event) => event.slug === slug && event.id !== ignoreId);
	if (conflict) {
		throw new Error('Event slug already exists');
	}
};

export const listEvents = (): EventRecord[] => {
	return Array.from(store.values()).sort((a, b) => {
		if (a.createdAt === b.createdAt) {
			return b.id.localeCompare(a.id);
		}
		return a.createdAt > b.createdAt ? -1 : 1;
	});
};

import { generateUUID } from '~/utils/uuid';

export const createEvent = (data: EventData): EventRecord => {
	const name = data.name?.trim();
	if (!name) {
		throw new Error('Event name is required');
	}

	const desiredSlug = slugify(data.slug ?? name);
	const id = normalizeId(data.id) || generateUUID();

	if (store.has(id)) {
		throw new Error('Event ID already exists');
	}

	ensureUniqueSlug(desiredSlug);

	const record: EventRecord = {
		id,
		name,
		slug: desiredSlug || null,
		createdAt: new Date().toISOString()
	};

	store.set(id, record);
	return record;
};

export const ensureEvent = (eventId: string): EventRecord => {
	const id = normalizeId(eventId);
	if (!id) {
		throw new Error('Event ID is required');
	}

	const record = store.get(id);
	if (!record) {
		throw new Error('Event not found');
	}

	return record;
};

export const updateEvent = (eventId: string, data: EventData): EventRecord => {
	const existing = ensureEvent(eventId);
	const name = data.name?.trim();
	if (!name) {
		throw new Error('Event name is required');
	}

	const desiredSlug = slugify(data.slug ?? existing.slug ?? name);
	ensureUniqueSlug(desiredSlug, existing.id);

	const updated: EventRecord = {
		...existing,
		name,
		slug: desiredSlug || null
	};

	store.set(existing.id, updated);
	return updated;
};

export const deleteEvent = (eventId: string): void => {
	const id = normalizeId(eventId);
	if (!id) {
		throw new Error('Event ID is required');
	}

	const deleted = store.delete(id);
	if (!deleted) {
		throw new Error('Event not found');
	}
};

export const __resetForTests = () => {
	store.clear();
};
