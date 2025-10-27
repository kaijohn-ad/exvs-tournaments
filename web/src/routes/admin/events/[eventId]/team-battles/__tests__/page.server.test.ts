import { beforeEach, describe, expect, it } from 'vitest';
import { resetForTests } from '$lib/server/db';
import { createTeam } from '$lib/server/repositories/teams';
import {
	createTeamBattle,
	listTeamBattles,
	type TeamBattleRecord
} from '$lib/server/repositories/team-battles';
import { actions, load } from '../+page.server';

const EVENT_ID = 'event-1';

const createRequestEvent = <T extends keyof typeof actions>(
	action: T,
	formEntries: Record<string, string>
) => {
	const formData = new FormData();

	for (const [key, value] of Object.entries(formEntries)) {
		formData.append(key, value);
	}

	const request = new Request('http://localhost/admin', {
		method: 'POST',
		body: formData
	});

	return {
		params: { eventId: EVENT_ID },
		locals: {},
		url: new URL('http://localhost/admin/events/event-1/team-battles'),
		request,
		fetch,
		platform: undefined,
		cookies: {
			get: () => undefined,
			set: () => undefined,
			delete: () => undefined,
			serialize: () => ''
		},
		setHeaders: () => undefined,
		depends: () => undefined,
		route: { id: 'admin/events/[eventId]/team-battles' }
	} as unknown as Parameters<(typeof actions)[T]>[0];
};

