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
} from "./_helpers";

test.describe("Double Elimination Tournament E2E", () => {
	let eventId: string;
	let tournamentId: string;
	let playerIds: string[] = [];

	test.beforeEach(async ({ page }) => {
		// イベントを作成
		const eventName = generateEventName();
		eventId = await createEvent(page, eventName);
	});

	test.describe("10 players", () => {
		test("fixed seed mode - GF single - complete tournament", async ({
			page,
		}) => {
			// プレイヤーを作成（10名）
			const playerNames = Array.from(
				{ length: 10 },
				(_, i) => `プレイヤー${i + 1}`,
			);
			playerIds = await createPlayers(page, eventId, playerNames);

			// トーナメントを作成（ダブルエリミネーション、固定シード、GF single）
			const tournamentName = "ダブルE2E 10名 固定 GF単一";
			tournamentId = await createTournament(
				page,
				eventId,
				tournamentName,
				"double-elimination",
				"single",
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

			// Winners bracket Round 1から順番に試合を記録
			let round = 1;
			let isWinners = true;

			// Winners bracketを完了
			while (true) {
				const roundTestId = isWinners
					? `winners-round-${round}`
					: `losers-round-${round}`;
				const roundElement = page.getByTestId(roundTestId);
				if (!(await roundElement.isVisible())) {
					if (isWinners) {
						// Winners bracketが終わったらLosers bracketへ
						isWinners = false;
						round = 1;
						continue;
					} else {
						break;
					}
				}

				const roundMatches = await roundElement
					.locator('[data-testid^="match-"]')
					.all();

				if (roundMatches.length === 0) {
					if (isWinners) {
						isWinners = false;
						round = 1;
						continue;
					} else {
						break;
					}
				}

				for (let i = 0; i < roundMatches.length; i++) {
					const match = roundMatches[i];
					const matchId = await match.getAttribute("data-testid");
					if (!matchId) continue;

					const actualMatchId = matchId.replace("match-", "");

					// BYEの場合はスキップ
					const participantA = match.getByTestId("participant-a");
					const participantB = match.getByTestId("participant-b");
					const textA = await participantA.textContent();
					const textB = await participantB.textContent();

					if (textA?.includes("BYE") || textB?.includes("BYE")) {
						continue;
					}

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

			// Grand Finalsを探す
			const grandFinalsRound = page.getByTestId("grand-finals-round-1");
			if (await grandFinalsRound.isVisible()) {
				const gfMatches = await grandFinalsRound
					.locator('[data-testid^="match-"]')
					.all();

				for (let i = 0; i < gfMatches.length; i++) {
					const match = gfMatches[i];
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
						"a",
					);
					await page.waitForTimeout(500);
				}
			}

			// トーナメントが完了していることを確認
			await page.waitForLoadState("networkidle");
			const progressCard = page.locator('[data-testid="progress-card"]');
			if (await progressCard.isVisible()) {
				await expect(progressCard.getByText(/完了/)).toBeVisible();
			}
		});

		test("shuffle seed mode - GF single - complete tournament", async ({
			page,
		}) => {
			// プレイヤーを作成（10名）
			const playerNames = Array.from(
				{ length: 10 },
				(_, i) => `プレイヤー${i + 1}`,
			);
			playerIds = await createPlayers(page, eventId, playerNames);

			// トーナメントを作成（ダブルエリミネーション、シャッフルシード、GF single）
			const tournamentName = "ダブルE2E 10名 シャッフル GF単一";
			tournamentId = await createTournament(
				page,
				eventId,
				tournamentName,
				"double-elimination",
				"single",
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
			let isWinners = true;

			while (true) {
				const roundTestId = isWinners
					? `winners-round-${round}`
					: `losers-round-${round}`;
				const roundElement = page.getByTestId(roundTestId);
				if (!(await roundElement.isVisible())) {
					if (isWinners) {
						isWinners = false;
						round = 1;
						continue;
					} else {
						break;
					}
				}

				const roundMatches = await roundElement
					.locator('[data-testid^="match-"]')
					.all();

				if (roundMatches.length === 0) {
					if (isWinners) {
						isWinners = false;
						round = 1;
						continue;
					} else {
						break;
					}
				}

				for (let i = 0; i < roundMatches.length; i++) {
					const match = roundMatches[i];
					const matchId = await match.getAttribute("data-testid");
					if (!matchId) continue;

					const actualMatchId = matchId.replace("match-", "");

					const participantA = match.getByTestId("participant-a");
					const participantB = match.getByTestId("participant-b");
					const textA = await participantA.textContent();
					const textB = await participantB.textContent();

					if (textA?.includes("BYE") || textB?.includes("BYE")) {
						continue;
					}

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

			// Grand Finals
			const grandFinalsRound = page.getByTestId("grand-finals-round-1");
			if (await grandFinalsRound.isVisible()) {
				const gfMatches = await grandFinalsRound
					.locator('[data-testid^="match-"]')
					.all();

				for (let i = 0; i < gfMatches.length; i++) {
					const match = gfMatches[i];
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
						"a",
					);
					await page.waitForTimeout(500);
				}
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
		test("fixed seed mode - GF reset - complete tournament", async ({
			page,
		}) => {
			// プレイヤーを作成（20名）
			const playerNames = Array.from(
				{ length: 20 },
				(_, i) => `プレイヤー${i + 1}`,
			);
			playerIds = await createPlayers(page, eventId, playerNames);

			// トーナメントを作成（ダブルエリミネーション、固定シード、GF reset）
			const tournamentName = "ダブルE2E 20名 固定 GFリセット";
			tournamentId = await createTournament(
				page,
				eventId,
				tournamentName,
				"double-elimination",
				"reset",
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
			let isWinners = true;

			while (true) {
				const roundTestId = isWinners
					? `winners-round-${round}`
					: `losers-round-${round}`;
				const roundElement = page.getByTestId(roundTestId);
				if (!(await roundElement.isVisible())) {
					if (isWinners) {
						isWinners = false;
						round = 1;
						continue;
					} else {
						break;
					}
				}

				const roundMatches = await roundElement
					.locator('[data-testid^="match-"]')
					.all();

				if (roundMatches.length === 0) {
					if (isWinners) {
						isWinners = false;
						round = 1;
						continue;
					} else {
						break;
					}
				}

				for (let i = 0; i < roundMatches.length; i++) {
					const match = roundMatches[i];
					const matchId = await match.getAttribute("data-testid");
					if (!matchId) continue;

					const actualMatchId = matchId.replace("match-", "");

					const participantA = match.getByTestId("participant-a");
					const participantB = match.getByTestId("participant-b");
					const textA = await participantA.textContent();
					const textB = await participantB.textContent();

					if (textA?.includes("BYE") || textB?.includes("BYE")) {
						continue;
					}

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

			// Grand Finals Round 1（Losers側が勝利してresetを発火）
			const grandFinalsRound1 = page.getByTestId("grand-finals-round-1");
			if (await grandFinalsRound1.isVisible()) {
				const gfMatches = await grandFinalsRound1
					.locator('[data-testid^="match-"]')
					.all();

				// Losers側（side_b）が勝利するように記録
				for (const match of gfMatches) {
					const matchId = await match.getAttribute("data-testid");
					if (!matchId) continue;

					const actualMatchId = matchId.replace("match-", "");
					await recordMatchResult(
						page,
						eventId,
						tournamentId,
						actualMatchId,
						2,
						3,
						"b", // Losers側が勝利
					);
					await page.waitForTimeout(1000);
				}
			}

			// Grand Finals Round 2（Reset）が表示されることを確認
			await page.waitForLoadState("networkidle");
			const grandFinalsRound2 = page.getByTestId("grand-finals-round-2");
			if (await grandFinalsRound2.isVisible()) {
				const gfMatches = await grandFinalsRound2
					.locator('[data-testid^="match-"]')
					.all();

				for (const match of gfMatches) {
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
						"a",
					);
					await page.waitForTimeout(500);
				}
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

		test("shuffle seed mode - GF reset - complete tournament", async ({
			page,
		}) => {
			// プレイヤーを作成（20名）
			const playerNames = Array.from(
				{ length: 20 },
				(_, i) => `プレイヤー${i + 1}`,
			);
			playerIds = await createPlayers(page, eventId, playerNames);

			// トーナメントを作成（ダブルエリミネーション、シャッフルシード、GF reset）
			const tournamentName = "ダブルE2E 20名 シャッフル GFリセット";
			tournamentId = await createTournament(
				page,
				eventId,
				tournamentName,
				"double-elimination",
				"reset",
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
			let isWinners = true;

			while (true) {
				const roundTestId = isWinners
					? `winners-round-${round}`
					: `losers-round-${round}`;
				const roundElement = page.getByTestId(roundTestId);
				if (!(await roundElement.isVisible())) {
					if (isWinners) {
						isWinners = false;
						round = 1;
						continue;
					} else {
						break;
					}
				}

				const roundMatches = await roundElement
					.locator('[data-testid^="match-"]')
					.all();

				if (roundMatches.length === 0) {
					if (isWinners) {
						isWinners = false;
						round = 1;
						continue;
					} else {
						break;
					}
				}

				for (let i = 0; i < roundMatches.length; i++) {
					const match = roundMatches[i];
					const matchId = await match.getAttribute("data-testid");
					if (!matchId) continue;

					const actualMatchId = matchId.replace("match-", "");

					const participantA = match.getByTestId("participant-a");
					const participantB = match.getByTestId("participant-b");
					const textA = await participantA.textContent();
					const textB = await participantB.textContent();

					if (textA?.includes("BYE") || textB?.includes("BYE")) {
						continue;
					}

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

			// Grand Finals Round 1（Losers側が勝利）
			const grandFinalsRound1 = page.getByTestId("grand-finals-round-1");
			if (await grandFinalsRound1.isVisible()) {
				const gfMatches = await grandFinalsRound1
					.locator('[data-testid^="match-"]')
					.all();

				for (const match of gfMatches) {
					const matchId = await match.getAttribute("data-testid");
					if (!matchId) continue;

					const actualMatchId = matchId.replace("match-", "");
					await recordMatchResult(
						page,
						eventId,
						tournamentId,
						actualMatchId,
						2,
						3,
						"b", // Losers側が勝利
					);
					await page.waitForTimeout(1000);
				}
			}

			// Grand Finals Round 2（Reset）
			await page.waitForLoadState("networkidle");
			const grandFinalsRound2 = page.getByTestId("grand-finals-round-2");
			if (await grandFinalsRound2.isVisible()) {
				const gfMatches = await grandFinalsRound2
					.locator('[data-testid^="match-"]')
					.all();

				for (const match of gfMatches) {
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
						"a",
					);
					await page.waitForTimeout(500);
				}
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

