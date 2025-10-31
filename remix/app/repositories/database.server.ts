import type { AppLoadContext } from "@remix-run/cloudflare";
import { getStage } from "../utils/runtime.server";
import { logDb } from "../utils/logger.server";
import * as eventsMemory from "./events";
import * as playersMemory from "./players";
import * as tournamentsMemory from "./tournaments";
import * as pairsMemory from "./pairs";
import * as teamsMemory from "./teams";
import * as teamBattlesMemory from "./team-battles";
import * as teamBattleSlotsMemory from "./team-battle-slots";
import * as matchesMemory from "./matches";
import * as bracketMatchesMemory from "./bracket-matches";
import * as ffaGroupsMemory from "./ffa-groups";
import * as playerStatsMemory from "./player-stats";
import * as tournamentParticipantsMemory from "./tournament-participants";
import { createEventsRepositoryD1 } from "./events-d1";
import { createPlayersRepositoryD1 } from "./players-d1";
import { createTournamentsRepositoryD1 } from "./tournaments-d1";
import { createPairsRepositoryD1 } from "./pairs-d1";
import { createTeamsRepositoryD1 } from "./teams-d1";
import { createTeamBattlesRepositoryD1 } from "./team-battles-d1";
import { createTeamBattleSlotsRepositoryD1 } from "./team-battle-slots-d1";
import { createMatchesRepositoryD1 } from "./matches-d1";
import { createBracketMatchesRepositoryD1 } from "./bracket-matches-d1";
import { createFfaGroupsRepositoryD1 } from "./ffa-groups-d1";
import { createPlayerStatsRepositoryD1 } from "./player-stats-d1";
import { createTournamentParticipantsRepositoryD1 } from "./tournament-participants-d1";

