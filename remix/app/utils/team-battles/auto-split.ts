import type { DatabaseContext } from "~/repositories/database.server";
import type { TeamRecord } from "~/repositories/teams";

/**
 * Fisher–Yates シャッフルアルゴリズムで配列をシャッフルする
 */
function shuffleArray<T>(array: T[], rng: () => number = Math.random): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

/**
 * プレイヤーを2つのチームにランダム均等に分割する
 */
export async function autoSplitPlayersIntoTeams(
	db: DatabaseContext,
	eventId: string,
	options?: {
		teamAName?: string;
		teamBName?: string;
		playerIds?: string[];
		rng?: () => number;
	}
): Promise<{
	teamA: TeamRecord;
	teamB: TeamRecord;
	teamAPlayerIds: string[];
	teamBPlayerIds: string[];
}> {
	const teamAName = options?.teamAName ?? "チームA";
	const teamBName = options?.teamBName ?? "チームB";
	const rng = options?.rng ?? Math.random;

	// プレイヤーを取得
	let playerIds: string[];
	if (options?.playerIds) {
		playerIds = options.playerIds;
	} else {
		const players = await db.players.listPlayers(eventId);
		playerIds = players.map((p) => p.id);
	}

	// プレイヤー数が2未満の場合はエラー
	if (playerIds.length < 2) {
		throw new Error("チーム分けには少なくとも2名のプレイヤーが必要です。");
	}

	// Fisher–Yatesでシャッフル
	const shuffled = shuffleArray(playerIds, rng);

	// 交互に2つのチームに配分
	const teamAPlayerIds: string[] = [];
	const teamBPlayerIds: string[] = [];

	for (let i = 0; i < shuffled.length; i++) {
		if (i % 2 === 0) {
			teamAPlayerIds.push(shuffled[i]);
		} else {
			teamBPlayerIds.push(shuffled[i]);
		}
	}

	// チームを作成
	const teamA = await db.teams.createTeam(eventId, { name: teamAName });
	const teamB = await db.teams.createTeam(eventId, { name: teamBName });

	// プレイヤーをチームに追加
	for (const playerId of teamAPlayerIds) {
		await db.teams.addTeamMember(teamA.id, playerId);
	}
	for (const playerId of teamBPlayerIds) {
		await db.teams.addTeamMember(teamB.id, playerId);
	}

	return {
		teamA,
		teamB,
		teamAPlayerIds,
		teamBPlayerIds,
	};
}

