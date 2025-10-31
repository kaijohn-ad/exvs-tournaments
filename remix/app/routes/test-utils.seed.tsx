import { json, type ActionFunctionArgs } from "@remix-run/cloudflare";
import { getDatabase } from "~/repositories/database.server";
import { getStage } from "~/utils/runtime.server";
import { generateUUID } from "~/utils/uuid";

/**
 * 開発環境専用のテストデータシードAPI
 * 本番環境では403を返す
 */
export async function action({ request, context }: ActionFunctionArgs) {
	const stage = getStage(context);
	
	// 本番環境では拒否
	if (stage === "production") {
		return json({ error: "This endpoint is not available in production" }, { status: 403 });
	}

	const db = getDatabase(context);
	const formData = await request.formData();
	const intent = formData.get("_intent");

	if (intent === "seedKoth") {
		// KOTHテスト用データを作成
		const eventId = generateUUID();
		const teamAId = generateUUID();
		const teamBId = generateUUID();

		// イベント作成
		await db.events.createEvent({
			id: eventId,
			name: "KOTH E2E Test Event",
			slug: `koth-e2e-${Date.now()}`,
		});

		// プレイヤー作成（8名）
		const playerIds: string[] = [];
		for (let i = 1; i <= 8; i++) {
			const player = await db.players.createPlayer(eventId, {
				name: `プレイヤー${i}`,
				note: null,
			});
			playerIds.push(player.id);
		}

		// ペア作成（4組）
		const pairIds: string[] = [];
		for (let i = 0; i < 4; i++) {
			const pair = await db.pairs.createPair(eventId, {
				player1_id: playerIds[i * 2],
				player2_id: playerIds[i * 2 + 1],
				seed: null,
			});
			pairIds.push(pair.id);
		}

		// チーム作成（2チーム）
		const teamA = await db.teams.createTeam(eventId, { name: "チームA" });
		const teamB = await db.teams.createTeam(eventId, { name: "チームB" });

		// 団体戦作成（KOTH形式、3スロット）
		const battle = await db.teamBattles.createTeamBattle(eventId, {
			team_a_id: teamA.id,
			team_b_id: teamB.id,
			slots_count: 3,
			format: "koth",
			allow_double_appearance_per_team: true,
			tiebreak: "off",
			status: "pending",
		});

		// ラインナップ設定（各チームのスロット0〜2にペアを割り当て）
		// チームA: ペア0, ペア1, ペア2
		for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
			await db.teamBattleSlots.createSlot({
				team_battle_id: battle.id,
				team_id: teamA.id,
				slot_index: slotIndex,
				assignment_type: "pair",
				pair_id: pairIds[slotIndex],
			});
		}

		// チームB: ペア3, ペア0, ペア1（重複使用あり）
		for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
			const pairIndex = slotIndex === 0 ? 3 : slotIndex === 1 ? 0 : 1;
			await db.teamBattleSlots.createSlot({
				team_battle_id: battle.id,
				team_id: teamB.id,
				slot_index: slotIndex,
				assignment_type: "pair",
				pair_id: pairIds[pairIndex],
			});
		}

		return json({
			success: true,
			eventId,
			battleId: battle.id,
			teamAId: teamA.id,
			teamBId: teamB.id,
			pairIds,
			playerIds,
		});
	}

	if (intent === "reset") {
		// 全データをリセット（メモリストアの場合）
		// D1の場合は何もしない（本番データを壊さないため）
		if (stage === "development") {
			// メモリストアの場合はリセット可能
			const { resetRepositoriesForTests } = await import("~/repositories/database.server");
			resetRepositoriesForTests();
			return json({ success: true, message: "Repositories reset (memory store only)" });
		}
		return json({ error: "Reset is only available for memory store in development" }, { status: 400 });
	}

	return json({ error: "Invalid intent" }, { status: 400 });
}

// GETリクエストは許可しない
export async function loader() {
	return json({ error: "Method not allowed" }, { status: 405 });
}