export interface DatabaseContext {
	events: {
		listEvents(): Promise<eventsMemory.EventRecord[]>;
		createEvent(data: eventsMemory.EventData): Promise<eventsMemory.EventRecord>;
		ensureEvent(eventId: string): Promise<eventsMemory.EventRecord>;
		updateEvent(eventId: string, data: eventsMemory.EventData): Promise<eventsMemory.EventRecord>;
		deleteEvent(eventId: string): Promise<void>;
		findEventBySlug(slug: string): Promise<eventsMemory.EventRecord | null>;
	};
	players: {
		listPlayers(eventId: string): Promise<playersMemory.PlayerRecord[]>;
		createPlayer(eventId: string, data: playersMemory.PlayerData): Promise<playersMemory.PlayerRecord>;
		ensurePlayer(playerId: string): Promise<playersMemory.PlayerRecord>;
		updatePlayer(playerId: string, data: playersMemory.PlayerData): Promise<playersMemory.PlayerRecord>;
		deletePlayer(playerId: string): Promise<void>;
		setPlayers(
			eventId: string,
			players: playersMemory.PlayerImportData[]
		): Promise<playersMemory.PlayerRecord[]>;
	};
	tournaments: {
		listTournaments(eventId: string): Promise<tournamentsMemory.TournamentRecord[]>;
		createTournament(
			eventId: string,
			data: tournamentsMemory.TournamentData
		): Promise<tournamentsMemory.TournamentRecord>;
		ensureTournament(tournamentId: string): Promise<tournamentsMemory.TournamentRecord>;
		updateTournament(
			tournamentId: string,
			data: tournamentsMemory.TournamentData
		): Promise<tournamentsMemory.TournamentRecord>;
		deleteTournament(tournamentId: string): Promise<void>;
		setTournaments(
			eventId: string,
			tournaments: tournamentsMemory.TournamentImportData[]
		): Promise<tournamentsMemory.TournamentRecord[]>;
	};
	pairs: {
		listPairs(eventId: string): Promise<pairsMemory.PairRecord[]>;
		createPair(eventId: string, data: pairsMemory.PairData): Promise<pairsMemory.PairRecord>;
		ensurePair(pairId: string): Promise<pairsMemory.PairRecord>;
		updatePair(pairId: string, data: pairsMemory.PairData): Promise<pairsMemory.PairRecord>;
		deletePair(pairId: string): Promise<void>;
		setPairs(eventId: string, pairs: pairsMemory.PairImportData[]): Promise<pairsMemory.PairRecord[]>;
	};
	teams: {
		listTeams(eventId: string): Promise<teamsMemory.TeamRecord[]>;
		createTeam(eventId: string, data: teamsMemory.TeamData): Promise<teamsMemory.TeamRecord>;
		ensureTeam(eventId: string, teamId: string): Promise<teamsMemory.TeamRecord>;
		updateTeam(
			eventId: string,
			teamId: string,
			data: teamsMemory.TeamData
		): Promise<teamsMemory.TeamRecord>;
		deleteTeam(eventId: string, teamId: string): Promise<void>;
		setTeams(eventId: string, teams: teamsMemory.TeamImportData[]): Promise<teamsMemory.TeamRecord[]>;
		addTeamMember(teamId: string, playerId: string): Promise<void>;
		listTeamMemberIds(teamId: string): Promise<string[]>;
	};
	teamBattles: {
		listTeamBattles(eventId: string): Promise<teamBattlesMemory.TeamBattleRecord[]>;
		createTeamBattle(
			eventId: string,
			data: teamBattlesMemory.TeamBattleData
		): Promise<teamBattlesMemory.TeamBattleRecord>;
		ensureTeamBattle(
			eventId: string,
			battleId: string
		): Promise<teamBattlesMemory.TeamBattleRecord>;
		updateTeamBattle(
			eventId: string,
			battleId: string,
			data: teamBattlesMemory.TeamBattleData
		): Promise<teamBattlesMemory.TeamBattleRecord>;
		deleteTeamBattle(eventId: string, battleId: string): Promise<void>;
		setTeamBattles(
			eventId: string,
			battles: teamBattlesMemory.TeamBattleImportData[]
		): Promise<teamBattlesMemory.TeamBattleRecord[]>;
	};
	bracketMatches: {
		listBracketMatches(tournamentId: string): Promise<bracketMatchesMemory.BracketMatchRecord[]>;
		createBracketMatch(
			tournamentId: string,
			data: bracketMatchesMemory.BracketMatchImportData
		): Promise<bracketMatchesMemory.BracketMatchRecord>;
		ensureBracketMatch(
			tournamentId: string,
			matchId: string
		): Promise<bracketMatchesMemory.BracketMatchRecord>;
		updateBracketMatch(
			tournamentId: string,
			matchId: string,
			data: bracketMatchesMemory.BracketMatchUpdateData
		): Promise<bracketMatchesMemory.BracketMatchRecord>;
		setBracketMatches(
			tournamentId: string,
			matches: bracketMatchesMemory.BracketMatchImportData[]
		): Promise<bracketMatchesMemory.BracketMatchRecord[]>;
		deleteBracketMatches(tournamentId: string): Promise<void>;
	};
	ffaGroups: {
		listFfaGroups(tournamentId: string): Promise<ffaGroupsMemory.FfaGroupRecord[]>;
		createFfaGroup(
			tournamentId: string,
			data: ffaGroupsMemory.FfaGroupImportData
		): Promise<ffaGroupsMemory.FfaGroupRecord>;
		ensureFfaGroup(
			tournamentId: string,
			groupId: string
		): Promise<ffaGroupsMemory.FfaGroupRecord>;
		updateFfaGroup(
			tournamentId: string,
			groupId: string,
			data: ffaGroupsMemory.FfaGroupUpdateData
		): Promise<ffaGroupsMemory.FfaGroupRecord>;
		setFfaGroups(
			tournamentId: string,
			groups: ffaGroupsMemory.FfaGroupImportData[]
		): Promise<ffaGroupsMemory.FfaGroupRecord[]>;
		clearFfaGroups(tournamentId: string): Promise<void>;
	};
	teamBattleSlots: {
		listTeamBattleSlots(battleId: string): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord[]>;
		listTeamBattleSlotsByTeam(
			battleId: string,
			teamId: string
		): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord[]>;
		createTeamBattleSlot(
			data: teamBattleSlotsMemory.TeamBattleSlotData
		): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord>;
		ensureTeamBattleSlot(
			battleId: string,
			slotId: string
		): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord>;
		updateTeamBattleSlot(
			battleId: string,
			slotId: string,
			data: teamBattleSlotsMemory.TeamBattleSlotData
		): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord>;
		deleteTeamBattleSlot(battleId: string, slotId: string): Promise<void>;
		deleteTeamBattleSlotsByBattle(battleId: string): Promise<void>;
		setTeamBattleSlots(
			battleId: string,
			slots: teamBattleSlotsMemory.TeamBattleSlotImportData[]
		): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord[]>;
		listSlotsByBattle(battleId: string): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord[]>;
		createSlot(
			data: teamBattleSlotsMemory.TeamBattleSlotData
		): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord>;
		ensureSlot(slotId: string): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord>;
		updateSlot(
			slotId: string,
			data: teamBattleSlotsMemory.TeamBattleSlotData
		): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord>;
		deleteSlot(slotId: string): Promise<void>;
		deleteSlotsByBattle(battleId: string): Promise<void>;
		setSlots(
			slots: teamBattleSlotsMemory.TeamBattleSlotImportData[]
		): Promise<teamBattleSlotsMemory.TeamBattleSlotRecord[]>;
	};
	matches: {
		listMatches(
			contextType?: string,
			contextId?: string
		): Promise<matchesMemory.MatchRecord[]>;
		createMatch(data: matchesMemory.MatchData): Promise<matchesMemory.MatchRecord>;
		ensureMatch(matchId: string): Promise<matchesMemory.MatchRecord>;
		updateMatch(
			matchId: string,
			data: matchesMemory.MatchData
		): Promise<matchesMemory.MatchRecord>;
		deleteMatch(matchId: string): Promise<void>;
		setMatches(matches: matchesMemory.MatchImportData[]): Promise<matchesMemory.MatchRecord[]>;
	};
	playerStats: {
		listPlayerStats(
			scope?: string,
			scopeId?: string
		): Promise<playerStatsMemory.PlayerStatsRecord[]>;
		getPlayerStats(
			playerId: string,
			scope: string,
			scopeId?: string
		): Promise<playerStatsMemory.PlayerStatsRecord | null>;
		createPlayerStats(
			data: playerStatsMemory.PlayerStatsData
		): Promise<playerStatsMemory.PlayerStatsRecord>;
		ensurePlayerStats(statsId: string): Promise<playerStatsMemory.PlayerStatsRecord>;
		updatePlayerStats(
			statsId: string,
			data: playerStatsMemory.PlayerStatsData
		): Promise<playerStatsMemory.PlayerStatsRecord>;
		incrementPlayerStats(
			playerId: string,
			scope: string,
			scopeId: string | undefined,
			won: boolean
		): Promise<playerStatsMemory.PlayerStatsRecord>;
		deletePlayerStats(statsId: string): Promise<void>;
		setPlayerStats(
			stats: playerStatsMemory.PlayerStatsImportData[]
		): Promise<playerStatsMemory.PlayerStatsRecord[]>;
	};
	tournamentParticipants: {
		listParticipants(tournamentId: string): Promise<tournamentParticipantsMemory.TournamentParticipantRecord[]>;
		count(tournamentId: string): Promise<number>;
		addPair(
			tournamentId: string,
			pairId: string,
			opts?: { seed?: number | null; note?: string | null }
		): Promise<tournamentParticipantsMemory.TournamentParticipantRecord>;
		addSolo(
			tournamentId: string,
			playerId: string,
			opts?: { note?: string | null }
		): Promise<tournamentParticipantsMemory.TournamentParticipantRecord>;
		removeById(tournamentId: string, participantId: string): Promise<void>;
		removeAll(tournamentId: string): Promise<void>;
		setSeed(
			tournamentId: string,
			participantId: string,
			seed: number | null
		): Promise<tournamentParticipantsMemory.TournamentParticipantRecord>;
		setNote(
			tournamentId: string,
			participantId: string,
			note: string | null
		): Promise<tournamentParticipantsMemory.TournamentParticipantRecord>;
		ensureParticipant(
			tournamentId: string,
			participantId: string
		): Promise<tournamentParticipantsMemory.TournamentParticipantRecord>;
	};
}

