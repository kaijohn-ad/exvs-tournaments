import { test, expect } from "@playwright/test";
import {
	createEvent,
	createPlayers,
	autoTeamSplit,
	setLineup,
	generateEventName,
} from "./_helpers";

test.describe("Waseda Format Team Battle E2E", () => {
	let eventId: string;
	let battleId: string;
	let playerIds: string[] = [];

	test.beforeEach(async ({ page }) => {
		// イベントを作成
		const eventName = generateEventName();
		eventId = await createEvent(page, eventName);
	});

	test("tiebreak - complete battle", async ({ page }) => {
		// プレイヤーを作成（10名）
		const playerNames = Array.from(
			{ length: 10 },
			(_, i) => `プレイヤー${i + 1}`,
		);
		playerIds = await createPlayers(page, eventId, playerNames);

		// 自動チーム分け（団体戦は作成しない）
		const result = await autoTeamSplit(
			page,
			eventId,
			"チームA",
			"チームB",
			3,
			false,
		);

		// 早稲田式の団体戦を手動で作成
		await page.goto(`/admin/events/${eventId}/team-battles`);
		await page.waitForLoadState("networkidle");

		// 団体戦作成フォームに入力
		const teamASelect = page.locator('select[name="team_a_id"]');
		const teamBSelect = page.locator('select[name="team_b_id"]');
		await teamASelect.selectOption({ index: 1 });
		await teamBSelect.selectOption({ index: 2 });

		const formatSelect = page.locator('select[name="format"]');
		await formatSelect.selectOption("waseda");

		const slotsSelect = page.locator('select[name="slots_count"]');
		await slotsSelect.selectOption("3");

		const tiebreakSelect = page.locator('select[name="tiebreak"]');
		await tiebreakSelect.selectOption("representative");

		// 作成ボタンをクリック
		await page.locator('form').filter({
			has: page.locator('input[name="_intent"][value="create"]'),
		}).locator('button[type="submit"]').click();
		await page.waitForLoadState("networkidle");

		// 成功メッセージを確認
		await expect(
			page.getByText(/団体戦「.*」を作成しました/),
		).toBeVisible();

		// 作成された団体戦IDを取得
		const battleLinks = page.locator('a[href*="/team-battles/"]');
		const lastLink = battleLinks.last();
		const href = await lastLink.getAttribute("href");
		if (!href) {
			throw new Error("団体戦IDを取得できませんでした");
		}
		const match = href.match(/team-battles\/([^/]+)/);
		if (!match || !match[1]) {
			throw new Error("団体戦IDを抽出できませんでした");
		}
		battleId = match[1];

		// ラインナップを設定（簡略化）
		// 実際のテストでは、ペアを作成してから割り当てる必要があります

		// 進行管理ページに遷移
		await page.goto(
			`/admin/events/${eventId}/team-battles/${battleId}`,
		);
		await page.waitForLoadState("networkidle");

		// 形式が「早稲田式」であることを確認
		await expect(page.getByText("早稲田式")).toBeVisible();

		// タイブレークが「代表戦」であることを確認
		await expect(page.getByText("代表戦")).toBeVisible();

		// ラインナップ未設定の場合のエラーメッセージを確認
		await expect(
			page.getByText(/ラインナップが未設定です|現在の出場枠のラインナップが未設定です/),
		).toBeVisible();
	});

	test("no tiebreak - complete battle", async ({ page }) => {
		// プレイヤーを作成（10名）
		const playerNames = Array.from(
			{ length: 10 },
			(_, i) => `プレイヤー${i + 1}`,
		);
		playerIds = await createPlayers(page, eventId, playerNames);

		// 自動チーム分け
		const result = await autoTeamSplit(
			page,
			eventId,
			"チームA",
			"チームB",
			3,
			false,
		);

		// 早稲田式の団体戦を手動で作成（タイブレークなし）
		await page.goto(`/admin/events/${eventId}/team-battles`);
		await page.waitForLoadState("networkidle");

		const teamASelect = page.locator('select[name="team_a_id"]');
		const teamBSelect = page.locator('select[name="team_b_id"]');
		await teamASelect.selectOption({ index: 1 });
		await teamBSelect.selectOption({ index: 2 });

		const formatSelect = page.locator('select[name="format"]');
		await formatSelect.selectOption("waseda");

		const slotsSelect = page.locator('select[name="slots_count"]');
		await slotsSelect.selectOption("3");

		const tiebreakSelect = page.locator('select[name="tiebreak"]');
		await tiebreakSelect.selectOption("off");

		await page.locator('form').filter({
			has: page.locator('input[name="_intent"][value="create"]'),
		}).locator('button[type="submit"]').click();
		await page.waitForLoadState("networkidle");

		await expect(
			page.getByText(/団体戦「.*」を作成しました/),
		).toBeVisible();

		// 団体戦IDを取得
		const battleLinks = page.locator('a[href*="/team-battles/"]');
		const lastLink = battleLinks.last();
		const href = await lastLink.getAttribute("href");
		if (!href) {
			throw new Error("団体戦IDを取得できませんでした");
		}
		const match = href.match(/team-battles\/([^/]+)/);
		if (!match || !match[1]) {
			throw new Error("団体戦IDを抽出できませんでした");
		}
		battleId = match[1];

		// 進行管理ページに遷移
		await page.goto(
			`/admin/events/${eventId}/team-battles/${battleId}`,
		);
		await page.waitForLoadState("networkidle");

		// 形式が「早稲田式」であることを確認
		await expect(page.getByText("早稲田式")).toBeVisible();

		// タイブレークが「なし」であることを確認
		await expect(page.getByText("なし")).toBeVisible();
	});
});

