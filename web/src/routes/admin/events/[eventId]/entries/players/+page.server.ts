import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createPlayer,
	deletePlayer,
	listPlayers,
	setPlayers,
	updatePlayer,
	type PlayerRecord
} from '$lib/server/repositories/players';

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) {
		return undefined;
	}

	const text = String(value).trim();

	return text.length > 0 ? text : undefined;
};

const getPlayers = (eventId: string): PlayerRecord[] =>
	[...listPlayers(eventId)].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

const serializePlayers = (eventId: string): string =>
	JSON.stringify(getPlayers(eventId), null, 2);

export const load: PageServerLoad = async (event) => {
	event.depends(`players:${event.params.eventId}`);

	const players = getPlayers(event.params.eventId);

	return {
		eventId: event.params.eventId,
		players,
		playersJson: JSON.stringify(players, null, 2)
	};
};

export const actions: Actions = {
	create: async (event) => {
		const form = await event.request.formData();
		const name = normalizeText(form.get('name'));
		const note = normalizeText(form.get('note'));

		if (!name) {
			return fail(400, { type: 'error', source: 'create', message: '名前は必須です。' });
		}

		const player = createPlayer(event.params.eventId, { name, note });
		const players = getPlayers(event.params.eventId);
		const playersJson = JSON.stringify(players, null, 2);

		return {
			success: true,
			type: 'success',
			source: 'create',
			message: `プレイヤー「${player.name}」を追加しました。`,
			player,
			players,
			playersJson
		};
	},
	update: async (event) => {
		const form = await event.request.formData();
		const playerId = normalizeText(form.get('playerId'));
		const name = normalizeText(form.get('name'));
		const note = normalizeText(form.get('note'));

		if (!playerId) {
			return fail(400, { type: 'error', source: 'update', message: 'playerId が指定されていません。' });
		}

		if (!name) {
			return fail(400, { type: 'error', source: 'update', message: '名前は必須です。' });
		}

		try {
			const player = updatePlayer(event.params.eventId, playerId, { name, note });
			const players = getPlayers(event.params.eventId);
			const playersJson = JSON.stringify(players, null, 2);

			return {
				success: true,
				type: 'success',
				source: 'update',
				message: `プレイヤー「${player.name}」を更新しました。`,
				player,
				players,
				playersJson
			};
		} catch (error) {
			return fail(404, { type: 'error', source: 'update', message: '指定したプレイヤーが見つかりません。' });
		}

	},
	delete: async (event) => {
		const form = await event.request.formData();
		const playerId = normalizeText(form.get('playerId'));

		if (!playerId) {
			return fail(400, { type: 'error', source: 'delete', message: 'playerId が指定されていません。' });
		}

		try {
			deletePlayer(event.params.eventId, playerId);
		} catch (error) {
			return fail(404, { type: 'error', source: 'delete', message: '指定したプレイヤーが見つかりません。' });
		}

		const players = getPlayers(event.params.eventId);
		const playersJson = JSON.stringify(players, null, 2);

		return {
			success: true,
			type: 'success',
			source: 'delete',
			message: 'プレイヤーを削除しました。',
			players,
			playersJson
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
				const maybeNote = Reflect.get(entry, 'note');

				if (typeof maybeName !== 'string') {
					return null;
				}

				return {
					id: typeof maybeId === 'string' ? maybeId : undefined,
					name: maybeName,
					note: typeof maybeNote === 'string' ? maybeNote : undefined
				};
			})
			.filter(Boolean);

		const imported = setPlayers(event.params.eventId, sanitized as Parameters<typeof setPlayers>[1]);
		const playersJson = JSON.stringify(imported, null, 2);
		const message =
			mode === 'editor'
				? `JSONエディタから${imported.length}件のプレイヤーを保存しました。`
				: `${imported.length}件のプレイヤーを取り込みました。`;

		return {
			success: true,
			type: 'success',
			source: mode,
			message,
			playersJson,
			players: imported
		};
	}
};