export type DatabaseOptions = {
	useMemory?: boolean;
};

const wrapMemoryEvents = () => ({
	async listEvents() {
		return eventsMemory.listEvents();
	},
	async createEvent(data: eventsMemory.EventData) {
		return eventsMemory.createEvent(data);
	},
	async ensureEvent(eventId: string) {
		return eventsMemory.ensureEvent(eventId);
	},
	async updateEvent(eventId: string, data: eventsMemory.EventData) {
		return eventsMemory.updateEvent(eventId, data);
	},
	async deleteEvent(eventId: string) {
		return eventsMemory.deleteEvent(eventId);
	},
	async findEventBySlug(slug: string) {
		return Promise.resolve(eventsMemory.findEventBySlug(slug));
	},
});

const wrapMemoryPlayers = () => ({
	async listPlayers(eventId: string) {
		return playersMemory.listPlayers(eventId);
	},
	async createPlayer(eventId: string, data: playersMemory.PlayerData) {
		return playersMemory.createPlayer(eventId, data);
	},
	async ensurePlayer(playerId: string) {
		return playersMemory.getPlayerById(playerId);
	},
	async updatePlayer(playerId: string, data: playersMemory.PlayerData) {
		return playersMemory.updatePlayerById(playerId, data);
	},
	async deletePlayer(playerId: string) {
		return playersMemory.deletePlayerById(playerId);
	},
	async setPlayers(eventId: string, players: playersMemory.PlayerImportData[]) {
		return playersMemory.setPlayers(eventId, players);
	},
});

