import type { PageServerLoad, Actions } from './$types';
import { getDatabase } from '$lib/server/db';
import { fail } from '@sveltejs/kit';

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) {
		return undefined;
	}

	const text = String(value).trim();

	return text.length > 0 ? text : undefined;
};

export const load: PageServerLoad = async (event) => {
	event.depends(`team-battles:${event.params.eventId}`);

	const db = getDatabase(event);
	
	const teamBattles = await db.teamBattles.listTeamBattles(event.params.eventId);
	const teams = await db.teams.listTeams(event.params.eventId);
	const players = await db.players.listPlayers(event.params.eventId);

	return {
		eventId: event.params.eventId,
		teamBattles,
		teams,
		players
	};
};

export const actions: Actions = {
	create: async (event) => {
		const formData = await event.request.formData();
		const team_a_id = normalizeText(formData.get('team_a_id'));
		const team_b_id = normalizeText(formData.get('team_b_id'));
		const slots_count_str = normalizeText(formData.get('slots_count'));
		const format = normalizeText(formData.get('format')) ?? 'waseda';
		const tiebreak = normalizeText(formData.get('tiebreak')) ?? 'off';

		if (!team_a_id) {
			return fail(400, { 
				type: 'error', 
				source: 'create', 
				message: 'チームAを選択してください。' 
			});
		}

		if (!team_b_id) {
			return fail(400, { 
				type: 'error', 
				source: 'create', 
				message: 'チームBを選択してください。' 
			});
		}

		if (team_a_id === team_b_id) {
			return fail(400, { 
				type: 'error', 
				source: 'create', 
				message: '同じチームを選択することはできません。' 
			});
		}

		const slots_count = slots_count_str ? parseInt(slots_count_str, 10) : 3;
		if (isNaN(slots_count) || slots_count < 1 || slots_count > 5) {
			return fail(400, { 
				type: 'error', 
				source: 'create', 
				message: 'スロット数は1〜5の範囲で指定してください。' 
			});
		}

		const db = getDatabase(event);

		try {
			await db.teams.ensureTeam(event.params.eventId, team_a_id);
			await db.teams.ensureTeam(event.params.eventId, team_b_id);
		} catch (error) {
			console.error('[team-battles:create] team validation failed', {
				eventId: event.params.eventId,
				team_a_id,
				team_b_id,
				error
			});
			return fail(404, {
				type: 'error',
				source: 'create',
				message: '指定されたチームが見つかりません。'
			});
		}

		try {
			const battle = await db.teamBattles.createTeamBattle(event.params.eventId, {
				team_a_id,
				team_b_id,
				slots_count,
				format,
				tiebreak
			});

			const teams = await db.teams.listTeams(event.params.eventId);
			const teamA = teams.find((t) => t.id === team_a_id);
			const teamB = teams.find((t) => t.id === team_b_id);

			return {
				success: true,
				type: 'success',
				source: 'create',
				message: `団体戦「${teamA?.name ?? 'チームA'} vs ${teamB?.name ?? 'チームB'}」を作成しました。`,
				battle
			};
		} catch (error) {
			console.error('[team-battles:create] failed', {
				eventId: event.params.eventId,
				team_a_id,
				team_b_id,
				error
			});
			return fail(500, {
				type: 'error',
				source: 'create',
				message: '団体戦の作成中に内部エラーが発生しました。',
				detail: error instanceof Error ? error.message : String(error)
			});
		}
	},

	update: async (event) => {
		const formData = await event.request.formData();
		const battleId = normalizeText(formData.get('battleId'));
		const team_a_id = normalizeText(formData.get('team_a_id'));
		const team_b_id = normalizeText(formData.get('team_b_id'));
		const slots_count_str = normalizeText(formData.get('slots_count'));
		const format = normalizeText(formData.get('format'));
		const tiebreak = normalizeText(formData.get('tiebreak'));

		if (!battleId) {
			return fail(400, { 
				type: 'error', 
				source: 'update', 
				message: 'battleId が指定されていません。' 
			});
		}

		if (!team_a_id) {
			return fail(400, { 
				type: 'error', 
				source: 'update', 
				message: 'チームAを選択してください。' 
			});
		}

		if (!team_b_id) {
			return fail(400, { 
				type: 'error', 
				source: 'update', 
				message: 'チームBを選択してください。' 
			});
		}

		if (team_a_id === team_b_id) {
			return fail(400, { 
				type: 'error', 
				source: 'update', 
				message: '同じチームを選択することはできません。' 
			});
		}

		const slots_count = slots_count_str ? parseInt(slots_count_str, 10) : undefined;
		if (slots_count !== undefined && (isNaN(slots_count) || slots_count < 1 || slots_count > 5)) {
			return fail(400, { 
				type: 'error', 
				source: 'update', 
				message: 'スロット数は1〜5の範囲で指定してください。' 
			});
		}

		const db = getDatabase(event);

		try {
			await db.teamBattles.ensureTeamBattle(event.params.eventId, battleId);
		} catch (error) {
			return fail(404, { 
				type: 'error', 
				source: 'update', 
				message: '指定された団体戦が見つかりません。' 
			});
		}

		try {
			await db.teams.ensureTeam(event.params.eventId, team_a_id);
			await db.teams.ensureTeam(event.params.eventId, team_b_id);
		} catch (error) {
			return fail(404, { 
				type: 'error', 
				source: 'update', 
				message: '指定されたチームが見つかりません。' 
			});
		}

		const battle = await db.teamBattles.updateTeamBattle(event.params.eventId, battleId, {
			team_a_id,
			team_b_id,
			slots_count,
			format,
			tiebreak
		});

		const teams = await db.teams.listTeams(event.params.eventId);
		const teamA = teams.find(t => t.id === team_a_id);
		const teamB = teams.find(t => t.id === team_b_id);

		return {
			success: true,
			type: 'success',
			source: 'update',
			message: `団体戦「${teamA?.name ?? 'チームA'} vs ${teamB?.name ?? 'チームB'}」を更新しました。`,
			battle
		};
	},

	delete: async (event) => {
		const formData = await event.request.formData();
		const battleId = formData.get('battleId')?.toString();

		if (!battleId) {
			return fail(400, { 
				type: 'error', 
				source: 'delete', 
				message: 'Battle ID is required' 
			});
		}

		const db = getDatabase(event);
		
		try {
			await db.teamBattles.deleteTeamBattle(event.params.eventId, battleId);
		} catch (error) {
			return fail(404, { 
				type: 'error', 
				source: 'delete', 
				message: '指定された団体戦が見つかりません。' 
			});
		}

		return { 
			success: true,
			type: 'success',
			source: 'delete',
			message: '団体戦を削除しました。'
		};
	}
};
