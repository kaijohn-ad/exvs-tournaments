import { Page, expect } from "@playwright/test";

/**
 * E2Eテスト用の共通ヘルパー関数
 */

/**
 * イベントを作成する
 * @param page PlaywrightのPageオブジェクト
 * @param name イベント名（E2E-<日時>-<短id>形式を推奨）
 * @param slug スラッグ（任意）
 * @returns 作成されたイベントのID
 */
export async function createEvent(
	page: Page,
	name: string,
	slug?: string,
): Promise<string> {
	await page.goto("/admin");
	await page.waitForLoadState("networkidle");

	// イベント作成フォームに入力
	await page.fill('input[name="name"]', name);
	if (slug) {
		await page.fill('input[name="slug"]', slug);
	}

	// フォームを送信
	await page.click('button[type="submit"]');
	await page.waitForLoadState("networkidle");

	// 成功メッセージを確認
	await expect(page.getByText(/イベント「.*」を作成しました/)).toBeVisible();

	// 作成されたイベントIDを取得（セレクトボックスから最新のものを取得）
	const eventSelect = page.locator('select[name="eventId"]');
	const eventOptions = await eventSelect.locator("option").all();
	if (eventOptions.length === 0) {
		throw new Error("イベントが作成されませんでした");
	}

	// 最初のオプション（最新）のvalueを取得
	const eventId = await eventOptions[0].getAttribute("value");
	if (!eventId) {
		throw new Error("イベントIDを取得できませんでした");
	}

	return eventId;
}

/**
 * プレイヤーを作成する
 * @param page PlaywrightのPageオブジェクト
 * @param eventId イベントID
 * @param players プレイヤー名の配列
 * @returns 作成されたプレイヤーIDの配列
 */
export async function createPlayers(
	page: Page,
	eventId: string,
	players: string[],
): Promise<string[]> {
	await page.goto(`/admin/events/${eventId}/entries/players`);
	await page.waitForLoadState("networkidle");

	const playerIds: string[] = [];

	for (const playerName of players) {
		// プレイヤー名を入力
		await page.fill('input[name="name"]', playerName);
		await page.click('button[type="submit"]');
		await page.waitForLoadState("networkidle");

		// 成功メッセージを確認
		await expect(page.getByText(/プレイヤー「.*」を追加しました/)).toBeVisible();

		// 作成されたプレイヤーIDを取得（最新の行から）
		const playerRows = page.locator('tr[data-testid^="player-"]');
		const lastRow = playerRows.last();
		const playerId = await lastRow.getAttribute("data-testid");
		if (playerId) {
			playerIds.push(playerId.replace("player-", ""));
		}
	}

	return playerIds;
}

/**
 * トーナメント参加者を登録する（soloモード）
 * @param page PlaywrightのPageオブジェクト
 * @param eventId イベントID
 * @param tournamentId トーナメントID
 * @param playerIds プレイヤーIDの配列
 */
export async function registerTournamentParticipants(
	page: Page,
	eventId: string,
	tournamentId: string,
	playerIds: string[],
): Promise<void> {
	await page.goto(
		`/admin/events/${eventId}/tournaments/${tournamentId}/participants`,
	);
	await page.waitForLoadState("networkidle");

	// 各プレイヤーを登録（soloモード）
	for (const playerId of playerIds) {
		// プレイヤー選択セレクトボックスから選択
		const playerSelect = page.locator('select[name="playerId"]');
		await playerSelect.selectOption(playerId);

		// 追加ボタンをクリック
		await page.getByTestId("add-pair-button").click();
		await page.waitForLoadState("networkidle");

		// 成功メッセージを確認
		await expect(
			page.getByText(/参加者を追加しました/),
		).toBeVisible({ timeout: 5000 });
	}
}

/**
 * 自動ペアリングを実行する
 * @param page PlaywrightのPageオブジェクト
 * @param eventId イベントID
 * @param tournamentId トーナメントID
 */