const wrapMemoryTournaments = () => ({
	async listTournaments(eventId: string) {
		return tournamentsMemory.listTournaments(eventId);
	},
	async createTournament(eventId: string, data: tournamentsMemory.TournamentData) {
		return tournamentsMemory.createTournament(eventId, data);
	},
	async ensureTournament(tournamentId: string) {
		return tournamentsMemory.getTournamentById(tournamentId);
	},
	async updateTournament(tournamentId: string, data: tournamentsMemory.TournamentData) {
		return tournamentsMemory.updateTournamentById(tournamentId, data);
	},
	async deleteTournament(tournamentId: string) {
		return tournamentsMemory.deleteTournamentById(tournamentId);
	},
	async setTournaments(eventId: string, tournaments: tournamentsMemory.TournamentImportData[]) {
		return tournamentsMemory.setTournaments(eventId, tournaments);
	},
});

const wrapMemoryPairs = () => ({
	async listPairs(eventId: string) {
		return pairsMemory.listPairs(eventId);
	},
	async createPair(eventId: string, data: pairsMemory.PairData) {
		return pairsMemory.createPair(eventId, data);
	},
	async ensurePair(pairId: string) {
		return pairsMemory.getPairById(pairId);
	},
	async updatePair(pairId: string, data: pairsMemory.PairData) {
		return pairsMemory.updatePairById(pairId, data);
	},
	async deletePair(pairId: string) {
		return pairsMemory.deletePairById(pairId);
	},
	async setPairs(eventId: string, pairs: pairsMemory.PairImportData[]) {
		return pairsMemory.setPairs(eventId, pairs);
	},
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
	},
	async addTeamMember(teamId: string, playerId: string) {
		return Promise.resolve(teamsMemory.addTeamMember(teamId, playerId));
	},
	async listTeamMemberIds(teamId: string) {
		return Promise.resolve(teamsMemory.listTeamMemberIds(teamId));
	},
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
	},
});

const wrapMemoryBracketMatches = () => ({
	async listBracketMatches(tournamentId: string) {
		return bracketMatchesMemory.listBracketMatches(tournamentId);
	},
	async createBracketMatch(
		tournamentId: string,
		data: bracketMatchesMemory.BracketMatchImportData,
	) {
		return bracketMatchesMemory.createBracketMatch(tournamentId, data);
	},
	async ensureBracketMatch(tournamentId: string, matchId: string) {
		return bracketMatchesMemory.ensureBracketMatch(tournamentId, matchId);
	},
	async updateBracketMatch(
		tournamentId: string,
		matchId: string,
		data: bracketMatchesMemory.BracketMatchUpdateData,
	) {
		return bracketMatchesMemory.updateBracketMatch(tournamentId, matchId, data);
	},
	async setBracketMatches(
		tournamentId: string,
		matches: bracketMatchesMemory.BracketMatchImportData[],
	) {
		return bracketMatchesMemory.setBracketMatches(tournamentId, matches);
	},
	async deleteBracketMatches(tournamentId: string) {
		return bracketMatchesMemory.deleteBracketMatches(tournamentId);
	},
});

