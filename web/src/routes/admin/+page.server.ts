import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDatabase } from '$lib/server/db';

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) return undefined;
	const text = String(value).trim();
	return text.length > 0 ? text : undefined;
};

export const load: PageServerLoad = async (event) => {
	const db = getDatabase(event);
	const events = await db.events.listEvents();

	return {
		events
	};
};

export const actions: Actions = {
	createEvent: async (event) => {
		const formData = await event.request.formData();
		const name = normalizeText(formData.get('name'));
		const slug = normalizeText(formData.get('slug'));

		if (!name) {
			const db = getDatabase(event);
			const events = await db.events.listEvents();
			return fail(400, {
				type: 'error',
				source: 'createEvent',
				message: 'イベント名を入力してください。',
				events
			});
		}

		const db = getDatabase(event);

		try {
			const created = await db.events.createEvent({ name, slug: slug ?? undefined });
			const events = await db.events.listEvents();

			return {
				type: 'success',
				source: 'createEvent',
				message: `イベント「${created.name}」を作成しました。`,
				events,
				createdEventId: created.id
			};
		} catch (error) {
			const events = await db.events.listEvents();
			return fail(400, {
				type: 'error',
				source: 'createEvent',
				message: error instanceof Error ? error.message : 'イベントの作成に失敗しました。',
				events
			});
		}
	}
};
