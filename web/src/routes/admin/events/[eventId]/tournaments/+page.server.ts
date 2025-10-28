import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDatabase } from '$lib/server/db';
import type { TournamentRecord } from '$lib/server/repositories/tournaments';
import { generateAndStoreSingleEliminationBracket } from '$lib/server/repositories/bracket-generator';

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) {
		return undefined;
	}

	const text = String(value).trim();

	return text.length > 0 ? text : undefined;
};

export const load: PageServerLoad = async (event) => {
	event.depends(`tournaments:${event.params.eventId}`);

	const db = getDatabase(event);
	const tournaments = await db.tournaments.listTournaments(event.params.eventId);
	const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

	return {
		eventId: event.params.eventId,
		tournaments: sortedTournaments,
		tournamentsJson: JSON.stringify(sortedTournaments, null, 2)
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

		const db = getDatabase(event);
		const tournament = await db.tournaments.createTournament(event.params.eventId, { name, format, seedingMode });
		const tournaments = await db.tournaments.listTournaments(event.params.eventId);
		const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
		const tournamentsJson = JSON.stringify(sortedTournaments, null, 2);

		return {
			success: true,
			type: 'success',
			source: 'create',
			message: `トーナメント「${tournament.name}」を作成しました。`,
			tournament,
			tournaments: sortedTournaments,
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
			const db = getDatabase(event);
			const tournament = await db.tournaments.updateTournament(event.params.eventId, tournamentId, { name, format, seedingMode });
			const tournaments = await db.tournaments.listTournaments(event.params.eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			const tournamentsJson = JSON.stringify(sortedTournaments, null, 2);

			return {
				success: true,
				type: 'success',
				source: 'update',
				message: `トーナメント「${tournament.name}」を更新しました。`,
				tournament,
				tournaments: sortedTournaments,
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
			const db = getDatabase(event);
			await db.tournaments.deleteTournament(event.params.eventId, tournamentId);
		} catch (error) {
			return fail(404, { type: 'error', source: 'delete', message: '指定したトーナメントが見つかりません。' });
		}

		const db = getDatabase(event);
		const tournaments = await db.tournaments.listTournaments(event.params.eventId);
		const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
		const tournamentsJson = JSON.stringify(sortedTournaments, null, 2);

		return {
			success: true,
			type: 'success',
			source: 'delete',
			message: 'トーナメントを削除しました。',
			tournaments: sortedTournaments,
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

		const db = getDatabase(event);
		const imported = await db.tournaments.setTournaments(event.params.eventId, sanitized as any);
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
	},
	generate: async (event) => {
		const form = await event.request.formData();
		const tournamentId = normalizeText(form.get('tournamentId'));
		const seedingOverride = normalizeText(form.get('seedingMode')) as 'random' | 'manual' | undefined;

		if (!tournamentId) {
			return fail(400, {
				type: 'error',
				source: 'generate',
				message: 'tournamentId が指定されていません。'
			});
		}

		const eventId = event.params.eventId;
		const db = getDatabase(event);

		let tournament: TournamentRecord;
		try {
			tournament = await db.tournaments.ensureTournament(eventId, tournamentId);
		} catch (error_) {
			return fail(404, {
				type: 'error',
				source: 'generate',
				message: '指定したトーナメントが見つかりません。',
				tournamentId
			});
		}

		const pairs = await db.pairs.listPairs(eventId);
		if (pairs.length < 2) {
			return fail(400, {
				type: 'error',
				source: 'generate',
				message: 'ブラケットを生成するには、少なくとも2組のペアが必要です。',
				tournamentId
			});
		}

		const seedingMode = seedingOverride ?? tournament.seedingMode ?? 'random';
		if (tournament.format && tournament.format !== 'single-elimination') {
			return fail(400, {
				type: 'error',
				source: 'generate',
				message: 'ブラケット生成はシングルエリミネーション形式でのみ利用できます。',
				tournamentId
			});
		}

		await generateAndStoreSingleEliminationBracket({
			tournamentId,
			pairs,
			seedingMode,
			setMatches: (targetTournamentId, matches) =>
				db.bracketMatches.setBracketMatches(targetTournamentId, matches)
		});

		const tournaments = await db.tournaments.listTournaments(eventId);
		const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
		const tournamentsJson = JSON.stringify(sortedTournaments, null, 2);

		return {
			success: true,
			type: 'success',
			source: 'generate',
			message: `トーナメント「${tournament.name}」のブラケットを生成しました。`,
			tournaments: sortedTournaments,
			tournamentsJson,
			tournamentId
		};
	}
};