const wrapMemoryFfaGroups = () => ({
	async listFfaGroups(tournamentId: string) {
		return ffaGroupsMemory.listFfaGroups(tournamentId);
	},
	async createFfaGroup(
		tournamentId: string,
		data: ffaGroupsMemory.FfaGroupImportData,
	) {
		return ffaGroupsMemory.createFfaGroup(tournamentId, data);
	},
	async ensureFfaGroup(tournamentId: string, groupId: string) {
		return ffaGroupsMemory.ensureFfaGroup(tournamentId, groupId);
	},
	async updateFfaGroup(
		tournamentId: string,
		groupId: string,
		data: ffaGroupsMemory.FfaGroupUpdateData,
	) {
		return ffaGroupsMemory.updateFfaGroup(tournamentId, groupId, data);
	},
	async setFfaGroups(
		tournamentId: string,
		groups: ffaGroupsMemory.FfaGroupImportData[],
	) {
		return ffaGroupsMemory.setFfaGroups(tournamentId, groups);
	},
	async clearFfaGroups(tournamentId: string) {
		return ffaGroupsMemory.clearFfaGroups(tournamentId);
	},
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
	async updateTeamBattleSlot(
		battleId: string,
		slotId: string,
		data: teamBattleSlotsMemory.TeamBattleSlotData,
	) {
		return teamBattleSlotsMemory.updateTeamBattleSlot(battleId, slotId, data);
	},
	async deleteTeamBattleSlot(battleId: string, slotId: string) {
		return teamBattleSlotsMemory.deleteTeamBattleSlot(battleId, slotId);
	},
	async deleteTeamBattleSlotsByBattle(battleId: string) {
		return teamBattleSlotsMemory.deleteTeamBattleSlotsByBattle(battleId);
	},
	async setTeamBattleSlots(
		battleId: string,
		slots: teamBattleSlotsMemory.TeamBattleSlotImportData[],
	) {
		return teamBattleSlotsMemory.setTeamBattleSlots(battleId, slots);
	},
	async listSlotsByBattle(battleId: string) {
		return teamBattleSlotsMemory.listSlotsByBattle(battleId);
	},
	async createSlot(data: teamBattleSlotsMemory.TeamBattleSlotData) {
		return teamBattleSlotsMemory.createSlot(data);
	},
	async ensureSlot(slotId: string) {
		return teamBattleSlotsMemory.ensureSlot(slotId);
	},
	async updateSlot(slotId: string, data: teamBattleSlotsMemory.TeamBattleSlotData) {
		return teamBattleSlotsMemory.updateSlot(slotId, data);
	},
	async deleteSlot(slotId: string) {
		return teamBattleSlotsMemory.deleteSlot(slotId);
	},
	async deleteSlotsByBattle(battleId: string) {
		return teamBattleSlotsMemory.deleteSlotsByBattle(battleId);
	},
	async setSlots(slots: teamBattleSlotsMemory.TeamBattleSlotImportData[]) {
		return teamBattleSlotsMemory.setSlots(slots);
	},
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
	},
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
	async incrementPlayerStats(
		playerId: string,
		scope: string,
		scopeId: string | undefined,
		won: boolean,
	) {
		return playerStatsMemory.incrementPlayerStats(playerId, scope, scopeId, won);
	},
	async deletePlayerStats(statsId: string) {
		return playerStatsMemory.deletePlayerStats(statsId);
	},
	async setPlayerStats(stats: playerStatsMemory.PlayerStatsImportData[]) {
		return playerStatsMemory.setPlayerStats(stats);
	},
});

const wrapMemoryTournamentParticipants = () => ({
	async listParticipants(tournamentId: string) {
		return tournamentParticipantsMemory.listParticipants(tournamentId);
	},
	async count(tournamentId: string) {
		return tournamentParticipantsMemory.count(tournamentId);
	},
	async addPair(tournamentId: string, pairId: string, opts?: { seed?: number | null; note?: string | null }) {
		return tournamentParticipantsMemory.addPair(tournamentId, pairId, opts);
	},
	async addSolo(tournamentId: string, playerId: string, opts?: { note?: string | null }) {
		return tournamentParticipantsMemory.addSolo(tournamentId, playerId, opts);
	},
	async removeById(tournamentId: string, participantId: string) {
		return tournamentParticipantsMemory.removeById(tournamentId, participantId);
	},
	async removeAll(tournamentId: string) {
		return tournamentParticipantsMemory.removeAll(tournamentId);
	},
	async setSeed(tournamentId: string, participantId: string, seed: number | null) {
		return tournamentParticipantsMemory.setSeed(tournamentId, participantId, seed);
	},
	async setNote(tournamentId: string, participantId: string, note: string | null) {
		return tournamentParticipantsMemory.setNote(tournamentId, participantId, note);
	},
	async ensureParticipant(tournamentId: string, participantId: string) {
		return tournamentParticipantsMemory.ensureParticipant(tournamentId, participantId);
	},
});

