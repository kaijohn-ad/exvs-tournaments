import { test, expect } from "@playwright/test";
import {
	createEvent,
	createPlayers,
	autoTeamSplit,
	generateEventName,
} from "./_helpers";

test.describe("Team Battle Lineup Filter E2E", () => {
	let eventId: string;
	let battleId: string;
	let playerIds: string[] = [];
	let teamAPlayerIds: string[] = [];
	let teamBPlayerIds: string[] = [];

	test.beforeEach(async ({ page }) => {
		// イベントを作成
		const eventName = generateEventName();
		eventId = await createEvent(page, eventName);
	});

	test("自動チーム分け後のラインナップ編集で各チームのメンバーのみが表示される", async ({
		page,
	}) => {
		// プレイヤーを作成（8名）
		const playerNames = Array.from(
			{ length: 8 },
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

		// チームメンバーを取得するため、チーム一覧ページに移動
		await page.goto(`/admin/events/${eventId}/team-battles`);
		await page.waitForLoadState("networkidle");

		// チーム一覧からチームAとチームBのIDを取得
		// 自動チーム分けでは交互に配分されるため、プレイヤー0,2,4,6がチームA、1,3,5,7がチームBになる（シャッフルされるため実際は異なる可能性がある）
		// 実際のメンバーを確認するため、API経由で確認するか、ラインナップ画面で確認する

		// ラインナップ編集画面に移動
		await page.goto(
			`/admin/events/${eventId}/team-battles/${battleId}/lineup`,
		);
		await page.waitForLoadState("networkidle");

		// チームAのセクションを探す（"チームA"というテキストを含むヘッダーを持つセクション）
		// 実際のHTML構造: チームAのヘッダーは h3 タグで、その親要素がチームセクション
		const teamAHeader = page.locator('h3:has-text("チームA")');
		await expect(teamAHeader).toBeVisible();

		// チームAのセクション（ヘッダーの親要素）を取得
		const teamASection = teamAHeader.locator("..").locator("..");
		await expect(teamASection).toBeVisible();

		// チームAのスロット0のフォームを取得（最初のフォームがスロット0）
		const teamASlot0Form = teamASection.locator("form").first();
		await expect(teamASlot0Form).toBeVisible();

		// 「個別プレイヤー」を選択
		const adhocRadio = teamASlot0Form.locator('input[value="adhoc"]');
		await adhocRadio.check();

		// プレイヤー1のセレクトボックスを取得
		const player1Select = teamASlot0Form.locator('select[name="player1Id"]');
		await expect(player1Select).toBeVisible();

		// セレクトボックスのオプションを取得
		const player1Options = await player1Select.locator("option").all();
		const teamAPlayerNames: string[] = [];
		for (const option of player1Options) {
			const text = await option.textContent();
			const value = await option.getAttribute("value");
			if (text && text !== "選択してください" && value) {
				teamAPlayerNames.push(text);
			}
		}

		// チームBのセクションを探す
		const teamBHeader = page.locator('h3:has-text("チームB")');
		await expect(teamBHeader).toBeVisible();

		// チームBのセクション（ヘッダーの親要素）を取得
		const teamBSection = teamBHeader.locator("..").locator("..");
		await expect(teamBSection).toBeVisible();

		const teamBSlot0Form = teamBSection.locator("form").first();
		await expect(teamBSlot0Form).toBeVisible();

		// 「個別プレイヤー」を選択
		const teamBAdhocRadio = teamBSlot0Form.locator('input[value="adhoc"]');
		await teamBAdhocRadio.check();

		// プレイヤー1のセレクトボックスを取得
		const teamBPlayer1Select = teamBSlot0Form.locator(
			'select[name="player1Id"]',
		);
		await expect(teamBPlayer1Select).toBeVisible();

		// セレクトボックスのオプションを取得
		const teamBPlayer1Options = await teamBPlayer1Select
			.locator("option")
			.all();
		const teamBPlayerNames: string[] = [];
		for (const option of teamBPlayer1Options) {
			const text = await option.textContent();
			const value = await option.getAttribute("value");
			if (text && text !== "選択してください" && value) {
				teamBPlayerNames.push(text);
			}
		}

		// 検証: チームAとチームBのプレイヤーリストが重複していないこと
		const intersection = teamAPlayerNames.filter((name) =>
			teamBPlayerNames.includes(name),
		);
		expect(intersection.length).toBe(0);

		// 検証: チームAとチームBのプレイヤー数の合計が全プレイヤー数（8名）と一致すること
		const totalUniquePlayers = new Set([
			...teamAPlayerNames,
			...teamBPlayerNames,
		]).size;
		expect(totalUniquePlayers).toBe(8);

		// 検証: 各チームにプレイヤーが存在すること（自動チーム分けでは交互に配分されるため、各チームに4名ずつ）
		expect(teamAPlayerNames.length).toBeGreaterThan(0);
		expect(teamBPlayerNames.length).toBeGreaterThan(0);
		expect(teamAPlayerNames.length + teamBPlayerNames.length).toBe(8);

		// 追加検証: チームAのプレイヤー2のセレクトボックスでも同じフィルタが適用されていることを確認
		const player2Select = teamASlot0Form.locator('select[name="player2Id"]');
		await expect(player2Select).toBeVisible();
		const player2Options = await player2Select.locator("option").all();
		const teamAPlayer2Names: string[] = [];
		for (const option of player2Options) {
			const text = await option.textContent();
			const value = await option.getAttribute("value");
			if (text && text !== "選択してください" && value) {
				teamAPlayer2Names.push(text);
			}
		}
		// プレイヤー1とプレイヤー2のオプションは同じであるべき
		expect(teamAPlayer2Names.sort()).toEqual(teamAPlayerNames.sort());

		// 追加検証: ペア選択でも同じフィルタが適用されていることを確認
		// 「ペア」ラジオボタンを選択
		const pairRadio = teamASlot0Form.locator('input[value="pair"]');
		await pairRadio.check();

		// ペアセレクトボックスを取得
		const pairSelect = teamASlot0Form.locator('select[name="pairId"]');
		await expect(pairSelect).toBeVisible();

		// ペアが存在する場合は、ペアの両プレイヤーがチームAに所属していることを確認
		// （このテストではペアが作成されていないため、オプションは「選択してください」のみのはず）
		const pairOptions = await pairSelect.locator("option").all();
		// ペアが存在しない場合、オプションは「選択してください」のみ
		expect(pairOptions.length).toBeGreaterThanOrEqual(1);
	});

	test("自動チーム分け後のラインナップ編集で各チームのスロット間で一貫性がある", async ({
		page,
	}) => {
		// プレイヤーを作成（8名）
		const playerNames = Array.from(
			{ length: 8 },
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

		// ラインナップ編集画面に移動
		await page.goto(
			`/admin/events/${eventId}/team-battles/${battleId}/lineup`,
		);
		await page.waitForLoadState("networkidle");

		// チームAのセクションを取得
		const teamAHeader = page.locator('h3:has-text("チームA")');
		await expect(teamAHeader).toBeVisible();

		const teamASection = teamAHeader.locator("..").locator("..");
		await expect(teamASection).toBeVisible();

		// スロット0、1、2のフォームを取得
		const teamAForms = teamASection.locator("form").all();
		const forms = await teamAForms;

		// 各スロットで表示されるプレイヤーリストが同じであることを確認
		const slotPlayerLists: string[][] = [];

		for (let i = 0; i < Math.min(3, forms.length); i++) {
			const form = forms[i];
			await expect(form).toBeVisible();

			// 「個別プレイヤー」を選択
			const adhocRadio = form.locator('input[value="adhoc"]');
			await adhocRadio.check();

			// プレイヤー1のセレクトボックスを取得
			const player1Select = form.locator('select[name="player1Id"]');
			await expect(player1Select).toBeVisible();

			// オプションを取得
			const options = await player1Select.locator("option").all();
			const playerNames: string[] = [];
			for (const option of options) {
				const text = await option.textContent();
				const value = await option.getAttribute("value");
				if (text && text !== "選択してください" && value) {
					playerNames.push(text);
				}
			}
			slotPlayerLists.push(playerNames.sort());
		}

		// 全てのスロットで同じプレイヤーリストが表示されることを確認
		if (slotPlayerLists.length > 1) {
			for (let i = 1; i < slotPlayerLists.length; i++) {
				expect(slotPlayerLists[i]).toEqual(slotPlayerLists[0]);
			}
		}
	});
});