describe('admin team-battles page actions', () => {
	beforeEach(() => {
		resetForTests();
	});

	it('load returns team battles, teams, and players', async () => {
		const teamA = createTeam(EVENT_ID, { name: 'Team Alpha' });
		const teamB = createTeam(EVENT_ID, { name: 'Team Beta' });
		createTeamBattle(EVENT_ID, {
			team_a_id: teamA.id,
			team_b_id: teamB.id,
			slots_count: 3
		});

		const result = (await load({
			params: { eventId: EVENT_ID },
			locals: {},
			url: new URL('http://localhost/admin/events/event-1/team-battles'),
			fetch,
			platform: undefined,
			depends: () => undefined,
			cookies: {
				get: () => undefined,
				set: () => undefined,
				delete: () => undefined,
				serialize: () => ''
			},
			parent: async () => ({})
		} as any)) as { teamBattles: TeamBattleRecord[] };

		expect(result.teamBattles).toHaveLength(1);
		expect(result.teamBattles[0]).toMatchObject({
			team_a_id: teamA.id,
			team_b_id: teamB.id,
			slots_count: 3
		});
	});

	it('create action stores a team battle', async () => {
		const teamA = createTeam(EVENT_ID, { name: 'Team Alpha' });
		const teamB = createTeam(EVENT_ID, { name: 'Team Beta' });

		const result = await actions.create!(
			createRequestEvent('create', {
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: '3',
				format: 'waseda',
				tiebreak: 'off'
			})
		);

		expect(result).toHaveProperty('success', true);
		expect(listTeamBattles(EVENT_ID)).toHaveLength(1);
		expect(listTeamBattles(EVENT_ID)[0]).toMatchObject({
			team_a_id: teamA.id,
			team_b_id: teamB.id,
			slots_count: 3,
			format: 'waseda',
			tiebreak: 'off'
		});
	});

	it('create action validates team_a_id is required', async () => {
		const teamB = createTeam(EVENT_ID, { name: 'Team Beta' });

		const result = await actions.create!(
			createRequestEvent('create', {
				team_a_id: '',
				team_b_id: teamB.id,
				slots_count: '3'
			})
		);

		const status = (result as { status?: number } | undefined)?.status;
		expect(status).toBe(400);
		expect(listTeamBattles(EVENT_ID)).toHaveLength(0);
	});

	it('create action validates team_b_id is required', async () => {
		const teamA = createTeam(EVENT_ID, { name: 'Team Alpha' });

		const result = await actions.create!(
			createRequestEvent('create', {
				team_a_id: teamA.id,
				team_b_id: '',
				slots_count: '3'
			})
		);

		const status = (result as { status?: number } | undefined)?.status;
		expect(status).toBe(400);
		expect(listTeamBattles(EVENT_ID)).toHaveLength(0);
	});

	it('create action validates teams cannot be the same', async () => {
		const teamA = createTeam(EVENT_ID, { name: 'Team Alpha' });

		const result = await actions.create!(
			createRequestEvent('create', {
				team_a_id: teamA.id,
				team_b_id: teamA.id,
				slots_count: '3'
			})
		);

		const status = (result as { status?: number } | undefined)?.status;
		expect(status).toBe(400);
		expect(listTeamBattles(EVENT_ID)).toHaveLength(0);
	});

	it('create action validates slots_count range (1-5)', async () => {
		const teamA = createTeam(EVENT_ID, { name: 'Team Alpha' });
		const teamB = createTeam(EVENT_ID, { name: 'Team Beta' });

		const resultTooLow = await actions.create!(
			createRequestEvent('create', {
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: '0'
			})
		);

		expect((resultTooLow as { status?: number } | undefined)?.status).toBe(400);

		const resultTooHigh = await actions.create!(
			createRequestEvent('create', {
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: '6'
			})
		);

		expect((resultTooHigh as { status?: number } | undefined)?.status).toBe(400);
		expect(listTeamBattles(EVENT_ID)).toHaveLength(0);
	});

	it('create action validates teams exist', async () => {
		const result = await actions.create!(
			createRequestEvent('create', {
				team_a_id: 'non-existent-team-a',
				team_b_id: 'non-existent-team-b',
				slots_count: '3'
			})
		);

		const status = (result as { status?: number } | undefined)?.status;
		expect(status).toBe(404);
		expect(listTeamBattles(EVENT_ID)).toHaveLength(0);
	});

	it('update action modifies a team battle', async () => {
		const teamA = createTeam(EVENT_ID, { name: 'Team Alpha' });
		const teamB = createTeam(EVENT_ID, { name: 'Team Beta' });
		const teamC = createTeam(EVENT_ID, { name: 'Team Gamma' });

		const battle = createTeamBattle(EVENT_ID, {
			team_a_id: teamA.id,
			team_b_id: teamB.id,
			slots_count: 3
		});

		const result = await actions.update!(
			createRequestEvent('update', {
				battleId: battle.id,
				team_a_id: teamA.id,
				team_b_id: teamC.id,
				slots_count: '5',
				format: 'waseda',
				tiebreak: 'representative'
			})
		);

		expect(result).toHaveProperty('success', true);
		expect(listTeamBattles(EVENT_ID)[0]).toMatchObject({
			team_a_id: teamA.id,
			team_b_id: teamC.id,
			slots_count: 5,
			tiebreak: 'representative'
		});
	});

	it('update action validates battleId is required', async () => {
		const teamA = createTeam(EVENT_ID, { name: 'Team Alpha' });
		const teamB = createTeam(EVENT_ID, { name: 'Team Beta' });

		const result = await actions.update!(
			createRequestEvent('update', {
				battleId: '',
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: '3'
			})
		);

		const status = (result as { status?: number } | undefined)?.status;
		expect(status).toBe(400);
	});

	it('update action validates team_a_id is required', async () => {
		const teamA = createTeam(EVENT_ID, { name: 'Team Alpha' });
		const teamB = createTeam(EVENT_ID, { name: 'Team Beta' });

		const battle = createTeamBattle(EVENT_ID, {
			team_a_id: teamA.id,
			team_b_id: teamB.id,
			slots_count: 3
		});

		const result = await actions.update!(
			createRequestEvent('update', {
				battleId: battle.id,
				team_a_id: '',
				team_b_id: teamB.id,
				slots_count: '3'
			})
		);

		const status = (result as { status?: number } | undefined)?.status;
		expect(status).toBe(400);
	});

	it('update action validates team_b_id is required', async () => {
		const teamA = createTeam(EVENT_ID, { name: 'Team Alpha' });
		const teamB = createTeam(EVENT_ID, { name: 'Team Beta' });

		const battle = createTeamBattle(EVENT_ID, {
			team_a_id: teamA.id,
			team_b_id: teamB.id,
			slots_count: 3
		});

		const result = await actions.update!(
			createRequestEvent('update', {
				battleId: battle.id,
				team_a_id: teamA.id,
				team_b_id: '',
				slots_count: '3'
			})
		);

		const status = (result as { status?: number } | undefined)?.status;
		expect(status).toBe(400);
	});

	it('update action validates teams cannot be the same', async () => {
		const teamA = createTeam(EVENT_ID, { name: 'Team Alpha' });
		const teamB = createTeam(EVENT_ID, { name: 'Team Beta' });

		const battle = createTeamBattle(EVENT_ID, {
			team_a_id: teamA.id,
			team_b_id: teamB.id,
			slots_count: 3
		});

		const result = await actions.update!(
			createRequestEvent('update', {
				battleId: battle.id,
				team_a_id: teamA.id,
				team_b_id: teamA.id,
				slots_count: '3'
			})
		);

		const status = (result as { status?: number } | undefined)?.status;
		expect(status).toBe(400);
	});

	it('update action validates slots_count range (1-5)', async () => {
		const teamA = createTeam(EVENT_ID, { name: 'Team Alpha' });
		const teamB = createTeam(EVENT_ID, { name: 'Team Beta' });

		const battle = createTeamBattle(EVENT_ID, {
			team_a_id: teamA.id,
			team_b_id: teamB.id,
			slots_count: 3
		});

		const resultTooLow = await actions.update!(
			createRequestEvent('update', {
				battleId: battle.id,
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: '0'
			})
		);

		expect((resultTooLow as { status?: number } | undefined)?.status).toBe(400);

		const resultTooHigh = await actions.update!(
			createRequestEvent('update', {
				battleId: battle.id,
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: '6'
			})
		);

		expect((resultTooHigh as { status?: number } | undefined)?.status).toBe(400);
	});

	it('update action validates battle exists', async () => {
		const teamA = createTeam(EVENT_ID, { name: 'Team Alpha' });
		const teamB = createTeam(EVENT_ID, { name: 'Team Beta' });

		const result = await actions.update!(
			createRequestEvent('update', {
				battleId: 'non-existent-battle',
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: '3'
			})
		);

		const status = (result as { status?: number } | undefined)?.status;
		expect(status).toBe(404);
	});

	it('update action validates teams exist', async () => {
		const teamA = createTeam(EVENT_ID, { name: 'Team Alpha' });
		const teamB = createTeam(EVENT_ID, { name: 'Team Beta' });

		const battle = createTeamBattle(EVENT_ID, {
			team_a_id: teamA.id,
			team_b_id: teamB.id,
			slots_count: 3
		});

		const result = await actions.update!(
			createRequestEvent('update', {
				battleId: battle.id,
				team_a_id: 'non-existent-team-a',
				team_b_id: 'non-existent-team-b',
				slots_count: '3'
			})
		);

		const status = (result as { status?: number } | undefined)?.status;
		expect(status).toBe(404);
	});

	it('delete action removes a team battle', async () => {
		const teamA = createTeam(EVENT_ID, { name: 'Team Alpha' });
		const teamB = createTeam(EVENT_ID, { name: 'Team Beta' });

		const battle = createTeamBattle(EVENT_ID, {
			team_a_id: teamA.id,
			team_b_id: teamB.id,
			slots_count: 3
		});

		await actions.delete!(createRequestEvent('delete', { battleId: battle.id }));

		expect(listTeamBattles(EVENT_ID)).toHaveLength(0);
	});

	it('delete action validates battleId is required', async () => {
		const result = await actions.delete!(createRequestEvent('delete', { battleId: '' }));

		const status = (result as { status?: number } | undefined)?.status;
		expect(status).toBe(400);
	});

	it('delete action validates battle exists', async () => {
		const result = await actions.delete!(
			createRequestEvent('delete', { battleId: 'non-existent-battle' })
		);

		const status = (result as { status?: number } | undefined)?.status;
		expect(status).toBe(404);
	});
});