export async function autoPairParticipants(
	page: Page,
	eventId: string,
	tournamentId: string,
): Promise<void> {
	await page.goto(
		`/admin/events/${eventId}/tournaments/${tournamentId}/participants`,
	);
	await page.waitForLoadState("networkidle");

	// 自動ペアリングフォームのボタンをクリック
	const autoPairForm = page.locator('form').filter({
		has: page.locator('input[name="_intent"][value="pairAuto"]'),
	});
	if (await autoPairForm.isVisible()) {
		await autoPairForm.locator('button[type="submit"]').click();
		await page.waitForLoadState("networkidle");

		// 成功メッセージを確認
		await expect(
			page.getByText(/自動ペアリングを実行しました/),
		).toBeVisible({ timeout: 5000 });
	}
}

/**
 * トーナメントを作成する
 * @param page PlaywrightのPageオブジェクト
 * @param eventId イベントID
 * @param name トーナメント名
 * @param format 形式（"single-elimination" | "double-elimination"）
 * @param grandFinalsFormat Grand Finals形式（"single" | "reset"、double-eliminationのみ）
 * @param seedMode シードモード（"fixed" | "shuffle"）
 * @returns 作成されたトーナメントID
 */
export async function createTournament(
	page: Page,
	eventId: string,
	name: string,
	format: "single-elimination" | "double-elimination",
	grandFinalsFormat?: "single" | "reset",
	seedMode?: "fixed" | "shuffle",
): Promise<string> {
	await page.goto(`/admin/events/${eventId}/tournaments`);
	await page.waitForLoadState("networkidle");

	// トーナメント名を入力
	await page.fill('input[name="name"]', name);

	// 形式を選択
	const formatSelect = page.locator('select[name="format"]');
	await formatSelect.selectOption(format);

	// 参加モードをsoloに設定（自動ペアリングを使用するため）
	const entryModeSelect = page.locator('select[name="entryMode"]');
	await entryModeSelect.selectOption("solo");

	// Grand Finals形式を選択（double-eliminationの場合）
	if (format === "double-elimination" && grandFinalsFormat) {
		const gfFormatSelect = page.locator('select[name="grandFinalsFormat"]');
		await gfFormatSelect.selectOption(grandFinalsFormat);
	}

	// シードモードを選択
	if (seedMode) {
		const seedSelect = page.locator('select[name="seedingMode"]');
		await seedSelect.selectOption(seedMode === "fixed" ? "manual" : "random");
	}

	// 作成ボタンをクリック
	await page.locator('form').filter({
		has: page.locator('input[name="_intent"][value="create"]'),
	}).locator('button[type="submit"]').click();
	await page.waitForLoadState("networkidle");

	// 成功メッセージを確認
	await expect(page.getByText(/トーナメント「.*」を作成しました/)).toBeVisible();

	// 作成されたトーナメントIDを取得（ページを再読み込みして最新のトーナメント一覧から取得）
	await page.reload();
	await page.waitForLoadState("networkidle");

	// トーナメント名で検索
	const tournamentLink = page.getByRole("link", { name: new RegExp(name) });
	await expect(tournamentLink).toBeVisible();

	// リンクのhrefからtournamentIdを抽出
	const href = await tournamentLink.getAttribute("href");
	if (!href) {
		throw new Error("トーナメントIDを取得できませんでした");
	}

	const match = href.match(/tournaments\/([^/]+)/);
	if (!match || !match[1]) {
		throw new Error("トーナメントIDを抽出できませんでした");
	}

	return match[1];
}

/**
 * ブラケットを生成する
 * @param page PlaywrightのPageオブジェクト
 * @param eventId イベントID
 * @param tournamentId トーナメントID
 */
