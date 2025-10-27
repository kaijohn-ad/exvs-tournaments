import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createTournament,
	deleteTournament,
	listTournaments,
	setTournaments,
	updateTournament,
	type TournamentRecord
} from '$lib/server/repositories/tournaments';

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) {
		return undefined;
	}

	const text = String(value).trim();

	return text.length > 0 ? text : undefined;
};

const getTournaments = (eventId: string): TournamentRecord[] =>
	[...listTournaments(eventId)].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

const serializeTournaments = (eventId: string): string =>
	JSON.stringify(getTournaments(eventId), null, 2);

export const load: PageServerLoad = async (event) => {
	event.depends(`tournaments:${event.params.eventId}`);

	const tournaments = getTournaments(event.params.eventId);

	return {
		eventId: event.params.eventId,
		tournaments,
		tournamentsJson: JSON.stringify(tournaments, null, 2)
	};
};

export const actions: Actions = {
	create: async (event) => {
		const form = await event.request.formData();
		const name = normalizeText(form.get('name'));
		const format = normalizeText(form.get('format')) as 'single-elimination' | undefined;
		const seedingMode = normalizeText(form.get('seedingMode')) as 'random' | 'manual' | undefined;

		if (!name) {
			return fail(400, { type: 'error', source: 'create', message: 'トーナメント名は必須です。' });
		}

		const tournament = createTournament(event.params.eventId, { name, format, seedingMode });
		const tournaments = getTournaments(event.params.eventId);
		const tournamentsJson = JSON.stringify(tournaments, null, 2);

		return {
			success: true,
			type: 'success',
			source: 'create',
			message: `トーナメント「${tournament.name}」を作成しました。`,
			tournament,
			tournaments,
			tournamentsJson
		};
	},
	update: async (event) => {
		const form = await event.request.formData();
		const tournamentId = normalizeText(form.get('tournamentId'));
		const name = normalizeText(form.get('name'));
		const format = normalizeText(form.get('format')) as 'single-elimination' | undefined;
		const seedingMode = normalizeText(form.get('seedingMode')) as 'random' | 'manual' | undefined;

		if (!tournamentId) {
			return fail(400, { type: 'error', source: 'update', message: 'tournamentId が指定されていません。' });
		}

		if (!name) {
			return fail(400, { type: 'error', source: 'update', message: 'トーナメント名は必須です。' });
		}

		try {
			const tournament = updateTournament(event.params.eventId, tournamentId, { name, format, seedingMode });
			const tournaments = getTournaments(event.params.eventId);
			const tournamentsJson = JSON.stringify(tournaments, null, 2);

			return {
				success: true,
				type: 'success',
				source: 'update',
				message: `トーナメント「${tournament.name}」を更新しました。`,
				tournament,
				tournaments,
				tournamentsJson
			};
		} catch (error) {
			return fail(404, { type: 'error', source: 'update', message: '指定したトーナメントが見つかりません。' });
		}

	},
	delete: async (event) => {
		const form = await event.request.formData();
		const tournamentId = normalizeText(form.get('tournamentId'));

		if (!tournamentId) {
			return fail(400, { type: 'error', source: 'delete', message: 'tournamentId が指定されていません。' });
		}

		try {
			deleteTournament(event.params.eventId, tournamentId);
		} catch (error) {
			return fail(404, { type: 'error', source: 'delete', message: '指定したトーナメントが見つかりません。' });
		}

		const tournaments = getTournaments(event.params.eventId);
		const tournamentsJson = JSON.stringify(tournaments, null, 2);

		return {
			success: true,
			type: 'success',
			source: 'delete',
			message: 'トーナメントを削除しました。',
			tournaments,
			tournamentsJson
		};
	},
	'import': async (event) => {
		const form = await event.request.formData();
		const rawPayload = form.get('payload');
		const payload = typeof rawPayload === 'string' ? rawPayload.trim() : '';
		const mode = normalizeText(form.get('mode')) ?? 'import';

		if (!payload) {
			return fail(400, {
				type: 'error',
				source: mode,
				message: 'JSONデータが入力されていません。',
				payload
			});
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(payload);
		} catch (error) {
			return fail(400, {
				type: 'error',
				source: mode,
				message: 'JSONの解析に失敗しました。',
				payload
			});
		}

		if (!Array.isArray(parsed)) {
			return fail(400, {
				type: 'error',
				source: mode,
				message: '配列形式のJSONを指定してください。',
				payload
			});
		}

		const sanitized = parsed
			.map((entry) => {
				if (typeof entry !== 'object' || entry === null) return null;
				const maybeId = Reflect.get(entry, 'id');
				const maybeName = Reflect.get(entry, 'name');
				const maybeFormat = Reflect.get(entry, 'format');
				const maybeSeedingMode = Reflect.get(entry, 'seedingMode');

				if (typeof maybeName !== 'string') {
					return null;
				}

				return {
					id: typeof maybeId === 'string' ? maybeId : undefined,
					name: maybeName,
					format: typeof maybeFormat === 'string' ? maybeFormat as 'single-elimination' : undefined,
					seedingMode: typeof maybeSeedingMode === 'string' ? maybeSeedingMode as 'random' | 'manual' : undefined
				};
			})
			.filter(Boolean);

		const imported = setTournaments(event.params.eventId, sanitized as Parameters<typeof setTournaments>[1]);
		const tournamentsJson = JSON.stringify(imported, null, 2);
		const message =
			mode === 'editor'
				? `JSONエディタから${imported.length}件のトーナメントを保存しました。`
				: `${imported.length}件のトーナメントを取り込みました。`;

		return {
			success: true,
			type: 'success',
			source: mode,
			message,
			tournamentsJson,
			tournaments: imported
		};
	}
};
