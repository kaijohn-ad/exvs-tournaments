import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDatabase } from '$lib/server/db';
import type { PlayerRecord } from '$lib/server/repositories/players';

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) {
		return undefined;
	}

	const text = String(value).trim();

	return text.length > 0 ? text : undefined;
};

export const load: PageServerLoad = async (event) => {
	event.depends(`players:${event.params.eventId}`);

	const db = getDatabase(event);
	const players = await db.players.listPlayers(event.params.eventId);
	const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

	return {
		eventId: event.params.eventId,
		players: sortedPlayers,
		playersJson: JSON.stringify(sortedPlayers, null, 2)
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

		const db = getDatabase(event);
		const player = await db.players.createPlayer(event.params.eventId, { name, note });
		const players = await db.players.listPlayers(event.params.eventId);
		const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
		const playersJson = JSON.stringify(sortedPlayers, null, 2);

		return {
			success: true,
			type: 'success',
			source: 'create',
			message: `プレイヤー「${player.name}」を追加しました。`,
			player,
			players: sortedPlayers,
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
			const db = getDatabase(event);
			const player = await db.players.updatePlayer(event.params.eventId, playerId, { name, note });
			const players = await db.players.listPlayers(event.params.eventId);
			const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			const playersJson = JSON.stringify(sortedPlayers, null, 2);

			return {
				success: true,
				type: 'success',
				source: 'update',
				message: `プレイヤー「${player.name}」を更新しました。`,
				player,
				players: sortedPlayers,
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
			const db = getDatabase(event);
			await db.players.deletePlayer(event.params.eventId, playerId);
		} catch (error) {
			return fail(404, { type: 'error', source: 'delete', message: '指定したプレイヤーが見つかりません。' });
		}

		const db = getDatabase(event);
		const players = await db.players.listPlayers(event.params.eventId);
		const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
		const playersJson = JSON.stringify(sortedPlayers, null, 2);

		return {
			success: true,
			type: 'success',
			source: 'delete',
			message: 'プレイヤーを削除しました。',
			players: sortedPlayers,
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

		const db = getDatabase(event);
		const imported = await db.players.setPlayers(event.params.eventId, sanitized as any);
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