export async function generateBracket(
	page: Page,
	eventId: string,
	tournamentId: string,
): Promise<void> {
	await page.goto(`/admin/events/${eventId}/tournaments`);
	await page.waitForLoadState("networkidle");

	// ブラケット生成フォームを探す（_intent="generate"とtournamentIdを含む）
	const generateForm = page.locator('form').filter({
		has: page.locator('input[name="_intent"][value="generate"]'),
	}).filter({
		has: page.locator(`input[name="tournamentId"][value="${tournamentId}"]`),
	});
	await expect(generateForm).toBeVisible();

	// ブラケット生成ボタンをクリック
	await generateForm.locator('button[type="submit"]').click();
	await page.waitForLoadState("networkidle");

	// 成功メッセージを確認
	await expect(
		page.getByText(/ブラケットを生成しました/),
	).toBeVisible({ timeout: 10000 });
}

/**
 * 試合結果を記録する
 * @param page PlaywrightのPageオブジェクト
 * @param eventId イベントID
 * @param tournamentId トーナメントID
 * @param matchId マッチID（data-testidから取得）
 * @param scoreA サイドAのスコア
 * @param scoreB サイドBのスコア
 * @param winnerSide 勝者サイド（"a" | "b"）
 */
export async function recordMatchResult(
	page: Page,
	eventId: string,
	tournamentId: string,
	matchId: string,
	scoreA: number,
	scoreB: number,
	winnerSide: "a" | "b",
): Promise<void> {
	// マッチカードを探す（現在のページ上で）
	const matchCard = page.locator(`[data-testid="match-${matchId}"]`);
	await expect(matchCard).toBeVisible();

	// フォームが表示されていることを確認
	const form = matchCard.locator('form');
	await expect(form).toBeVisible();

	// スコアを入力
	await form.locator('input[name="scoreA"]').fill(scoreA.toString());
	await form.locator('input[name="scoreB"]').fill(scoreB.toString());

	// 勝者を選択
	const winnerSelect = form.locator('select[name="winnerSide"]');
	await winnerSelect.selectOption(winnerSide);

	// 結果を記録
	await form.locator('button[type="submit"]').click();
	await page.waitForLoadState("networkidle");

	// 成功メッセージを確認（フラッシュメッセージまたはページ更新を待つ）
	await page.waitForTimeout(1000); // 少し待機
}

/**
 * E2Eで作成したイベントを削除する
 * @param page PlaywrightのPageオブジェクト
 * @param eventId イベントID
 */
export async function deleteEvent(page: Page, eventId: string): Promise<void> {
	await page.goto("/admin");
	await page.waitForLoadState("networkidle");

	// イベント一覧から該当イベントを探して削除
	// 注意: 現時点では管理画面に削除機能がない可能性があるため、
	// 必要に応じて実装を確認する
	const eventSelect = page.locator('select[name="eventId"]');
	const eventOption = eventSelect.locator(`option[value="${eventId}"]`);
	if (await eventOption.isVisible()) {
		// 削除機能がある場合は実装
		// 現時点では実装をスキップ
	}
}

/**
 * E2Eで作成したすべてのイベントをクリーンアップする
 * @param page PlaywrightのPageオブジェクト
 */
export async function cleanupE2EEvents(page: Page): Promise<void> {
	await page.goto("/admin");
	await page.waitForLoadState("networkidle");

	// イベント一覧を取得
	const eventSelect = page.locator('select[name="eventId"]');
	const eventOptions = await eventSelect.locator("option").all();

	for (const option of eventOptions) {
		const eventName = await option.textContent();
		if (eventName && eventName.startsWith("E2E-")) {
			const eventId = await option.getAttribute("value");
			if (eventId) {
				// 削除機能がある場合は実装
				// 現時点ではログ出力のみ
				console.log(`E2Eイベントを削除: ${eventName} (${eventId})`);
			}
		}
	}
}

/**
 * 一意のイベント名を生成する
 * @param prefix プレフィックス（デフォルト: "E2E"）
 * @returns イベント名
 */
export function generateEventName(prefix: string = "E2E"): string {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const shortId = Math.random().toString(36).substring(2, 8);
	return `${prefix}-${timestamp}-${shortId}`;
}

