import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDatabase } from '$lib/server/db';

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) {
		return undefined;
	}

	const text = String(value).trim();

	return text.length > 0 ? text : undefined;
};

export const load: PageServerLoad = async (event) => {
	event.depends(`teams:${event.params.eventId}`);

	const db = getDatabase(event);
	const teams = await db.teams.listTeams(event.params.eventId);
	const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

	return {
		eventId: event.params.eventId,
		teams: sortedTeams,
		teamsJson: JSON.stringify(sortedTeams, null, 2)
	};
};

export const actions: Actions = {
	create: async (event) => {
		const form = await event.request.formData();
		const name = normalizeText(form.get('name'));

		if (!name) {
			return fail(400, { type: 'error', source: 'create', message: 'チーム名は必須です。' });
		}

		const db = getDatabase(event);
		const team = await db.teams.createTeam(event.params.eventId, { name });
		const teams = await db.teams.listTeams(event.params.eventId);
		const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
		const teamsJson = JSON.stringify(sortedTeams, null, 2);

		return {
			success: true,
			type: 'success',
			source: 'create',
			message: `チーム「${name}」を追加しました。`,
			team,
			teams: sortedTeams,
			teamsJson
		};
	},
	update: async (event) => {
		const form = await event.request.formData();
		const teamId = normalizeText(form.get('teamId'));
		const name = normalizeText(form.get('name'));

		if (!teamId) {
			return fail(400, { type: 'error', source: 'update', message: 'teamId が指定されていません。' });
		}

		if (!name) {
			return fail(400, { type: 'error', source: 'update', message: 'チーム名は必須です。' });
		}

		try {
			const db = getDatabase(event);
			const team = await db.teams.updateTeam(event.params.eventId, teamId, { name });
			const teams = await db.teams.listTeams(event.params.eventId);
			const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			const teamsJson = JSON.stringify(sortedTeams, null, 2);

			return {
				success: true,
				type: 'success',
				source: 'update',
				message: `チーム「${name}」を更新しました。`,
				team,
				teams: sortedTeams,
				teamsJson
			};
		} catch (error) {
			return fail(404, { type: 'error', source: 'update', message: '指定したチームが見つかりません。' });
		}
	},
	delete: async (event) => {
		const form = await event.request.formData();
		const teamId = normalizeText(form.get('teamId'));

		if (!teamId) {
			return fail(400, { type: 'error', source: 'delete', message: 'teamId が指定されていません。' });
		}

		try {
			const db = getDatabase(event);
			await db.teams.deleteTeam(event.params.eventId, teamId);
		} catch (error) {
			return fail(404, { type: 'error', source: 'delete', message: '指定したチームが見つかりません。' });
		}

		const db = getDatabase(event);
		const teams = await db.teams.listTeams(event.params.eventId);
		const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
		const teamsJson = JSON.stringify(sortedTeams, null, 2);

		return {
			success: true,
			type: 'success',
			source: 'delete',
			message: 'チームを削除しました。',
			teams: sortedTeams,
			teamsJson
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

				if (typeof maybeName !== 'string' || !maybeName.trim()) {
					return null;
				}

				return {
					id: typeof maybeId === 'string' ? maybeId : undefined,
					name: maybeName
				};
			})
			.filter(Boolean);

		const db = getDatabase(event);
		const imported = await db.teams.setTeams(event.params.eventId, sanitized as any);
		const teamsJson = JSON.stringify(imported, null, 2);
		const message =
			mode === 'editor'
				? `JSONエディタから${imported.length}件のチームを保存しました。`
				: `${imported.length}件のチームを取り込みました。`;

		return {
			success: true,
			type: 'success',
			source: mode,
			message,
			teamsJson,
			teams: imported
		};
	}
};
