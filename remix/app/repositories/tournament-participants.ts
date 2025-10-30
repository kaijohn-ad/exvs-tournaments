import { generateUUID } from "~/utils/uuid";

export interface TournamentParticipantData {
	participant_type: 'pair' | 'solo';
	pair_id?: string | null;
	player_id?: string | null;
	seed?: number | null;
	note?: string | null;
}

export interface TournamentParticipantRecord {
	id: string;
	tournament_id: string;
	participant_type: 'pair' | 'solo';
	pair_id: string | null;
	player_id: string | null;
	seed: number | null;
	note: string | null;
	status: 'active' | 'removed';
	created_at: string;
}

const store = new Map<string, Map<string, TournamentParticipantRecord>>();

const getTournamentStore = (tournamentId: string) => {
	let tournamentStore = store.get(tournamentId);
	if (!tournamentStore) {
		tournamentStore = new Map();
		store.set(tournamentId, tournamentStore);
	}
	return tournamentStore;
};

export const listParticipants = (tournamentId: string): TournamentParticipantRecord[] => {
	return Array.from(getTournamentStore(tournamentId).values())
		.filter(p => p.status === 'active')
		.sort((a, b) => {
			const seedA = a.seed ?? Number.MAX_SAFE_INTEGER;
			const seedB = b.seed ?? Number.MAX_SAFE_INTEGER;
			if (seedA !== seedB) {
				return seedA - seedB;
			}
			return a.created_at.localeCompare(b.created_at);
		});
};

export const count = (tournamentId: string): number => {
	return listParticipants(tournamentId).length;
};

export const addPair = (
	tournamentId: string,
	pairId: string,
	opts?: { seed?: number | null; note?: string | null }
): TournamentParticipantRecord => {
	const tournamentStore = getTournamentStore(tournamentId);
	
	// Check for duplicate
	for (const record of tournamentStore.values()) {
		if (record.pair_id === pairId && record.status === 'active') {
			throw new Error('このペアは既に参加登録されています。');
		}
	}

	const record: TournamentParticipantRecord = {
		id: generateUUID(),
		tournament_id: tournamentId,
		participant_type: 'pair',
		pair_id: pairId,
		player_id: null,
		seed: opts?.seed ?? null,
		note: opts?.note?.trim() ?? null,
		status: 'active',
		created_at: new Date().toISOString()
	};

	tournamentStore.set(record.id, record);
	return record;
};

export const addSolo = (
	tournamentId: string,
	playerId: string,
	opts?: { note?: string | null }
): TournamentParticipantRecord => {
	const tournamentStore = getTournamentStore(tournamentId);
	
	// Check for duplicate
	for (const record of tournamentStore.values()) {
		if (record.player_id === playerId && record.status === 'active') {
			throw new Error('このプレイヤーは既に参加登録されています。');
		}
	}

	const record: TournamentParticipantRecord = {
		id: generateUUID(),
		tournament_id: tournamentId,
		participant_type: 'solo',
		pair_id: null,
		player_id: playerId,
		seed: null,
		note: opts?.note?.trim() ?? null,
		status: 'active',
		created_at: new Date().toISOString()
	};

	tournamentStore.set(record.id, record);
	return record;
};

export const removeById = (tournamentId: string, participantId: string): void => {
	const tournamentStore = getTournamentStore(tournamentId);
	const record = tournamentStore.get(participantId);
	
	if (!record) {
		throw new Error('参加者が見つかりません。');
	}

	const updated: TournamentParticipantRecord = {
		...record,
		status: 'removed'
	};
	tournamentStore.set(participantId, updated);
};

export const setSeed = (
	tournamentId: string,
	participantId: string,
	seed: number | null
): TournamentParticipantRecord => {
	const tournamentStore = getTournamentStore(tournamentId);
	const record = tournamentStore.get(participantId);
	
	if (!record || record.status !== 'active') {
		throw new Error('参加者が見つかりません。');
	}

	const updated: TournamentParticipantRecord = {
		...record,
		seed: seed ?? null
	};
	tournamentStore.set(participantId, updated);
	return updated;
};

export const setNote = (
	tournamentId: string,
	participantId: string,
	note: string | null
): TournamentParticipantRecord => {
	const tournamentStore = getTournamentStore(tournamentId);
	const record = tournamentStore.get(participantId);
	
	if (!record || record.status !== 'active') {
		throw new Error('参加者が見つかりません。');
	}

	const updated: TournamentParticipantRecord = {
		...record,
		note: note?.trim() ?? null
	};
	tournamentStore.set(participantId, updated);
	return updated;
};

export const ensureParticipant = (
	tournamentId: string,
	participantId: string
): TournamentParticipantRecord => {
	const tournamentStore = getTournamentStore(tournamentId);
	const record = tournamentStore.get(participantId);
	
	if (!record || record.status !== 'active') {
		throw new Error('参加者が見つかりません。');
	}

	return record;
};

export const __resetForTests = () => {
	store.clear();
};

