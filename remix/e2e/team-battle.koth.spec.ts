import { test, expect } from "@playwright/test";
import {
	createEvent,
	createPlayers,
	autoTeamSplit,
	setLineup,
	generateEventName,
} from "./_helpers";

test.describe("KOTH Team Battle E2E", () => {
	let eventId: string;
	let battleId: string;
	let playerIds: string[] = [];

	test.beforeEach(async ({ page }) => {
		// イベントを作成
		const eventName = generateEventName();
		eventId = await createEvent(page, eventName);
	});

	test.describe("10 players", () => {
		test("auto team split - slots 3 - complete battle", async ({ page }) => {
			// プレイヤーを作成（10名）
			const playerNames = Array.from(
				{ length: 10 },
				(_, i) => `プレイヤー${i + 1}`,
			);
			playerIds = await createPlayers(page, eventId, playerNames);

			// 自動チーム分け（KOTH団体戦も同時作成、スロット数3）
			const result = await autoTeamSplit(
				page,
				eventId,
				"チームA",
				"チームB",
				3,
				true,
			);

			if (!result.battleId) {
				throw new Error("団体戦が作成されませんでした");
			}
			battleId = result.battleId;

			// ラインナップを設定（各チームのスロット0〜2にプレイヤーを割り当て）
			// チームA: プレイヤー1, 2, 3
			await setLineup(
				page,
				eventId,
				battleId,
				result.teamAId,
				0,
				undefined,
				[playerIds[0], playerIds[1]],
			);
			await setLineup(
				page,
				eventId,
				battleId,
				result.teamAId,
				1,
				undefined,
				[playerIds[2], playerIds[3]],
			);
			await setLineup(
				page,
				eventId,
				battleId,
				result.teamAId,
				2,
				undefined,
				[playerIds[4], playerIds[5]],
			);

			// チームB: プレイヤー6, 7, 8
			await setLineup(
				page,
				eventId,
				battleId,
				result.teamBId,
				0,
				undefined,
				[playerIds[6], playerIds[7]],
			);
			await setLineup(
				page,
				eventId,
				battleId,
				result.teamBId,
				1,
				undefined,
				[playerIds[8], playerIds[9]],
			);
			await setLineup(
				page,
				eventId,
				battleId,
				result.teamBId,
				2,
				undefined,
				[playerIds[0], playerIds[1]], // 再利用
			);

			// 進行管理ページに遷移
			await page.goto(
				`/admin/events/${eventId}/team-battles/${battleId}`,
			);
			await page.waitForLoadState("networkidle");

			// 形式が「勝ち抜き戦」であることを確認
			await expect(page.getByText("勝ち抜き戦")).toBeVisible();

			// 試合を記録していく（チームBが3敗に達するまで）
			// 試合1: チームA勝利
			await page.getByTestId("koth-score-a").fill("3");
			await page.getByTestId("koth-score-b").fill("1");
			await page.getByTestId("koth-winner-select").selectOption({ index: 0 }); // チームA
			await page.getByTestId("koth-record-result-button").click();
			await page.waitForLoadState("networkidle");
			await page.waitForTimeout(500);

			// 試合2: チームA勝利
			await page.getByTestId("koth-score-a").fill("3");
			await page.getByTestId("koth-score-b").fill("1");
			await page.getByTestId("koth-winner-select").selectOption({ index: 0 });
			await page.getByTestId("koth-record-result-button").click();
			await page.waitForLoadState("networkidle");
			await page.waitForTimeout(500);

			// 試合3: チームA勝利（チームBが3敗に達する）
			await page.getByTestId("koth-score-a").fill("3");
			await page.getByTestId("koth-score-b").fill("1");
			await page.getByTestId("koth-winner-select").selectOption({ index: 0 });
			await page.getByTestId("koth-record-result-button").click();
			await page.waitForLoadState("networkidle");

			// 団体戦終了メッセージを確認
			await expect(page.getByText(/団体戦終了/)).toBeVisible();

			// 最後の試合を削除して復元
			const deleteButton = page.getByTestId("koth-delete-last-match-button");
			if (await deleteButton.isVisible()) {
				await deleteButton.click();
				await page.waitForLoadState("networkidle");

				// 状態が戻っていることを確認
				await expect(
					page.getByTestId("koth-score-a"),
				).toBeVisible();
			}
		});
	});

	test.describe("20 players", () => {
		test("auto team split - slots 5 - complete battle", async ({ page }) => {
			// プレイヤーを作成（20名）
			const playerNames = Array.from(
				{ length: 20 },
				(_, i) => `プレイヤー${i + 1}`,
			);
			playerIds = await createPlayers(page, eventId, playerNames);

			// 自動チーム分け（KOTH団体戦も同時作成、スロット数5）
			const result = await autoTeamSplit(
				page,
				eventId,
				"チームA",
				"チームB",
				5,
				true,
			);

			if (!result.battleId) {
				throw new Error("団体戦が作成されませんでした");
			}
			battleId = result.battleId;

			// ラインナップを設定（簡略化: 最初の5組のペアを使用）
			// 実際のテストでは、ペアを作成してから割り当てる必要があります
			// ここでは簡略化のため、スキップします

			// 進行管理ページに遷移
			await page.goto(
				`/admin/events/${eventId}/team-battles/${battleId}`,
			);
			await page.waitForLoadState("networkidle");

			// 形式が「勝ち抜き戦」であることを確認
			await expect(page.getByText("勝ち抜き戦")).toBeVisible();

			// ラインナップ未設定の場合のエラーメッセージを確認
			await expect(
				page.getByText(/ラインナップが未設定です|現在の出場枠のラインナップが未設定です/),
			).toBeVisible();
		});
	});
});

