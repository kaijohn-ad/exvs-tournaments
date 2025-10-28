import { getDatabase } from '$lib/server/db';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { BracketMatchUpdateData } from '$lib/server/repositories/bracket-matches';

export const load: PageServerLoad = async (event) => {
	const { eventId, tournamentId } = event.params;

	event.depends(`tournament-bracket:${eventId}:${tournamentId}`);

	const db = getDatabase(event);

	let tournament;
	try {
		tournament = await db.tournaments.ensureTournament(eventId, tournamentId);
	} catch (thrown) {
		console.error('[tournament-bracket:load] tournament not found', {
			eventId,
			tournamentId,
			error: thrown instanceof Error ? thrown.message : thrown
		});
		throw error(404, '指定したトーナメントが見つかりません。');
	}

	const [pairs, players, bracketMatches] = await Promise.all([
		db.pairs.listPairs(eventId),
		db.players.listPlayers(eventId),
		db.bracketMatches.listBracketMatches(tournamentId)
	]);

	return {
		eventId,
		tournamentId,
		tournament,
		pairs,
		players,
		bracketMatches
	};
};

const parseScore = (value: FormDataEntryValue | null, label: string): number => {
	if (value == null) {
		throw new Error(`${label}を入力してください`);
	}

	const parsed = Number(value.toString().trim());

	if (!Number.isFinite(parsed)) {
		throw new Error(`${label}は数値で入力してください`);
	}

	if (parsed < 0) {
		throw new Error(`${label}は0以上で入力してください`);
	}

	return Math.trunc(parsed);
};

const collectPairPlayers = (pair: { player1_id: string; player2_id: string }) => {
	return [pair.player1_id, pair.player2_id].filter((id): id is string => Boolean(id));
};