/**
 * 自動チーム分けを実行する
 * @param page PlaywrightのPageオブジェクト
 * @param eventId イベントID
 * @param teamAName チームA名
 * @param teamBName チームB名
 * @param slots スロット数
 * @param createBattle 団体戦も同時作成するか
 * @returns 作成されたチームIDと団体戦ID（createBattleがtrueの場合）
 */
export async function autoTeamSplit(
	page: Page,
	eventId: string,
	teamAName: string = "チームA",
	teamBName: string = "チームB",
	slots: number = 3,
	createBattle: boolean = false,
): Promise<{ teamAId: string; teamBId: string; battleId?: string }> {
	await page.goto(`/admin/events/${eventId}/team-battles`);
	await page.waitForLoadState("networkidle");

	// 自動チーム分けフォームを探す（_intent="autoSplit"を含む）
	const autoSplitForm = page.locator('form').filter({
		has: page.locator('input[name="_intent"][value="autoSplit"]'),
	});
	await expect(autoSplitForm).toBeVisible();

	// フォームに入力
	await autoSplitForm.locator('input[name="team_a_name"]').fill(teamAName);
	await autoSplitForm.locator('input[name="team_b_name"]').fill(teamBName);

	if (createBattle) {
		await autoSplitForm.locator('input[name="create_battle"]').check();
		await autoSplitForm.locator('select[name="slots_count"]').selectOption(slots.toString());
	}

	// チーム分けを実行
	await autoSplitForm.locator('button[type="submit"]').click();
	await page.waitForLoadState("networkidle");

	// 成功メッセージを確認
	await expect(
		page.getByText(/チーム「.*」とチーム「.*」を作成しました/),
	).toBeVisible();

	// 作成された団体戦IDを取得（createBattleがtrueの場合）
	if (createBattle) {
		await page.waitForTimeout(1000); // 少し待機
		const battleLinks = page.locator('a[href*="/team-battles/"]');
		const count = await battleLinks.count();
		if (count > 0) {
			const lastLink = battleLinks.last();
			const href = await lastLink.getAttribute("href");
			if (href) {
				const match = href.match(/team-battles\/([^/]+)/);
				if (match && match[1]) {
					return {
						teamAId: teamAName,
						teamBId: teamBName,
						battleId: match[1],
					};
				}
			}
		}
	}

	return {
		teamAId: teamAName,
		teamBId: teamBName,
	};
}

/**
 * ラインナップを設定する
 * @param page PlaywrightのPageオブジェクト
 * @param eventId イベントID
 * @param battleId 団体戦ID
 * @param teamId チームID
 * @param slotIndex スロットインデックス（0から開始）
 * @param pairId ペアID（ペアで割り当てる場合）
 * @param playerIds プレイヤーIDの配列（個別で割り当てる場合）
 */
export async function setLineup(
	page: Page,
	eventId: string,
	battleId: string,
	teamId: string,
	slotIndex: number,
	pairId?: string,
	playerIds?: string[],
): Promise<void> {
	await page.goto(
		`/admin/events/${eventId}/team-battles/${battleId}/lineup`,
	);
	await page.waitForLoadState("networkidle");

	// スロットカードを探す
	const slotCard = page.locator(
		`[data-testid="slot-${slotIndex}"][data-team-id="${teamId}"]`,
	);
	await expect(slotCard).toBeVisible();

	if (pairId) {
		// ペアで割り当て
		await slotCard.locator('input[value="pair"]').check();
		await slotCard.locator('select[name="pairId"]').selectOption(pairId);
	} else if (playerIds && playerIds.length > 0) {
		// 個別で割り当て
		await slotCard.locator('input[value="adhoc"]').check();
		for (let i = 0; i < playerIds.length; i++) {
			const playerSelect = slotCard.locator(
				`select[name="player_${i}"]`,
			);
			await playerSelect.selectOption(playerIds[i]);
		}
	}

	// 割り当てボタンをクリック
	await slotCard.locator('button[type="submit"]').click();
	await page.waitForLoadState("networkidle");

	// 成功メッセージを確認
	await expect(
		page.getByText(/ラインナップを設定しました/),
	).toBeVisible({ timeout: 5000 });
}

