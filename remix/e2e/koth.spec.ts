import { test, expect } from "@playwright/test";

test.describe("KOTH (King of the Hill) Team Battle", () => {
	let eventId: string;
	let battleId: string;
	let teamAId: string;
	let teamBId: string;

	test.beforeEach(async ({ page }) => {
		// テストデータをシード（develop環境では/test-utils/seedが利用できない可能性があるため、スキップ可能）
		const response = await page.request.post("/test-utils/seed", {
			form: {
				_intent: "seedKoth",
			},
		});

		// develop環境では403エラーの可能性があるため、エラーをそのままスローしてテストを失敗させる
		// （新しいテストファイルを使用することを推奨）
		if (!response.ok()) {
			throw new Error(`/test-utils/seed returned ${response.status()}. This test requires local development environment or should use new test files.`);
		}

		const data = await response.json();
		if (!data.success) {
			throw new Error("Failed to seed test data");
		}

		eventId = data.eventId;
		battleId = data.battleId;
		teamAId = data.teamAId;
		teamBId = data.teamBId;
	});

	test("should create KOTH battle and verify tiebreak is disabled", async ({ page }) => {
		await page.goto(`/admin/events/${eventId}/team-battles`);

		// 形式を「勝ち抜き戦」に選択
		const formatSelect = page.getByTestId("format-select");
		await formatSelect.selectOption("koth");

		// タイブレーク選択が無効化されていることを確認
		const tiebreakSelect = page.getByTestId("tiebreak-select");
		await expect(tiebreakSelect).toBeDisabled();

		// チームを選択
		const teamASelect = page.locator('select[name="team_a_id"]');
		const teamBSelect = page.locator('select[name="team_b_id"]');
		await teamASelect.selectOption({ index: 1 }); // 最初のチーム
		await teamBSelect.selectOption({ index: 2 }); // 2番目のチーム

		// 団体戦を作成
		await page.getByTestId("create-battle-button").click();

		// 作成成功メッセージを確認
		await expect(page.getByText(/団体戦「.*」を作成しました/)).toBeVisible();
	});

	test("should display KOTH battle progress page correctly", async ({ page }) => {
		// 既存のKOTHバトルに遷移
		await page.goto(`/admin/events/${eventId}/team-battles/${battleId}`);
		
		// ページ読み込みを待つ
		await page.waitForLoadState("networkidle");

		// ページタイトルを確認
		await expect(page.getByRole("heading", { name: "団体戦進行管理" })).toBeVisible();

		// 団体戦情報カードを確認
		const battleInfoCard = page.getByTestId("battle-info-card");
		await expect(battleInfoCard).toBeVisible();

		// 形式が「勝ち抜き戦」であることを確認
		await expect(battleInfoCard.getByText("勝ち抜き戦")).toBeVisible();

		// スコア表示が敗戦数であることを確認
		const scoreDisplay = page.getByTestId("koth-score-display");
		await expect(scoreDisplay).toBeVisible();
		await expect(scoreDisplay.getByText("敗戦数")).toBeVisible();

		// 次の対戦カードが表示されることを確認
		const nextMatchCard = page.getByTestId("koth-next-match-card");
		await expect(nextMatchCard).toBeVisible();
		await expect(nextMatchCard.getByRole("heading", { name: "次の対戦カード" })).toBeVisible();
	});

	test("should record first match and update next match card", async ({ page }) => {
		await page.goto(`/admin/events/${eventId}/team-battles/${battleId}`);

		// スコア入力
		await page.getByTestId("koth-score-a").fill("3");
		await page.getByTestId("koth-score-b").fill("1");

		// 勝者を選択（チームA）
		await page.getByTestId("koth-winner-select").selectOption(teamAId);

		// 結果を記録
		await page.getByTestId("koth-record-result-button").click();

		// 成功メッセージを確認
		await expect(page.getByText(/試合1の結果を記録しました/)).toBeVisible();

		// 試合履歴に追加されていることを確認
		const matchHistory = page.getByTestId("koth-match-history");
		await expect(matchHistory).toBeVisible();
		await expect(matchHistory.getByTestId("koth-match-1")).toBeVisible();

		// スコア表示が更新されていることを確認（チームB: 1敗）
		const scoreDisplay = page.getByTestId("koth-score-display");
		await expect(scoreDisplay.getByText("1")).toBeVisible(); // チームBの敗戦数
	});

	test("should track winner continuation and loser replacement correctly", async ({ page }) => {
		await page.goto(`/admin/events/${eventId}/team-battles/${battleId}`);

		// 試合1: チームA勝利
		await page.getByTestId("koth-score-a").fill("3");
		await page.getByTestId("koth-score-b").fill("1");
		await page.getByTestId("koth-winner-select").selectOption(teamAId);
		await page.getByTestId("koth-record-result-button").click();
		await expect(page.getByText(/試合1の結果を記録しました/)).toBeVisible();

		// 試合2: チームB勝利（チームA続投、チームB交代）
		await page.getByTestId("koth-score-a").fill("2");
		await page.getByTestId("koth-score-b").fill("3");
		await page.getByTestId("koth-winner-select").selectOption(teamBId);
		await page.getByTestId("koth-record-result-button").click();
		await expect(page.getByText(/試合2の結果を記録しました/)).toBeVisible();

		// 試合履歴に2試合が表示されていることを確認
		const matchHistory = page.getByTestId("koth-match-history");
		await expect(matchHistory.getByTestId("koth-match-1")).toBeVisible();
		await expect(matchHistory.getByTestId("koth-match-2")).toBeVisible();

		// スコア表示を確認（チームA: 1敗、チームB: 1敗）
		const scoreDisplay = page.getByTestId("koth-score-display");
		await expect(scoreDisplay).toBeVisible();
	});

	test("should automatically finish battle when team reaches max losses", async ({ page }) => {
		await page.goto(`/admin/events/${eventId}/team-battles/${battleId}`);

		// チームBが3敗に達するまで試合を記録
		// 試合1: チームA勝利（B敗）
		await page.getByTestId("koth-score-a").fill("3");
		await page.getByTestId("koth-score-b").fill("1");
		await page.getByTestId("koth-winner-select").selectOption(teamAId);
		await page.getByTestId("koth-record-result-button").click();
		await page.waitForTimeout(500);

		// 試合2: チームA勝利（B敗）
		await page.getByTestId("koth-score-a").fill("3");
		await page.getByTestId("koth-score-b").fill("1");
		await page.getByTestId("koth-winner-select").selectOption(teamAId);
		await page.getByTestId("koth-record-result-button").click();
		await page.waitForTimeout(500);

		// 試合3: チームA勝利（B敗、3敗到達）
		await page.getByTestId("koth-score-a").fill("3");
		await page.getByTestId("koth-score-b").fill("1");
		await page.getByTestId("koth-winner-select").selectOption(teamAId);
		await page.getByTestId("koth-record-result-button").click();

		// 団体戦終了メッセージを確認
		await expect(page.getByText(/団体戦終了/)).toBeVisible();

		// ステータスが「完了」になることを確認
		await expect(page.getByTestId("battle-finished")).toBeVisible();
		await expect(page.getByText("完了")).toBeVisible();

		// 次の対戦カードが「試合終了」になることを確認
		const nextMatchCard = page.getByTestId("koth-next-match-card");
		await expect(nextMatchCard.getByRole("heading", { name: "試合終了" })).toBeVisible();

		// 試合結果入力フォームが表示されないことを確認
		await expect(page.getByTestId("koth-score-a")).not.toBeVisible();
	});

	test("should delete last match and restore previous state", async ({ page }) => {
		await page.goto(`/admin/events/${eventId}/team-battles/${battleId}`);

		// 試合1を記録
		await page.getByTestId("koth-score-a").fill("3");
		await page.getByTestId("koth-score-b").fill("1");
		await page.getByTestId("koth-winner-select").selectOption(teamAId);
		await page.getByTestId("koth-record-result-button").click();
		await page.waitForTimeout(500);

		// 試合2を記録
		await page.getByTestId("koth-score-a").fill("2");
		await page.getByTestId("koth-score-b").fill("3");
		await page.getByTestId("koth-winner-select").selectOption(teamBId);
		await page.getByTestId("koth-record-result-button").click();
		await page.waitForTimeout(500);

		// 最後の試合に削除ボタンが表示されることを確認
		const deleteButton = page.getByTestId("koth-delete-last-match-button");
		await expect(deleteButton).toBeVisible();

		// 削除を実行
		await deleteButton.click();

		// 成功メッセージを確認
		await expect(page.getByText(/最後の試合結果を削除しました/)).toBeVisible();

		// 試合履歴から最後の試合が削除されていることを確認
		const matchHistory = page.getByTestId("koth-match-history");
		await expect(matchHistory.getByTestId("koth-match-1")).toBeVisible();
		await expect(matchHistory.getByTestId("koth-match-2")).not.toBeVisible();
	});

	test("should handle lineup not set error", async ({ page }) => {
		// ラインナップ未設定のバトルを作成するため、新しいバトルを作成
		await page.goto(`/admin/events/${eventId}/team-battles`);

		// 形式をKOTHに設定
		await page.getByTestId("format-select").selectOption("koth");

		// チームを選択
		const teamASelect = page.locator('select[name="team_a_id"]');
		const teamBSelect = page.locator('select[name="team_b_id"]');
		await teamASelect.selectOption({ index: 1 });
		await teamBSelect.selectOption({ index: 2 });

		// 団体戦を作成
		await page.getByTestId("create-battle-button").click();
		await page.waitForTimeout(1000);

		// 進行管理ページに遷移（ラインナップ未設定）
		const battleLink = page.locator('a[href*="/team-battles/"]').first();
		await battleLink.click();
		await page.waitForLoadState("networkidle");

		// ラインナップ未設定メッセージが表示されることを確認
		await expect(
			page.getByText(/ラインナップが未設定です|現在の出場枠のラインナップが未設定です/)
		).toBeVisible();
	});
});