const createMemoryDatabase = (): DatabaseContext => ({
	events: wrapMemoryEvents(),
	players: wrapMemoryPlayers(),
	tournaments: wrapMemoryTournaments(),
	pairs: wrapMemoryPairs(),
	teams: wrapMemoryTeams(),
	teamBattles: wrapMemoryTeamBattles(),
	bracketMatches: wrapMemoryBracketMatches(),
	ffaGroups: wrapMemoryFfaGroups(),
	teamBattleSlots: wrapMemoryTeamBattleSlots(),
	matches: wrapMemoryMatches(),
	playerStats: wrapMemoryPlayerStats(),
	tournamentParticipants: wrapMemoryTournamentParticipants(),
});

const createD1Database = (db: D1Database): DatabaseContext => ({
	events: createEventsRepositoryD1(db),
	players: createPlayersRepositoryD1(db),
	tournaments: createTournamentsRepositoryD1(db),
	pairs: createPairsRepositoryD1(db),
	teams: {
		...createTeamsRepositoryD1(db),
	},
	teamBattles: createTeamBattlesRepositoryD1(db),
	bracketMatches: createBracketMatchesRepositoryD1(db),
	ffaGroups: createFfaGroupsRepositoryD1(db),
	teamBattleSlots: createTeamBattleSlotsRepositoryD1(db),
	matches: createMatchesRepositoryD1(db),
	playerStats: createPlayerStatsRepositoryD1(db),
	tournamentParticipants: createTournamentParticipantsRepositoryD1(db),
});

export function getDatabase(context: AppLoadContext, options: DatabaseOptions = {}): DatabaseContext {
	const envPreference = context.cloudflare?.env?.USE_MEMORY_STORE;
	const shouldUseMemory =
		typeof options.useMemory === "boolean" ? options.useMemory : envPreference === "true";

	const stage = getStage(context);
	const db = context.db;
	const hasDB = !!db && typeof db.prepare === "function";

	// 本番環境では強制的にD1データベースを使用
	if (process.env.NODE_ENV === 'production' && shouldUseMemory) {
		console.warn("[database] Production environment detected but USE_MEMORY_STORE is true. This may cause data loss!");
	}

	// 明示的にメモリストアを使用する場合、または開発環境でD1が利用できない場合
	if (shouldUseMemory || (process.env.NODE_ENV === 'development' && !hasDB)) {
		logDb("db.selected", stage, {
			driver: "memory",
			fallback: false,
			hasDB,
			useMemory: true,
		});
		return createMemoryDatabase();
	}

	// D1データベースが利用できない場合
	if (!db || typeof db.prepare !== "function") {
		const fallback = stage !== 'production';
		
		logDb("db.selected", stage, {
			driver: "memory",
			fallback,
			hasDB: false,
			useMemory: true,
		});

		console.error("[database] D1 binding unavailable; falling back to in-memory repositories", {
			dbExists: !!db,
			dbType: typeof db,
			hasPrepare: db && typeof db.prepare === "function",
			contextKeys: Object.keys(context),
			cloudflareEnv: context.cloudflare?.env ? Object.keys(context.cloudflare.env) : "undefined",
			stage,
		});
		
		// 本番環境ではメモリストアへのフォールバックを避ける
		if (stage === 'production') {
			throw new Error("D1 database is not available in production environment");
		}
		
		return createMemoryDatabase();
	}

	// D1データベースを使用
	logDb("db.selected", stage, {
		driver: "d1",
		fallback: false,
		hasDB: true,
		useMemory: false,
	});

	return createD1Database(db);
}

export function resetRepositoriesForTests() {
	eventsMemory.__resetForTests?.();
	playersMemory.__resetForTests?.();
	tournamentsMemory.__resetForTests?.();
	pairsMemory.__resetForTests?.();
	teamsMemory.__resetForTests?.();
	teamBattlesMemory.__resetForTests?.();
	bracketMatchesMemory.__resetForTests?.();
	ffaGroupsMemory.__resetForTests?.();
	teamBattleSlotsMemory.__resetForTests?.();
	matchesMemory.__resetForTests?.();
	playerStatsMemory.__resetForTests?.();
	tournamentParticipantsMemory.__resetForTests?.();
}
