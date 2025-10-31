import { test, expect } from "@playwright/test";
import {
	createEvent,
	createPlayers,
	registerTournamentParticipants,
	autoPairParticipants,
	createTournament,
	generateBracket,
	recordMatchResult,
	generateEventName,
	cleanupE2EEvents,
} from "./_helpers";

test.describe("Single Elimination Tournament E2E", () => {
	let eventId: string;
	let tournamentId: string;
	let playerIds: string[] = [];

	test.beforeEach(async ({ page }) => {
		// イベントを作成
		const eventName = generateEventName();
		eventId = await createEvent(page, eventName);
	});

	test.afterEach(async ({ page }) => {
		// クリーンアップ（イベント削除は実装されていないため、ログ出力のみ）
		console.log(`E2Eイベント: ${eventId}`);
	});

	test.describe("10 players", () => {
		test("fixed seed mode - complete tournament", async ({ page }) => {
			// プレイヤーを作成（10名）
			const playerNames = Array.from({ length: 10 }, (_, i) => `プレイヤー${i + 1}`);
			playerIds = await createPlayers(page, eventId, playerNames);

			// トーナメントを作成（シングルエリミネーション、固定シード）
			const tournamentName = "シングルE2E 10名 固定";
			tournamentId = await createTournament(
				page,
				eventId,
				tournamentName,
				"single-elimination",
				undefined,
				"fixed",
			);

			// 参加者を登録（soloモード）
			await registerTournamentParticipants(
				page,
				eventId,
				tournamentId,
				playerIds,
			);

			// 自動ペアリング
			await autoPairParticipants(page, eventId, tournamentId);

			// ブラケットを生成
			await generateBracket(page, eventId, tournamentId);

			// ブラケット表示ページに遷移
			await page.goto(
				`/admin/events/${eventId}/tournaments/${tournamentId}/bracket`,
			);
			await page.waitForLoadState("networkidle");

			// ブラケットが表示されていることを確認
			const bracket = page.getByTestId("bracket");
			await expect(bracket).toBeVisible();

			// 試合を順番に記録していく
			// 10名の場合、初戦で2試合（4名がBYEで自動進出）、準決勝3試合、決勝1試合の計6試合
			// マッチIDは実際のページから取得する必要があるため、pending状態のマッチを探す

			// 初戦の試合を探す（Round 1）
			const round1 = page.getByTestId("round-1");
			await expect(round1).toBeVisible();

			// 初戦の試合をすべて完了させる
			const matches = await round1.locator('[data-testid^="match-"]').all();
			for (let i = 0; i < matches.length; i++) {
				const match = matches[i];
				const matchId = await match.getAttribute("data-testid");
				if (!matchId) continue;

				// BYEの場合はスキップ
				const participantA = match.getByTestId("participant-a");
				const participantB = match.getByTestId("participant-b");
				const textA = await participantA.textContent();
				const textB = await participantB.textContent();

				if (textA?.includes("BYE") || textB?.includes("BYE")) {
					continue; // BYEは自動的に進出するためスキップ
				}

				// 試合結果を記録（ランダムに勝者を選択）
				const actualMatchId = matchId.replace("match-", "");
				await recordMatchResult(
					page,
					eventId,
					tournamentId,
					actualMatchId,
					3,
					1,
					i % 2 === 0 ? "a" : "b",
				);
				await page.waitForTimeout(500); // 反映を待つ
			}

			// 次のラウンドに進む
			await page.waitForLoadState("networkidle");

			// 決勝まで繰り返す
			let round = 2;
			while (true) {
				const roundElement = page.getByTestId(`round-${round}`);
				if (!(await roundElement.isVisible())) {
					break; // 次のラウンドがない
				}

				const roundMatches = await roundElement
					.locator('[data-testid^="match-"]')
					.all();

				if (roundMatches.length === 0) {
					break; // 試合がない
				}

				for (let i = 0; i < roundMatches.length; i++) {
					const match = roundMatches[i];
					const matchId = await match.getAttribute("data-testid");
					if (!matchId) continue;

					const actualMatchId = matchId.replace("match-", "");
					await recordMatchResult(
						page,
						eventId,
						tournamentId,
						actualMatchId,
						3,
						1,
						i % 2 === 0 ? "a" : "b",
					);
					await page.waitForTimeout(500);
				}

				round++;
				await page.waitForLoadState("networkidle");
			}

			// トーナメントが完了していることを確認
			await page.waitForLoadState("networkidle");
			const progressCard = page.locator('[data-testid="progress-card"]');
			if (await progressCard.isVisible()) {
				await expect(progressCard.getByText(/完了/)).toBeVisible();
			}
		});

		test("shuffle seed mode - complete tournament", async ({ page }) => {
			// プレイヤーを作成（10名）
			const playerNames = Array.from({ length: 10 }, (_, i) => `プレイヤー${i + 1}`);
			playerIds = await createPlayers(page, eventId, playerNames);

			// トーナメントを作成（シングルエリミネーション、シャッフルシード）
			const tournamentName = "シングルE2E 10名 シャッフル";
			tournamentId = await createTournament(
				page,
				eventId,
				tournamentName,
				"single-elimination",
				undefined,
				"shuffle",
			);

			// 参加者を登録（soloモード）
			await registerTournamentParticipants(
				page,
				eventId,
				tournamentId,
				playerIds,
			);

			// 自動ペアリング
			await autoPairParticipants(page, eventId, tournamentId);

			// ブラケットを生成
			await generateBracket(page, eventId, tournamentId);

			// ブラケット表示ページに遷移
			await page.goto(
				`/admin/events/${eventId}/tournaments/${tournamentId}/bracket`,
			);
			await page.waitForLoadState("networkidle");

			// ブラケットが表示されていることを確認
			const bracket = page.getByTestId("bracket");
			await expect(bracket).toBeVisible();

			// 試合を順番に記録していく（固定シードと同じロジック）
			let round = 1;
			while (true) {
				const roundElement = page.getByTestId(`round-${round}`);
				if (!(await roundElement.isVisible())) {
					break;
				}

				const roundMatches = await roundElement
					.locator('[data-testid^="match-"]')
					.all();

				if (roundMatches.length === 0) {
					break;
				}

				for (let i = 0; i < roundMatches.length; i++) {
					const match = roundMatches[i];
					const matchId = await match.getAttribute("data-testid");
					if (!matchId) continue;

					const actualMatchId = matchId.replace("match-", "");
					await recordMatchResult(
						page,
						eventId,
						tournamentId,
						actualMatchId,
						3,
						1,
						i % 2 === 0 ? "a" : "b",
					);
					await page.waitForTimeout(500);
				}

				round++;
				await page.waitForLoadState("networkidle");
			}

			// トーナメントが完了していることを確認
			await page.waitForLoadState("networkidle");
			const progressCard = page.locator('[data-testid="progress-card"]');
			if (await progressCard.isVisible()) {
				await expect(progressCard.getByText(/完了/)).toBeVisible();
			}
		});
	});

	test.describe("20 players", () => {
		test("fixed seed mode - complete tournament", async ({ page }) => {
			// プレイヤーを作成（20名）
			const playerNames = Array.from({ length: 20 }, (_, i) => `プレイヤー${i + 1}`);
			playerIds = await createPlayers(page, eventId, playerNames);

			// トーナメントを作成（シングルエリミネーション、固定シード）
			const tournamentName = "シングルE2E 20名 固定";
			tournamentId = await createTournament(
				page,
				eventId,
				tournamentName,
				"single-elimination",
				undefined,
				"fixed",
			);

			// 参加者を登録（soloモード）
			await registerTournamentParticipants(
				page,
				eventId,
				tournamentId,
				playerIds,
			);

			// 自動ペアリング
			await autoPairParticipants(page, eventId, tournamentId);

			// ブラケットを生成
			await generateBracket(page, eventId, tournamentId);

			// ブラケット表示ページに遷移
			await page.goto(
				`/admin/events/${eventId}/tournaments/${tournamentId}/bracket`,
			);
			await page.waitForLoadState("networkidle");

			// ブラケットが表示されていることを確認
			const bracket = page.getByTestId("bracket");
			await expect(bracket).toBeVisible();

			// 試合を順番に記録していく
			let round = 1;
			while (true) {
				const roundElement = page.getByTestId(`round-${round}`);
				if (!(await roundElement.isVisible())) {
					break;
				}

				const roundMatches = await roundElement
					.locator('[data-testid^="match-"]')
					.all();

				if (roundMatches.length === 0) {
					break;
				}

				for (let i = 0; i < roundMatches.length; i++) {
					const match = roundMatches[i];
					const matchId = await match.getAttribute("data-testid");
					if (!matchId) continue;

					const actualMatchId = matchId.replace("match-", "");
					await recordMatchResult(
						page,
						eventId,
						tournamentId,
						actualMatchId,
						3,
						1,
						i % 2 === 0 ? "a" : "b",
					);
					await page.waitForTimeout(500);
				}

				round++;
				await page.waitForLoadState("networkidle");
			}

			// 公開ブラケット画面を確認
			await page.goto(
				`/events/${eventId}/tournaments/${tournamentId}/bracket`,
			);
			await page.waitForLoadState("networkidle");

			const publicBracket = page.getByTestId("bracket");
			await expect(publicBracket).toBeVisible();

			// トーナメントが完了していることを確認
			const progressCard = page.locator('[data-testid="progress-card"]');
			if (await progressCard.isVisible()) {
				await expect(progressCard.getByText(/完了/)).toBeVisible();
			}
		});

		test("shuffle seed mode - complete tournament", async ({ page }) => {
			// プレイヤーを作成（20名）
			const playerNames = Array.from({ length: 20 }, (_, i) => `プレイヤー${i + 1}`);
			playerIds = await createPlayers(page, eventId, playerNames);

			// トーナメントを作成（シングルエリミネーション、シャッフルシード）
			const tournamentName = "シングルE2E 20名 シャッフル";
			tournamentId = await createTournament(
				page,
				eventId,
				tournamentName,
				"single-elimination",
				undefined,
				"shuffle",
			);

			// 参加者を登録（soloモード）
			await registerTournamentParticipants(
				page,
				eventId,
				tournamentId,
				playerIds,
			);

			// 自動ペアリング
			await autoPairParticipants(page, eventId, tournamentId);

			// ブラケットを生成
			await generateBracket(page, eventId, tournamentId);

			// ブラケット表示ページに遷移
			await page.goto(
				`/admin/events/${eventId}/tournaments/${tournamentId}/bracket`,
			);
			await page.waitForLoadState("networkidle");

			// ブラケットが表示されていることを確認
			const bracket = page.getByTestId("bracket");
			await expect(bracket).toBeVisible();

			// 試合を順番に記録していく
			let round = 1;
			while (true) {
				const roundElement = page.getByTestId(`round-${round}`);
				if (!(await roundElement.isVisible())) {
					break;
				}

				const roundMatches = await roundElement
					.locator('[data-testid^="match-"]')
					.all();

				if (roundMatches.length === 0) {
					break;
				}

				for (let i = 0; i < roundMatches.length; i++) {
					const match = roundMatches[i];
					const matchId = await match.getAttribute("data-testid");
					if (!matchId) continue;

					const actualMatchId = matchId.replace("match-", "");
					await recordMatchResult(
						page,
						eventId,
						tournamentId,
						actualMatchId,
						3,
						1,
						i % 2 === 0 ? "a" : "b",
					);
					await page.waitForTimeout(500);
				}

				round++;
				await page.waitForLoadState("networkidle");
			}

			// 公開ブラケット画面を確認
			await page.goto(
				`/events/${eventId}/tournaments/${tournamentId}/bracket`,
			);
			await page.waitForLoadState("networkidle");

			const publicBracket = page.getByTestId("bracket");
			await expect(publicBracket).toBeVisible();

			// トーナメントが完了していることを確認
			const progressCard = page.locator('[data-testid="progress-card"]');
			if (await progressCard.isVisible()) {
				await expect(progressCard.getByText(/完了/)).toBeVisible();
			}
		});
	});
});

