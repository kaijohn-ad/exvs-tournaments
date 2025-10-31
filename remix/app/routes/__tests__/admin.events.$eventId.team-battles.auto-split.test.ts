import { describe, expect, test, vi, beforeEach } from "vitest";
import type { AppLoadContext } from "@remix-run/cloudflare";
import { action } from "../admin.events.$eventId.team-battles";

const createContext = (): AppLoadContext =>
	({
		cloudflare: {
			env: {
				DB: undefined,
			},
		},
	}) as unknown as AppLoadContext;

const mockDatabase = {
	players: {
		listPlayers: vi.fn(),
	},
	teams: {
		createTeam: vi.fn(),
		addTeamMember: vi.fn(),
	},
	teamBattles: {
		listTeamBattles: vi.fn(),
		createTeamBattle: vi.fn(),
	},
};

vi.mock("~/repositories/database.server", () => ({
	getDatabase: () => mockDatabase,
}));

vi.mock("~/utils/team-battles/auto-split", () => ({
	autoSplitPlayersIntoTeams: vi.fn(),
}));

import { autoSplitPlayersIntoTeams } from "~/utils/team-battles/auto-split";

describe("admin.events.$eventId.team-battles action - autoSplit", () => {
	const eventId = "event-1";

	beforeEach(() => {
		vi.clearAllMocks();
		mockDatabase.teamBattles.listTeamBattles.mockResolvedValue([]);
	});

	test("autoSplitが成功し、チームのみ作成", async () => {
		const mockResult = {
			teamA: { id: "team-a", name: "チームA" },
			teamB: { id: "team-b", name: "チームB" },
			teamAPlayerIds: ["player-1", "player-2"],
			teamBPlayerIds: ["player-3", "player-4"],
		};

		vi.mocked(autoSplitPlayersIntoTeams).mockResolvedValue(mockResult);

		const formData = new FormData();
		formData.append("_intent", "autoSplit");
		formData.append("team_a_name", "チームA");
		formData.append("team_b_name", "チームB");

		const request = new Request("http://localhost", {
			method: "POST",
			body: formData,
		});

		const response = await action({
			request,
			params: { eventId },
			context: createContext(),
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.type).toBe("success");
		expect(data.source).toBe("autoSplit");
		expect(data.message).toContain("チーム「チームA」(2名)");
		expect(data.message).toContain("チーム「チームB」(2名)");
		expect(data.message).not.toContain("団体戦");
		expect(autoSplitPlayersIntoTeams).toHaveBeenCalledWith(mockDatabase, eventId, {
			teamAName: "チームA",
			teamBName: "チームB",
		});
		expect(mockDatabase.teamBattles.createTeamBattle).not.toHaveBeenCalled();
	});

	test("autoSplitが成功し、団体戦も同時作成", async () => {
		const mockResult = {
			teamA: { id: "team-a", name: "チームA" },
			teamB: { id: "team-b", name: "チームB" },
			teamAPlayerIds: ["player-1", "player-2"],
			teamBPlayerIds: ["player-3"],
		};

		const mockBattle = {
			id: "battle-1",
			event_id: eventId,
			team_a_id: "team-a",
			team_b_id: "team-b",
			slots_count: 3,
			format: "koth",
			allow_double_appearance_per_team: true,
			tiebreak: "off",
			status: "pending",
			result: null,
		};

		vi.mocked(autoSplitPlayersIntoTeams).mockResolvedValue(mockResult);
		mockDatabase.teamBattles.createTeamBattle.mockResolvedValue(mockBattle);

		const formData = new FormData();
		formData.append("_intent", "autoSplit");
		formData.append("team_a_name", "チームA");
		formData.append("team_b_name", "チームB");
		formData.append("create_battle", "on");
		formData.append("slots_count", "3");

		const request = new Request("http://localhost", {
			method: "POST",
			body: formData,
		});

		const response = await action({
			request,
			params: { eventId },
			context: createContext(),
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.type).toBe("success");
		expect(data.source).toBe("autoSplit");
		expect(data.message).toContain("団体戦（勝ち抜き戦）も作成しました");
		expect(mockDatabase.teamBattles.createTeamBattle).toHaveBeenCalledWith(eventId, {
			team_a_id: "team-a",
			team_b_id: "team-b",
			slots_count: 3,
			format: "koth",
			tiebreak: "off",
		});
	});

	test("autoSplitでスロット数が無効な場合、エラーを返す", async () => {
		const mockResult = {
			teamA: { id: "team-a", name: "チームA" },
			teamB: { id: "team-b", name: "チームB" },
			teamAPlayerIds: ["player-1"],
			teamBPlayerIds: ["player-2"],
		};

		vi.mocked(autoSplitPlayersIntoTeams).mockResolvedValue(mockResult);

		const formData = new FormData();
		formData.append("_intent", "autoSplit");
		formData.append("team_a_name", "チームA");
		formData.append("team_b_name", "チームB");
		formData.append("create_battle", "on");
		formData.append("slots_count", "10"); // 無効な値

		const request = new Request("http://localhost", {
			method: "POST",
			body: formData,
		});

		const response = await action({
			request,
			params: { eventId },
			context: createContext(),
		});

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.type).toBe("error");
		expect(data.source).toBe("autoSplit");
		expect(data.message).toContain("スロット数は1〜5の範囲");
		expect(mockDatabase.teamBattles.createTeamBattle).not.toHaveBeenCalled();
	});

	test("autoSplitでプレイヤー不足の場合、エラーを返す", async () => {
		vi.mocked(autoSplitPlayersIntoTeams).mockRejectedValue(
			new Error("チーム分けには少なくとも2名のプレイヤーが必要です。")
		);

		const formData = new FormData();
		formData.append("_intent", "autoSplit");
		formData.append("team_a_name", "チームA");
		formData.append("team_b_name", "チームB");

		const request = new Request("http://localhost", {
			method: "POST",
			body: formData,
		});

		const response = await action({
			request,
			params: { eventId },
			context: createContext(),
		});

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.type).toBe("error");
		expect(data.source).toBe("autoSplit");
		expect(data.message).toContain("チーム分けには少なくとも2名のプレイヤーが必要です");
	});

	test("デフォルトのチーム名を使用", async () => {
		const mockResult = {
			teamA: { id: "team-a", name: "チームA" },
			teamB: { id: "team-b", name: "チームB" },
			teamAPlayerIds: ["player-1"],
			teamBPlayerIds: ["player-2"],
		};

		vi.mocked(autoSplitPlayersIntoTeams).mockResolvedValue(mockResult);

		const formData = new FormData();
		formData.append("_intent", "autoSplit");
		// チーム名を指定しない

		const request = new Request("http://localhost", {
			method: "POST",
			body: formData,
		});

		const response = await action({
			request,
			params: { eventId },
			context: createContext(),
		});

		expect(response.status).toBe(200);
		expect(autoSplitPlayersIntoTeams).toHaveBeenCalledWith(mockDatabase, eventId, {
			teamAName: "チームA",
			teamBName: "チームB",
		});
	});
});

