import type { RequestEvent } from '@sveltejs/kit';
import * as playersMemory from './repositories/players';
import * as tournamentsMemory from './repositories/tournaments';
import * as pairsMemory from './repositories/pairs';
import * as teamsMemory from './repositories/teams';
import * as teamBattlesMemory from './repositories/team-battles';
import * as teamBattleSlotsMemory from './repositories/team-battle-slots';
import * as matchesMemory from './repositories/matches';
import * as playerStatsMemory from './repositories/player-stats';
import { createPlayersRepositoryD1 } from './repositories/players-d1';
import { createTournamentsRepositoryD1 } from './repositories/tournaments-d1';
import { createPairsRepositoryD1 } from './repositories/pairs-d1';
import { createTeamsRepositoryD1 } from './repositories/teams-d1';
import { createTeamBattlesRepositoryD1 } from './repositories/team-battles-d1';
import { createTeamBattleSlotsRepositoryD1 } from './repositories/team-battle-slots-d1';
import { createMatchesRepositoryD1 } from './repositories/matches-d1';
import { createPlayerStatsRepositoryD1 } from './repositories/player-stats-d1';

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
	pairs: {
		listPairs(eventId: string): Promise<pairsMemory.PairRecord[]>;
		createPair(eventId: string, data: pairsMemory.PairData): Promise<pairsMemory.PairRecord>;
		ensurePair(eventId: string, pairId: string): Promise<pairsMemory.PairRecord>;
		updatePair(eventId: string, pairId: string, data: pairsMemory.PairData): Promise<pairsMemory.PairRecord>;
		deletePair(eventId: string, pairId: string): Promise<void>;
		setPairs(eventId: string, pairs: pairsMemory.PairImportData[]): Promise<pairsMemory.PairRecord[]>;
	};
	teams: {
		listTeams(eventId: string): Promise<teamsMemory.TeamRecord[]>;
		createTeam(eventId: string, data: teamsMemory.TeamData): Promise<teamsMemory.TeamRecord>;
		ensureTeam(eventId: string, teamId: string): Promise<teamsMemory.TeamRecord>;
		updateTeam(eventId: string, teamId: string, data: teamsMemory.TeamData): Promise<teamsMemory.TeamRecord>;
		deleteTeam(eventId: string, teamId: string): Promise<void>;
		setTeams(eventId: string, teams: teamsMemory.TeamImportData[]): Promise<teamsMemory.TeamRecord[]>;
	};
	teamBattles: {
		listTeamBattles(eventId: string): Promise<teamBattlesMemory.TeamBattleRecord[]>;
		createTeamBattle(eventId: string, data: teamBattlesMemory.TeamBattleData): Promise<teamBattlesMemory.TeamBattleRecord>;
		ensureTeamBattle(eventId: string, battleId: string): Promise<teamBattlesMemory.TeamBattleRecord>;
		updateTeamBattle(eventId: string, battleId: string, data: teamBattlesMemory.TeamBattleData): Promise<teamBattlesMemory.TeamBattleRecord>;
		deleteTeamBattle(eventId: string, battleId: string): Promise<void>;
		setTeamBattles(eventId: string, battles: teamBattlesMemory.TeamBattleImportData[]): Promise<teamBattlesMemory.TeamBattleRecord[]>;
	};
	matches: {
		listMatches(contextType?: string, contextId?: string): Promise<matchesMemory.MatchRecord[]>;
		createMatch(data: matchesMemory.MatchData): Promise<matchesMemory.MatchRecord>;
		ensureMatch(matchId: string): Promise<matchesMemory.MatchRecord>;
		updateMatch(matchId: string, data: matchesMemory.MatchData): Promise<matchesMemory.MatchRecord>;
		deleteMatch(matchId: string): Promise<void>;
		setMatches(matches: matchesMemory.MatchImportData[]): Promise<matchesMemory.MatchRecord[]>;
	};
	playerStats: {
		listPlayerStats(scope?: string, scopeId?: string): Promise<playerStatsMemory.PlayerStatsRecord[]>;
		getPlayerStats(playerId: string, scope: string, scopeId?: string): Promise<playerStatsMemory.PlayerStatsRecord | null>;
		createPlayerStats(data: playerStatsMemory.PlayerStatsData): Promise<playerStatsMemory.PlayerStatsRecord>;
		ensurePlayerStats(statsId: string): Promise<playerStatsMemory.PlayerStatsRecord>;
		updatePlayerStats(statsId: string, data: playerStatsMemory.PlayerStatsData): Promise<playerStatsMemory.PlayerStatsRecord>;
		incrementPlayerStats(playerId: string, scope: string, scopeId: string | undefined, won: boolean): Promise<playerStatsMemory.PlayerStatsRecord>;
		deletePlayerStats(statsId: string): Promise<void>;
		setPlayerStats(stats: playerStatsMemory.PlayerStatsImportData[]): Promise<playerStatsMemory.PlayerStatsRecord[]>;
	};
	teamBattleSlots: {
		listTeamBattleSlots(battleId: string): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord[]>;
		listTeamBattleSlotsByTeam(battleId: string, teamId: string): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord[]>;
		createTeamBattleSlot(data: teamBattleSlotsMemory.TeamBattleSlotData): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord>;
		ensureTeamBattleSlot(battleId: string, slotId: string): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord>;
		updateTeamBattleSlot(battleId: string, slotId: string, data: teamBattleSlotsMemory.TeamBattleSlotData): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord>;
		deleteTeamBattleSlot(battleId: string, slotId: string): Promise<void>;
		deleteTeamBattleSlotsByBattle(battleId: string): Promise<void>;
		setTeamBattleSlots(battleId: string, slots: teamBattleSlotsMemory.TeamBattleSlotImportData[]): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord[]>;
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

const wrapMemoryPairs = () => ({
	async listPairs(eventId: string) {
		return pairsMemory.listPairs(eventId);
	},
	async createPair(eventId: string, data: pairsMemory.PairData) {
		return pairsMemory.createPair(eventId, data);
	},
	async ensurePair(eventId: string, pairId: string) {
		return pairsMemory.ensurePair(eventId, pairId);
	},
	async updatePair(eventId: string, pairId: string, data: pairsMemory.PairData) {
		return pairsMemory.updatePair(eventId, pairId, data);
	},
	async deletePair(eventId: string, pairId: string) {
		return pairsMemory.deletePair(eventId, pairId);
	},
	async setPairs(eventId: string, pairs: pairsMemory.PairImportData[]) {
		return pairsMemory.setPairs(eventId, pairs);
	}
});

const wrapMemoryTeams = () => ({
	async listTeams(eventId: string) {
		return teamsMemory.listTeams(eventId);
	},
	async createTeam(eventId: string, data: teamsMemory.TeamData) {
		return teamsMemory.createTeam(eventId, data);
	},
	async ensureTeam(eventId: string, teamId: string) {
		return teamsMemory.ensureTeam(eventId, teamId);
	},
	async updateTeam(eventId: string, teamId: string, data: teamsMemory.TeamData) {
		return teamsMemory.updateTeam(eventId, teamId, data);
	},
	async deleteTeam(eventId: string, teamId: string) {
		return teamsMemory.deleteTeam(eventId, teamId);
	},
	async setTeams(eventId: string, teams: teamsMemory.TeamImportData[]) {
		return teamsMemory.setTeams(eventId, teams);
	}
});

const wrapMemoryTeamBattles = () => ({
	async listTeamBattles(eventId: string) {
		return teamBattlesMemory.listTeamBattles(eventId);
	},
	async createTeamBattle(eventId: string, data: teamBattlesMemory.TeamBattleData) {
		return teamBattlesMemory.createTeamBattle(eventId, data);
	},
	async ensureTeamBattle(eventId: string, battleId: string) {
		return teamBattlesMemory.ensureTeamBattle(eventId, battleId);
	},
	async updateTeamBattle(eventId: string, battleId: string, data: teamBattlesMemory.TeamBattleData) {
		return teamBattlesMemory.updateTeamBattle(eventId, battleId, data);
	},
	async deleteTeamBattle(eventId: string, battleId: string) {
		return teamBattlesMemory.deleteTeamBattle(eventId, battleId);
	},
	async setTeamBattles(eventId: string, battles: teamBattlesMemory.TeamBattleImportData[]) {
		return teamBattlesMemory.setTeamBattles(eventId, battles);
	}
});

const wrapMemoryMatches = () => ({
	async listMatches(contextType?: string, contextId?: string) {
		return matchesMemory.listMatches(contextType, contextId);
	},
	async createMatch(data: matchesMemory.MatchData) {
		return matchesMemory.createMatch(data);
	},
	async ensureMatch(matchId: string) {
		return matchesMemory.ensureMatch(matchId);
	},
	async updateMatch(matchId: string, data: matchesMemory.MatchData) {
		return matchesMemory.updateMatch(matchId, data);
	},
	async deleteMatch(matchId: string) {
		return matchesMemory.deleteMatch(matchId);
	},
	async setMatches(matches: matchesMemory.MatchImportData[]) {
		return matchesMemory.setMatches(matches);
	}
});

const wrapMemoryPlayerStats = () => ({
	async listPlayerStats(scope?: string, scopeId?: string) {
		return playerStatsMemory.listPlayerStats(scope, scopeId);
	},
	async getPlayerStats(playerId: string, scope: string, scopeId?: string) {
		return playerStatsMemory.getPlayerStats(playerId, scope, scopeId);
	},
	async createPlayerStats(data: playerStatsMemory.PlayerStatsData) {
		return playerStatsMemory.createPlayerStats(data);
	},
	async ensurePlayerStats(statsId: string) {
		return playerStatsMemory.ensurePlayerStats(statsId);
	},
	async updatePlayerStats(statsId: string, data: playerStatsMemory.PlayerStatsData) {
		return playerStatsMemory.updatePlayerStats(statsId, data);
	},
	async incrementPlayerStats(playerId: string, scope: string, scopeId: string | undefined, won: boolean) {
		return playerStatsMemory.incrementPlayerStats(playerId, scope, scopeId, won);
	},
	async deletePlayerStats(statsId: string) {
		return playerStatsMemory.deletePlayerStats(statsId);
	},
	async setPlayerStats(stats: playerStatsMemory.PlayerStatsImportData[]) {
		return playerStatsMemory.setPlayerStats(stats);
	}
});

const wrapMemoryTeamBattleSlots = () => ({
	async listTeamBattleSlots(battleId: string) {
		return teamBattleSlotsMemory.listTeamBattleSlots(battleId);
	},
	async listTeamBattleSlotsByTeam(battleId: string, teamId: string) {
		return teamBattleSlotsMemory.listTeamBattleSlotsByTeam(battleId, teamId);
	},
	async createTeamBattleSlot(data: teamBattleSlotsMemory.TeamBattleSlotData) {
		return teamBattleSlotsMemory.createTeamBattleSlot(data);
	},
	async ensureTeamBattleSlot(battleId: string, slotId: string) {
		return teamBattleSlotsMemory.ensureTeamBattleSlot(battleId, slotId);
	},
	async updateTeamBattleSlot(battleId: string, slotId: string, data: teamBattleSlotsMemory.TeamBattleSlotData) {
		return teamBattleSlotsMemory.updateTeamBattleSlot(battleId, slotId, data);
	},
	async deleteTeamBattleSlot(battleId: string, slotId: string) {
		return teamBattleSlotsMemory.deleteTeamBattleSlot(battleId, slotId);
	},
	async deleteTeamBattleSlotsByBattle(battleId: string) {
		return teamBattleSlotsMemory.deleteTeamBattleSlotsByBattle(battleId);
	},
	async setTeamBattleSlots(battleId: string, slots: teamBattleSlotsMemory.TeamBattleSlotImportData[]) {
		return teamBattleSlotsMemory.setTeamBattleSlots(battleId, slots);
	}
});

export function getDatabase(event: RequestEvent): DatabaseContext {
	if (USE_MEMORY) {
		return {
			players: wrapMemoryPlayers(),
			tournaments: wrapMemoryTournaments(),
			pairs: wrapMemoryPairs(),
			teams: wrapMemoryTeams(),
			teamBattles: wrapMemoryTeamBattles(),
			teamBattleSlots: wrapMemoryTeamBattleSlots(),
			matches: wrapMemoryMatches(),
			playerStats: wrapMemoryPlayerStats()
		};
	}

	const db = event.platform?.env?.DB;
	if (!db) {
		return {
			players: wrapMemoryPlayers(),
			tournaments: wrapMemoryTournaments(),
			pairs: wrapMemoryPairs(),
			teams: wrapMemoryTeams(),
			teamBattles: wrapMemoryTeamBattles(),
			teamBattleSlots: wrapMemoryTeamBattleSlots(),
			matches: wrapMemoryMatches(),
			playerStats: wrapMemoryPlayerStats()
		};
	}

	return {
		players: createPlayersRepositoryD1(db),
		tournaments: createTournamentsRepositoryD1(db),
		pairs: createPairsRepositoryD1(db),
		teams: createTeamsRepositoryD1(db),
		teamBattles: createTeamBattlesRepositoryD1(db),
		teamBattleSlots: createTeamBattleSlotsRepositoryD1(db),
		matches: createMatchesRepositoryD1(db),
		playerStats: createPlayerStatsRepositoryD1(db)
	};
}

export function resetForTests() {
	if (USE_MEMORY) {
		playersMemory.__resetForTests();
		tournamentsMemory.__resetForTests();
		pairsMemory.__resetForTests();
		teamsMemory.__resetForTests();
		teamBattlesMemory.__resetForTests();
		teamBattleSlotsMemory.__resetForTests();
		matchesMemory.__resetForTests();
		playerStatsMemory.__resetForTests();
	}
}
