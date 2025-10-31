import { generateUUID } from "~/utils/uuid";

export interface FfaGroupData {
	round: number;
	position: number;
	participant_1_type: 'player' | 'bye' | 'empty';
	participant_1_player_id?: string | null;
	participant_2_type: 'player' | 'bye' | 'empty';
	participant_2_player_id?: string | null;
	participant_3_type: 'player' | 'bye' | 'empty';
	participant_3_player_id?: string | null;
	participant_4_type: 'player' | 'bye' | 'empty';
	participant_4_player_id?: string | null;
	status?: string;
	winner1_player_id?: string | null;
	winner2_player_id?: string | null;
}

export interface FfaGroupImportData extends FfaGroupData {
	id?: string;
	created_at?: string;
}

export interface FfaGroupRecord extends FfaGroupData {
	id: string;
	tournament_id: string;
	participant_1_player_id: string | null;
	participant_2_player_id: string | null;
	participant_3_player_id: string | null;
	participant_4_player_id: string | null;
	status: string;
	winner1_player_id: string | null;
	winner2_player_id: string | null;
	created_at: string;
}

export interface FfaGroupUpdateData {
	round?: number;
	position?: number;
	participant_1_type?: 'player' | 'bye' | 'empty';
	participant_1_player_id?: string | null;
	participant_2_type?: 'player' | 'bye' | 'empty';
	participant_2_player_id?: string | null;
	participant_3_type?: 'player' | 'bye' | 'empty';
	participant_3_player_id?: string | null;
	participant_4_type?: 'player' | 'bye' | 'empty';
	participant_4_player_id?: string | null;
	status?: string;
	winner1_player_id?: string | null;
	winner2_player_id?: string | null;
}

const store = new Map<string, Map<string, FfaGroupRecord>>();

const getTournamentStore = (tournamentId: string) => {
	let tournamentStore = store.get(tournamentId);

	if (!tournamentStore) {
		tournamentStore = new Map();
		store.set(tournamentId, tournamentStore);
	}

	return tournamentStore;
};

const normalizeParticipantPlayerId = (
	type: 'player' | 'bye' | 'empty',
	playerId?: string | null
) => {
	if (type === 'bye' || type === 'empty') {
		return null;
	}

	return playerId?.trim() ?? null;
};

const sanitizeRoundOrPosition = (value: number | undefined): number => {
	if (!Number.isFinite(value ?? NaN)) {
		return 1;
	}

	const parsed = Math.trunc(value as number);
	return Math.max(1, parsed);
};

const buildRecord = (
	tournamentId: string,
	id: string,
	data: FfaGroupData,
	createdAt: string
): FfaGroupRecord => {
	const round = sanitizeRoundOrPosition(data.round);
	const position = sanitizeRoundOrPosition(data.position);

	return {
		id,
		tournament_id: tournamentId,
		round,
		position,
		participant_1_type: data.participant_1_type,
		participant_1_player_id: normalizeParticipantPlayerId(
			data.participant_1_type,
			data.participant_1_player_id
		),
		participant_2_type: data.participant_2_type,
		participant_2_player_id: normalizeParticipantPlayerId(
			data.participant_2_type,
			data.participant_2_player_id
		),
		participant_3_type: data.participant_3_type,
		participant_3_player_id: normalizeParticipantPlayerId(
			data.participant_3_type,
			data.participant_3_player_id
		),
		participant_4_type: data.participant_4_type,
		participant_4_player_id: normalizeParticipantPlayerId(
			data.participant_4_type,
			data.participant_4_player_id
		),
		status: data.status ?? 'pending',
		winner1_player_id: data.winner1_player_id ?? null,
		winner2_player_id: data.winner2_player_id ?? null,
		created_at: createdAt
	};
};

const sortGroups = (groups: FfaGroupRecord[]) => {
	return groups.slice().sort((a, b) => {
		if (a.round !== b.round) {
			return a.round - b.round;
		}

		return a.position - b.position;
	});
};

export const listFfaGroups = (tournamentId: string): FfaGroupRecord[] => {
	const tournamentStore = getTournamentStore(tournamentId);
	return sortGroups(Array.from(tournamentStore.values()));
};

export const ensureFfaGroup = (
	tournamentId: string,
	groupId: string
): FfaGroupRecord => {
	const tournamentStore = getTournamentStore(tournamentId);
	const record = tournamentStore.get(groupId);

	if (!record) {
		throw new Error('FFA group not found');
	}

	return record;
};