export const actions: Actions = {
	record: async (event) => {
		const { eventId, tournamentId } = event.params;
		const formData = await event.request.formData();
		const matchId = formData.get('matchId')?.toString();
		const winnerSide = formData.get('winnerSide')?.toString();

		if (!matchId) {
			return fail(400, { error: '試合IDが取得できませんでした。' });
		}

		if (winnerSide !== 'a' && winnerSide !== 'b') {
			return fail(400, { error: '勝者のサイドを選択してください。', matchId });
		}

		let scoreA: number;
		let scoreB: number;

		try {
			scoreA = parseScore(formData.get('scoreA'), 'サイドAのスコア');
			scoreB = parseScore(formData.get('scoreB'), 'サイドBのスコア');
		} catch (thrown) {
			return fail(400, {
				error: thrown instanceof Error ? thrown.message : 'スコアの解析に失敗しました。',
				matchId
			});
		}

		if (winnerSide === 'a' && scoreA <= scoreB) {
			return fail(400, {
				error: 'サイドAを勝者とする場合、サイドAのスコアがサイドBより高い必要があります。',
				matchId
			});
		}

		if (winnerSide === 'b' && scoreB <= scoreA) {
			return fail(400, {
				error: 'サイドBを勝者とする場合、サイドBのスコアがサイドAより高い必要があります。',
				matchId
			});
		}

		const db = getDatabase(event);

		let match;
		try {
			match = await db.bracketMatches.ensureBracketMatch(tournamentId, matchId);
		} catch (thrown) {
			console.error('[tournament-bracket:record] match not found', {
				eventId,
				tournamentId,
				matchId,
				error: thrown instanceof Error ? thrown.message : thrown
			});
			return fail(404, { error: '指定した試合が見つかりません。', matchId });
		}

		if (
			match.participant_a_type !== 'pair' ||
			match.participant_b_type !== 'pair' ||
			!match.participant_a_pair_id ||
			!match.participant_b_pair_id
		) {
			return fail(400, {
				error: '両サイドのペアが確定してから結果を入力してください。',
				matchId
			});
		}

		const existingLogs = await db.matches.listMatches('bracket', matchId);
		if (existingLogs.length > 0) {
			return fail(409, {
				error: 'この試合は既に記録されています。ログを削除してから再入力してください。',
				matchId
			});
		}

		const winnerPairId =
			winnerSide === 'a' ? match.participant_a_pair_id : match.participant_b_pair_id;
		const loserPairId =
			winnerSide === 'a' ? match.participant_b_pair_id : match.participant_a_pair_id;

		let pairA;
		let pairB;

		try {
			pairA = await db.pairs.ensurePair(eventId, match.participant_a_pair_id);
			pairB = await db.pairs.ensurePair(eventId, match.participant_b_pair_id);
		} catch (thrown) {
			console.error('[tournament-bracket:record] pair lookup failed', {
				eventId,
				tournamentId,
				matchId,
				error: thrown instanceof Error ? thrown.message : thrown
			});
			return fail(400, { error: '参加ペアの情報取得に失敗しました。', matchId });
		}

		await db.bracketMatches.updateBracketMatch(tournamentId, matchId, {
			score_a: scoreA,
			score_b: scoreB,
			status: 'completed',
			winner_side: winnerSide
		});

		const allMatches = await db.bracketMatches.listBracketMatches(tournamentId);
		const nextRound = match.round + 1;
		const nextPosition = Math.ceil(match.position / 2);
		const nextMatch = allMatches.find(
			(candidate) => candidate.round === nextRound && candidate.position === nextPosition
		);

		if (nextMatch) {
			const targetSide = match.position % 2 === 1 ? 'a' : 'b';
			const currentTargetPairId =
				targetSide === 'a' ? nextMatch.participant_a_pair_id : nextMatch.participant_b_pair_id;
			const needsParticipantUpdate = currentTargetPairId !== winnerPairId;
			const needsReset =
				nextMatch.status !== 'pending' ||
				nextMatch.winner_side !== null ||
				nextMatch.score_a !== null ||
				nextMatch.score_b !== null;

			if (needsParticipantUpdate || needsReset) {
				const updatePayload: BracketMatchUpdateData = {};

				if (targetSide === 'a' && needsParticipantUpdate) {
					updatePayload.participant_a_type = 'pair';
					updatePayload.participant_a_pair_id = winnerPairId;
				} else if (targetSide === 'b' && needsParticipantUpdate) {
					updatePayload.participant_b_type = 'pair';
					updatePayload.participant_b_pair_id = winnerPairId;
				}

				if (needsReset) {
					updatePayload.status = 'pending';
					updatePayload.winner_side = null;
					updatePayload.score_a = null;
					updatePayload.score_b = null;
				}

				await db.bracketMatches.updateBracketMatch(tournamentId, nextMatch.id, updatePayload);
			}
		}

		await db.matches.createMatch({
			context: 'bracket',
			context_id: matchId,
			side_a_type: 'pair',
			side_a_pair_id: pairA.id,
			side_a_player1_id: pairA.player1_id,
			side_a_player2_id: pairA.player2_id,
			side_b_type: 'pair',
			side_b_pair_id: pairB.id,
			side_b_player1_id: pairB.player1_id,
			side_b_player2_id: pairB.player2_id,
			score_a: scoreA,
			score_b: scoreB,
			winner_side: winnerSide
		});

		const winnerPlayers = collectPairPlayers(winnerSide === 'a' ? pairA : pairB);
		const loserPlayers = collectPairPlayers(winnerSide === 'a' ? pairB : pairA);

		for (const playerId of winnerPlayers) {
			await db.playerStats.incrementPlayerStats(playerId, 'tournament', tournamentId, true);
		}

		for (const playerId of loserPlayers) {
			await db.playerStats.incrementPlayerStats(playerId, 'tournament', tournamentId, false);
		}

		return {
			success: true,
			message: '試合結果を記録しました。',
			matchId,
			winnerSide,
			scoreA,
			scoreB
		};
	}
};
