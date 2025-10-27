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
	event.depends(`pairs:${event.params.eventId}`);

	const db = getDatabase(event);
	const pairs = await db.pairs.listPairs(event.params.eventId);
	const players = await db.players.listPlayers(event.params.eventId);
	const sortedPairs = [...pairs].sort((a, b) => (a.seed || 0) - (b.seed || 0));

	return {
		eventId: event.params.eventId,
		pairs: sortedPairs,
		players: players.sort((a, b) => a.name.localeCompare(b.name, 'ja')),
		pairsJson: JSON.stringify(sortedPairs, null, 2)
	};
};

export const actions: Actions = {
	create: async (event) => {
		const form = await event.request.formData();
		const player1_id = normalizeText(form.get('player1_id'));
		const player2_id = normalizeText(form.get('player2_id'));
		const seedStr = normalizeText(form.get('seed'));
		const seed = seedStr ? parseInt(seedStr, 10) : undefined;

		if (!player1_id || !player2_id) {
			return fail(400, { type: 'error', source: 'create', message: 'プレイヤー1とプレイヤー2は必須です。' });
		}

		if (player1_id === player2_id) {
			return fail(400, { type: 'error', source: 'create', message: '同じプレイヤーをペアにすることはできません。' });
		}

		const db = getDatabase(event);
		const pair = await db.pairs.createPair(event.params.eventId, { player1_id, player2_id, seed });
		const pairs = await db.pairs.listPairs(event.params.eventId);
		const sortedPairs = [...pairs].sort((a, b) => (a.seed || 0) - (b.seed || 0));
		const pairsJson = JSON.stringify(sortedPairs, null, 2);

		return {
			success: true,
			type: 'success',
			source: 'create',
			message: `ペアを追加しました。`,
			pair,
			pairs: sortedPairs,
			pairsJson
		};
	},
	update: async (event) => {
		const form = await event.request.formData();
		const pairId = normalizeText(form.get('pairId'));
		const player1_id = normalizeText(form.get('player1_id'));
		const player2_id = normalizeText(form.get('player2_id'));
		const seedStr = normalizeText(form.get('seed'));
		const seed = seedStr ? parseInt(seedStr, 10) : undefined;

		if (!pairId) {
			return fail(400, { type: 'error', source: 'update', message: 'pairId が指定されていません。' });
		}

		if (!player1_id || !player2_id) {
			return fail(400, { type: 'error', source: 'update', message: 'プレイヤー1とプレイヤー2は必須です。' });
		}

		if (player1_id === player2_id) {
			return fail(400, { type: 'error', source: 'update', message: '同じプレイヤーをペアにすることはできません。' });
		}

		try {
			const db = getDatabase(event);
			const pair = await db.pairs.updatePair(event.params.eventId, pairId, { player1_id, player2_id, seed });
			const pairs = await db.pairs.listPairs(event.params.eventId);
			const sortedPairs = [...pairs].sort((a, b) => (a.seed || 0) - (b.seed || 0));
			const pairsJson = JSON.stringify(sortedPairs, null, 2);

			return {
				success: true,
				type: 'success',
				source: 'update',
				message: `ペアを更新しました。`,
				pair,
				pairs: sortedPairs,
				pairsJson
			};
		} catch (error) {
			return fail(404, { type: 'error', source: 'update', message: '指定したペアが見つかりません。' });
		}
	},
	delete: async (event) => {
		const form = await event.request.formData();
		const pairId = normalizeText(form.get('pairId'));

		if (!pairId) {
			return fail(400, { type: 'error', source: 'delete', message: 'pairId が指定されていません。' });
		}

		try {
			const db = getDatabase(event);
			await db.pairs.deletePair(event.params.eventId, pairId);
		} catch (error) {
			return fail(404, { type: 'error', source: 'delete', message: '指定したペアが見つかりません。' });
		}

		const db = getDatabase(event);
		const pairs = await db.pairs.listPairs(event.params.eventId);
		const sortedPairs = [...pairs].sort((a, b) => (a.seed || 0) - (b.seed || 0));
		const pairsJson = JSON.stringify(sortedPairs, null, 2);

		return {
			success: true,
			type: 'success',
			source: 'delete',
			message: 'ペアを削除しました。',
			pairs: sortedPairs,
			pairsJson
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
				const maybePlayer1Id = Reflect.get(entry, 'player1_id');
				const maybePlayer2Id = Reflect.get(entry, 'player2_id');
				const maybeSeed = Reflect.get(entry, 'seed');

				if (typeof maybePlayer1Id !== 'string' || typeof maybePlayer2Id !== 'string') {
					return null;
				}

				return {
					id: typeof maybeId === 'string' ? maybeId : undefined,
					player1_id: maybePlayer1Id,
					player2_id: maybePlayer2Id,
					seed: typeof maybeSeed === 'number' ? maybeSeed : undefined
				};
			})
			.filter(Boolean);

		const db = getDatabase(event);
		const imported = await db.pairs.setPairs(event.params.eventId, sanitized as any);
		const pairsJson = JSON.stringify(imported, null, 2);
		const message =
			mode === 'editor'
				? `JSONエディタから${imported.length}件のペアを保存しました。`
				: `${imported.length}件のペアを取り込みました。`;

		return {
			success: true,
			type: 'success',
			source: mode,
			message,
			pairsJson,
			pairs: imported
		};
	}
};