export const createFfaGroup = (
	tournamentId: string,
	data: FfaGroupData
): FfaGroupRecord => {
	const tournamentStore = getTournamentStore(tournamentId);
	const id = generateUUID();
	const createdAt = new Date().toISOString();

	const record = buildRecord(tournamentId, id, data, createdAt);
	tournamentStore.set(id, record);

	return record;
};

const hasKey = <T extends object>(object: T, key: keyof any): boolean => {
	return Object.prototype.hasOwnProperty.call(object, key);
};

export const updateFfaGroup = (
	tournamentId: string,
	groupId: string,
	data: FfaGroupUpdateData
): FfaGroupRecord => {
	const tournamentStore = getTournamentStore(tournamentId);
	const existing = tournamentStore.get(groupId);

	if (!existing) {
		throw new Error('FFA group not found');
	}

	const round = data.round !== undefined ? sanitizeRoundOrPosition(data.round) : existing.round;
	const position =
		data.position !== undefined ? sanitizeRoundOrPosition(data.position) : existing.position;

	const participant1Type = data.participant_1_type ?? existing.participant_1_type;
	const participant1PlayerIdRaw = hasKey(data, 'participant_1_player_id')
		? data.participant_1_player_id ?? null
		: existing.participant_1_player_id;
	const participant1PlayerId = normalizeParticipantPlayerId(
		participant1Type,
		participant1PlayerIdRaw
	);

	const participant2Type = data.participant_2_type ?? existing.participant_2_type;
	const participant2PlayerIdRaw = hasKey(data, 'participant_2_player_id')
		? data.participant_2_player_id ?? null
		: existing.participant_2_player_id;
	const participant2PlayerId = normalizeParticipantPlayerId(
		participant2Type,
		participant2PlayerIdRaw
	);

	const participant3Type = data.participant_3_type ?? existing.participant_3_type;
	const participant3PlayerIdRaw = hasKey(data, 'participant_3_player_id')
		? data.participant_3_player_id ?? null
		: existing.participant_3_player_id;
	const participant3PlayerId = normalizeParticipantPlayerId(
		participant3Type,
		participant3PlayerIdRaw
	);

	const participant4Type = data.participant_4_type ?? existing.participant_4_type;
	const participant4PlayerIdRaw = hasKey(data, 'participant_4_player_id')
		? data.participant_4_player_id ?? null
		: existing.participant_4_player_id;
	const participant4PlayerId = normalizeParticipantPlayerId(
		participant4Type,
		participant4PlayerIdRaw
	);

	const status = data.status !== undefined ? data.status ?? existing.status : existing.status ?? 'pending';

	const winner1PlayerId = hasKey(data, 'winner1_player_id')
		? data.winner1_player_id ?? null
		: existing.winner1_player_id;
	const winner2PlayerId = hasKey(data, 'winner2_player_id')
		? data.winner2_player_id ?? null
		: existing.winner2_player_id;

	const updated: FfaGroupRecord = {
		...existing,
		round,
		position,
		participant_1_type: participant1Type,
		participant_1_player_id: participant1PlayerId,
		participant_2_type: participant2Type,
		participant_2_player_id: participant2PlayerId,
		participant_3_type: participant3Type,
		participant_3_player_id: participant3PlayerId,
		participant_4_type: participant4Type,
		participant_4_player_id: participant4PlayerId,
		status,
		winner1_player_id: winner1PlayerId,
		winner2_player_id: winner2PlayerId
	};

	tournamentStore.set(groupId, updated);
	return updated;
};

export const setFfaGroups = (
	tournamentId: string,
	groups: FfaGroupImportData[]
): FfaGroupRecord[] => {
	const tournamentStore = getTournamentStore(tournamentId);
	tournamentStore.clear();

	const createdAtDefault = new Date().toISOString();

	for (const group of groups) {
		if (!group.round || !group.position) {
			continue;
		}

		const id = group.id?.trim() || generateUUID();
		const createdAt = group.created_at ?? createdAtDefault;
		const record = buildRecord(tournamentId, id, group, createdAt);

		tournamentStore.set(id, record);
	}

	return listFfaGroups(tournamentId);
};

export const deleteFfaGroups = (tournamentId: string): void => {
	const tournamentStore = store.get(tournamentId);

	if (tournamentStore) {
		tournamentStore.clear();
		store.delete(tournamentId);
	}
};

export const clearFfaGroups = (tournamentId: string): void => {
	const tournamentStore = store.get(tournamentId);

	if (tournamentStore) {
		tournamentStore.clear();
	}
};

export const __resetForTests = () => {
	store.clear();
};

