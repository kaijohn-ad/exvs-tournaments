import type { RequestEvent } from '@sveltejs/kit';
import * as playersMemory from './repositories/players';
import * as tournamentsMemory from './repositories/tournaments';
import { createPlayersRepositoryD1 } from './repositories/players-d1';
import { createTournamentsRepositoryD1 } from './repositories/tournaments-d1';

const USE_MEMORY = process.env.USE_MEMORY_STORE === 'true' || process.env.USE_MEMORY_STORE === undefined;

export interface DatabaseContext {
	players: {
		listPlayers(eventId: string): Promise<playersMemory.PlayerRecord[]>;
		createPlayer(eventId: string, data: playersMemory.PlayerData): Promise<playersMemory.PlayerRecord>;
		ensurePlayer(eventId: string, playerId: string): Promise<playersMemory.PlayerRecord>;
		updatePlayer(eventId: string, playerId: string, data: playersMemory.PlayerData): Promise<playersMemory.PlayerRecord>;
		deletePlayer(eventId: string, playerId: string): Promise<void>;
		setPlayers(eventId: string, players: playersMemory.PlayerImportData[]): Promise<playersMemory.PlayerRecord[]>;
	};
	tournaments: {
		listTournaments(eventId: string): Promise<tournamentsMemory.TournamentRecord[]>;
		createTournament(eventId: string, data: tournamentsMemory.TournamentData): Promise<tournamentsMemory.TournamentRecord>;
		ensureTournament(eventId: string, tournamentId: string): Promise<tournamentsMemory.TournamentRecord>;
		updateTournament(eventId: string, tournamentId: string, data: tournamentsMemory.TournamentData): Promise<tournamentsMemory.TournamentRecord>;
		deleteTournament(eventId: string, tournamentId: string): Promise<void>;
		setTournaments(eventId: string, tournaments: tournamentsMemory.TournamentImportData[]): Promise<tournamentsMemory.TournamentRecord[]>;
	};
}

const wrapMemoryPlayers = () => ({
	async listPlayers(eventId: string) {
		return playersMemory.listPlayers(eventId);
	},
	async createPlayer(eventId: string, data: playersMemory.PlayerData) {
		return playersMemory.createPlayer(eventId, data);
	},
	async ensurePlayer(eventId: string, playerId: string) {
		return playersMemory.ensurePlayer(eventId, playerId);
	},
	async updatePlayer(eventId: string, playerId: string, data: playersMemory.PlayerData) {
		return playersMemory.updatePlayer(eventId, playerId, data);
	},
	async deletePlayer(eventId: string, playerId: string) {
		return playersMemory.deletePlayer(eventId, playerId);
	},
	async setPlayers(eventId: string, players: playersMemory.PlayerImportData[]) {
		return playersMemory.setPlayers(eventId, players);
	}
});

const wrapMemoryTournaments = () => ({
	async listTournaments(eventId: string) {
		return tournamentsMemory.listTournaments(eventId);
	},
	async createTournament(eventId: string, data: tournamentsMemory.TournamentData) {
		return tournamentsMemory.createTournament(eventId, data);
	},
	async ensureTournament(eventId: string, tournamentId: string) {
		return tournamentsMemory.ensureTournament(eventId, tournamentId);
	},
	async updateTournament(eventId: string, tournamentId: string, data: tournamentsMemory.TournamentData) {
		return tournamentsMemory.updateTournament(eventId, tournamentId, data);
	},
	async deleteTournament(eventId: string, tournamentId: string) {
		return tournamentsMemory.deleteTournament(eventId, tournamentId);
	},
	async setTournaments(eventId: string, tournaments: tournamentsMemory.TournamentImportData[]) {
		return tournamentsMemory.setTournaments(eventId, tournaments);
	}
});

export function getDatabase(event: RequestEvent): DatabaseContext {
	if (USE_MEMORY) {
		return {
			players: wrapMemoryPlayers(),
			tournaments: wrapMemoryTournaments()
		};
	}

	const db = event.platform?.env?.DB;
	if (!db) {
		return {
			players: wrapMemoryPlayers(),
			tournaments: wrapMemoryTournaments()
		};
	}

	return {
		players: createPlayersRepositoryD1(db),
		tournaments: createTournamentsRepositoryD1(db)
	};
}

export function resetForTests() {
	if (USE_MEMORY) {
		playersMemory.__resetForTests();
		tournamentsMemory.__resetForTests();
	}
}
