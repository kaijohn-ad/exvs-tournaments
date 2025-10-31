import { useEffect, useMemo, useState } from "react";
import {
	Form,
	Link,
	Outlet,
	useActionData,
	useLoaderData,
	useNavigation,
} from "@remix-run/react";
import {
	json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from "@remix-run/cloudflare";
import { getDatabase } from "~/repositories/database.server";
import type { TournamentRecord } from "~/repositories/tournaments";
import type { PairRecord } from "~/repositories/pairs";
import { generateAndStoreSingleEliminationBracket } from "~/repositories/bracket-generator";

type LoaderData = {
	eventId: string;
	tournaments: TournamentRecord[];
	tournamentsJson: string;
};

type ActionData =
	| {
			type: "success";
			source: "create" | "update" | "delete" | "import" | "generate" | "editor";
			message: string;
			tournaments: TournamentRecord[];
			tournamentsJson: string;
			tournament?: TournamentRecord;
			tournamentId?: string;
	  }
	| {
			type: "error";
			source: "create" | "update" | "delete" | "import" | "generate" | "editor";
			message: string;
			tournaments?: TournamentRecord[];
			tournamentsJson?: string;
			tournamentId?: string;
	  };

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) {
		return undefined;
	}

	const text = String(value).trim();

	return text.length > 0 ? text : undefined;
};

export async function loader({ params, context }: LoaderFunctionArgs) {
	const eventId = params.eventId;
	if (!eventId) {
		throw new Response("Event ID is required", { status: 400 });
	}

	const db = getDatabase(context);
	const tournaments = await db.tournaments.listTournaments(eventId);
	const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

	// Get participant counts for each tournament
	const participantCounts = await Promise.all(
		sortedTournaments.map(async (tournament) => ({
			tournamentId: tournament.id,
			count: await db.tournamentParticipants.count(tournament.id)
		}))
	);

	const participantCountMap = Object.fromEntries(
		participantCounts.map(p => [p.tournamentId, p.count])
	);

	return json<LoaderData & { participantCounts: Record<string, number> }>({
		eventId,
		tournaments: sortedTournaments,
		tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
		participantCounts: participantCountMap,
	});
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const eventId = params.eventId;
	if (!eventId) {
		throw new Response("Event ID is required", { status: 400 });
	}

	const formData = await request.formData();
	const intent = formData.get("_intent");

	const db = getDatabase(context);

	if (intent === "create") {
		const name = normalizeText(formData.get("name"));
		const format = normalizeText(formData.get("format")) as 'single-elimination' | 'double-elimination' | 'ffa-2up' | undefined;
		const seedingMode = normalizeText(formData.get("seedingMode")) as 'random' | 'manual' | undefined;
		const entryMode = normalizeText(formData.get("entryMode")) as 'pair' | 'solo' | undefined;
		const grandFinalsFormat = normalizeText(formData.get("grandFinalsFormat")) as 'single' | 'reset' | undefined;

		if (!name) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "create",
					message: "トーナメント名は必須です。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		try {
			const tournament = await db.tournaments.createTournament(eventId, { name, format, seedingMode, entryMode, grandFinalsFormat });
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

			return json<ActionData>({
				type: "success",
				source: "create",
				message: `トーナメント「${tournament.name}」を作成しました。`,
				tournament,
				tournaments: sortedTournaments,
				tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
			});
		} catch (error) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "create",
					message: error instanceof Error ? error.message : "トーナメントの作成に失敗しました。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}
	}

	if (intent === "update") {
		const tournamentId = normalizeText(formData.get("tournamentId"));
		const name = normalizeText(formData.get("name"));
		const format = normalizeText(formData.get("format")) as 'single-elimination' | 'double-elimination' | 'ffa-2up' | undefined;
		const seedingMode = normalizeText(formData.get("seedingMode")) as 'random' | 'manual' | undefined;
		const entryMode = normalizeText(formData.get("entryMode")) as 'pair' | 'solo' | undefined;
		const grandFinalsFormat = normalizeText(formData.get("grandFinalsFormat")) as 'single' | 'reset' | undefined;

		if (!tournamentId) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "update",
					message: "tournamentId が指定されていません。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		if (!name) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "update",
					message: "トーナメント名は必須です。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		try {
			const existing = await db.tournaments.ensureTournament(tournamentId);
			if (existing.eventId !== eventId) {
				throw new Response('Tournament not found', { status: 404 });
			}

			// Check if entry mode is being changed and if there are participants
			if (entryMode && entryMode !== existing.entryMode) {
				const participantCount = await db.tournamentParticipants.count(tournamentId);
				if (participantCount > 0) {
					const tournaments = await db.tournaments.listTournaments(eventId);
					const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
					return json<ActionData>(
						{
							type: "error",
							source: "update",
							message: `参加モードを変更するには、先に参加者をすべて削除してください（現在${participantCount}名登録されています）。`,
							tournaments: sortedTournaments,
							tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
						},
						{ status: 400 }
					);
				}
			}

			const tournament = await db.tournaments.updateTournament(tournamentId, { name, format, seedingMode, entryMode, grandFinalsFormat });
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

			return json<ActionData>({
				type: "success",
				source: "update",
				message: `トーナメント「${tournament.name}」を更新しました。`,
				tournament,
				tournaments: sortedTournaments,
				tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
			});
		} catch (error) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "update",
					message: "指定したトーナメントが見つかりません。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 404 }
			);
		}
	}

	if (intent === "delete") {
		const tournamentId = normalizeText(formData.get("tournamentId"));

		if (!tournamentId) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "delete",
					message: "tournamentId が指定されていません。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		try {
			const existing = await db.tournaments.ensureTournament(tournamentId);
			if (existing.eventId !== eventId) {
				throw new Response('Tournament not found', { status: 404 });
			}

			await db.tournaments.deleteTournament(tournamentId);
		} catch (error) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "delete",
					message: "指定したトーナメントが見つかりません。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 404 }
			);
		}

		const tournaments = await db.tournaments.listTournaments(eventId);
		const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

		return json<ActionData>({
			type: "success",
			source: "delete",
			message: "トーナメントを削除しました。",
			tournaments: sortedTournaments,
			tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
		});
	}

	if (intent === "import") {
		const rawPayload = formData.get("payload");
		const payload = typeof rawPayload === 'string' ? rawPayload.trim() : '';
		const mode = normalizeText(formData.get("mode")) ?? 'import';

		if (!payload) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: mode as any,
					message: "JSONデータが入力されていません。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(payload);
		} catch (error) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: mode as any,
					message: "JSONの解析に失敗しました。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		if (!Array.isArray(parsed)) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: mode as any,
					message: "配列形式のJSONを指定してください。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		const sanitized = parsed
			.map((entry) => {
				if (typeof entry !== 'object' || entry === null) return null;
				const maybeId = Reflect.get(entry, 'id');
				const maybeName = Reflect.get(entry, 'name');
				const maybeFormat = Reflect.get(entry, 'format');
				const maybeSeedingMode = Reflect.get(entry, 'seedingMode');

				if (typeof maybeName !== 'string') {
					return null;
				}

				const maybeEntryMode = Reflect.get(entry, 'entryMode');
				return {
					id: typeof maybeId === 'string' ? maybeId : undefined,
					name: maybeName,
					format: typeof maybeFormat === 'string' ? maybeFormat as 'single-elimination' : undefined,
					seedingMode: typeof maybeSeedingMode === 'string' ? maybeSeedingMode as 'random' | 'manual' : undefined,
					entryMode: typeof maybeEntryMode === 'string' ? maybeEntryMode as 'pair' | 'solo' : undefined
				};
			})
			.filter(Boolean);

		try {
			const imported = await db.tournaments.setTournaments(eventId, sanitized as any);
			const tournamentsJson = JSON.stringify(imported, null, 2);
			const message =
				mode === 'editor'
					? `JSONエディタから${imported.length}件のトーナメントを保存しました。`
					: `${imported.length}件のトーナメントを取り込みました。`;

			return json<ActionData>({
				type: "success",
				source: mode as any,
				message,
				tournamentsJson,
				tournaments: imported
			});
		} catch (error) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: mode as any,
					message: error instanceof Error ? error.message : "インポートに失敗しました。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}
	}

	if (intent === "generate") {
		const tournamentId = normalizeText(formData.get("tournamentId"));

		if (!tournamentId) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "generate",
					message: "tournamentId が指定されていません。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		let tournament: TournamentRecord;
		try {
			const existing = await db.tournaments.ensureTournament(tournamentId);
			if (existing.eventId !== eventId) {
				throw new Response('Tournament not found', { status: 404 });
			}
			tournament = existing;
		} catch (error) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "generate",
					message: "指定したトーナメントが見つかりません。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
					tournamentId
				},
				{ status: 404 }
			);
		}

		// Check entry mode and prepare pairs for bracket generation
		let pairsWithSeed: PairRecord[];
		
		if (tournament.entryMode === 'pair') {
			// Pair mode: use existing pairs
			const participants = await db.tournamentParticipants.listParticipants(tournamentId);
			const pairParticipants = participants.filter(p => p.participant_type === 'pair');
			
			if (pairParticipants.length < 2) {
				const tournaments = await db.tournaments.listTournaments(eventId);
				const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
				return json<ActionData>(
					{
						type: "error",
						source: "generate",
						message: "ブラケットを生成するには、少なくとも2組のペアが参加登録されている必要があります。",
						tournaments: sortedTournaments,
						tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
						tournamentId
					},
					{ status: 400 }
				);
			}

			// Resolve PairRecord[] from participants
			const pairIds = pairParticipants.map(p => p.pair_id).filter((id): id is string => id !== null);
			const allPairs = await db.pairs.listPairs(eventId);
			const pairs = pairIds.map(pairId => {
				const pair = allPairs.find(p => p.id === pairId);
				if (!pair) {
					throw new Error(`ペアが見つかりません: ${pairId}`);
				}
				return pair;
			});

			// Use seed from participant if available, otherwise use pair seed
			pairsWithSeed = pairs.map(pair => {
				const participant = pairParticipants.find(p => p.pair_id === pair.id);
				return {
					...pair,
					seed: participant?.seed ?? pair.seed
				};
			});
		} else if (tournament.entryMode === 'solo') {
			// Solo mode: pair solo participants
			try {
				const { pairSoloParticipants } = await import('~/repositories/solo-pairing');
				const pairs = await pairSoloParticipants(
					eventId,
					tournamentId,
					{
						listParticipants: (tid) => db.tournamentParticipants.listParticipants(tid),
						listPairs: (eid) => db.pairs.listPairs(eid),
						createPair: (eid, data) => db.pairs.createPair(eid, data)
					}
				);
				
				// Use pair seed (solo participants don't have seed)
				pairsWithSeed = pairs.map(pair => ({
					...pair,
					seed: pair.seed
				}));
			} catch (error) {
				const tournaments = await db.tournaments.listTournaments(eventId);
				const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
				return json<ActionData>(
					{
						type: "error",
						source: "generate",
						message: error instanceof Error ? error.message : "ブラケット生成に失敗しました。",
						tournaments: sortedTournaments,
						tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
						tournamentId
					},
					{ status: 400 }
				);
			}
		} else {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "generate",
					message: "ブラケット生成はペア参加モードまたは個別参加モードでのみ利用できます。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
					tournamentId
				},
				{ status: 400 }
			);
		}

		const seedingMode = tournament.seedingMode ?? 'random';
		
		// FFA 2-up形式の処理
		if (tournament.format === 'ffa-2up') {
			if (tournament.entryMode !== 'solo') {
				const tournaments = await db.tournaments.listTournaments(eventId);
				const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
				return json<ActionData>(
					{
						type: "error",
						source: "generate",
						message: "FFA 2-up形式は個別参加モード（solo）でのみ利用できます。",
						tournaments: sortedTournaments,
						tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
						tournamentId
					},
					{ status: 400 }
				);
			}

			// Solo参加者を取得
			const participants = await db.tournamentParticipants.listParticipants(tournamentId);
			const soloParticipants = participants.filter(p => p.participant_type === 'solo' && p.player_id);

			if (soloParticipants.length % 4 !== 0) {
				const tournaments = await db.tournaments.listTournaments(eventId);
				const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
				return json<ActionData>(
					{
						type: "error",
						source: "generate",
						message: `FFA 2-up形式では参加者数が4の倍数である必要があります。現在の参加者数: ${soloParticipants.length}`,
						tournaments: sortedTournaments,
						tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
						tournamentId
					},
					{ status: 400 }
				);
			}

			try {
				const { generateAndStoreFfa2UpBracket } = await import('~/repositories/ffa-generator');
				await generateAndStoreFfa2UpBracket({
					tournamentId,
					players: soloParticipants,
					seedingMode,
					setGroups: (targetTournamentId, groups) =>
						db.ffaGroups.setFfaGroups(targetTournamentId, groups)
				});

				const tournaments = await db.tournaments.listTournaments(eventId);
				const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
				const tournamentsJson = JSON.stringify(sortedTournaments, null, 2);

				return json<ActionData>({
					type: "success",
					source: "generate",
					message: `トーナメント「${tournament.name}」のFFA 2-upブラケットを生成しました。`,
					tournaments: sortedTournaments,
					tournamentsJson,
					tournamentId
				});
			} catch (error) {
				const tournaments = await db.tournaments.listTournaments(eventId);
				const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
				return json<ActionData>(
					{
						type: "error",
						source: "generate",
						message: error instanceof Error ? error.message : "FFA 2-upブラケット生成に失敗しました。",
						tournaments: sortedTournaments,
						tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
						tournamentId
					},
					{ status: 400 }
				);
			}
		}

		// シングルエリミネーションまたはダブルエリミネーション形式の処理
		try {
			if (tournament.format === 'single-elimination') {
				await generateAndStoreSingleEliminationBracket({
					tournamentId,
					pairs: pairsWithSeed,
					seedingMode,
					setMatches: (targetTournamentId, matches) =>
						db.bracketMatches.setBracketMatches(targetTournamentId, matches)
				});
			} else if (tournament.format === 'double-elimination') {
				const { generateAndStoreDoubleEliminationBracket } = await import('~/repositories/bracket-generator');
				await generateAndStoreDoubleEliminationBracket({
					tournamentId,
					pairs: pairsWithSeed,
					seedingMode,
					grandFinalsFormat: tournament.grandFinalsFormat ?? 'single',
					setMatches: (targetTournamentId, matches) =>
						db.bracketMatches.setBracketMatches(targetTournamentId, matches)
				});
			} else if (tournament.format !== 'ffa-2up') {
				const tournaments = await db.tournaments.listTournaments(eventId);
				const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
				return json<ActionData>(
					{
						type: "error",
						source: "generate",
						message: "ブラケット生成はシングルエリミネーション、ダブルエリミネーション、またはFFA 2-up形式でのみ利用できます。",
						tournaments: sortedTournaments,
						tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
						tournamentId
					},
					{ status: 400 }
				);
			}

			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			const tournamentsJson = JSON.stringify(sortedTournaments, null, 2);

			return json<ActionData>({
				type: "success",
				source: "generate",
				message: `トーナメント「${tournament.name}」のブラケットを生成しました。`,
				tournaments: sortedTournaments,
				tournamentsJson,
				tournamentId
			});
		} catch (error) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "generate",
					message: error instanceof Error ? error.message : "ブラケット生成に失敗しました。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
					tournamentId
				},
				{ status: 400 }
			);
		}
	}

	return json<ActionData | null>(null);
}

function FlashMessage({ action }: { action: ActionData | undefined }) {
	if (!action) return null;

	const isError = action.type === "error";
	const isSuccess = action.type === "success";

	if (!isError && !isSuccess) return null;

	return (
		<div
			className={`rounded-lg p-4 mb-4 ${
				isError
					? "bg-red-50 border border-red-200 text-red-800"
					: "bg-green-50 border border-green-200 text-green-800"
			}`}
		>
			{action.message}
		</div>
	);
}

export default function TournamentsRoute() {
	const loaderData = useLoaderData<typeof loader>();
	const { eventId, tournaments: initialTournaments, tournamentsJson: initialTournamentsJson, participantCounts } = loaderData;
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();

	const [importPayload, setImportPayload] = useState("");
	const [editorMode, setEditorMode] = useState(false);
	const [editorPayload, setEditorPayload] = useState(initialTournamentsJson);
	const [editorError, setEditorError] = useState<string | null>(null);
	const [generatingTournamentId, setGeneratingTournamentId] = useState<string | null>(null);
	const [createFormat, setCreateFormat] = useState<'single-elimination' | 'double-elimination' | 'ffa-2up'>('single-elimination');

	const tournaments = useMemo(() => {
		if (actionData?.tournaments) {
			return actionData.tournaments;
		}
		return initialTournaments || [];
	}, [actionData, initialTournaments]);

	const tournamentsJson = useMemo(() => {
		if (actionData?.tournamentsJson) {
			return actionData.tournamentsJson;
		}
		return initialTournamentsJson || "";
	}, [actionData, initialTournamentsJson]);

	const isSubmitting = navigation.state === "submitting";

	const importExample = JSON.stringify(
		[
			{ name: 'Spring Tournament', format: 'single-elimination', seedingMode: 'random' },
			{ id: 'custom-id', name: 'Summer Championship', seedingMode: 'manual' }
		],
		null,
		2
	);

	const resetEditor = () => {
		setEditorPayload(tournamentsJson);
		setEditorError(null);
	};

	const validateEditorPayload = () => {
		try {
			setEditorError(null);
			JSON.parse(editorPayload);
		} catch (error) {
			setEditorError('JSONの形式が正しくありません。');
		}
	};

	useEffect(() => {
		if (actionData?.source === 'generate') {
			setGeneratingTournamentId(null);
		}
	}, [actionData]);

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-slate-900">トーナメント設定</h1>
					<p className="mt-2 text-sm text-slate-600">
						イベントID: <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono">{eventId}</code>
					</p>
				</div>
				<Link
					to="/admin"
					className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
				>
					← 管理トップに戻る
				</Link>
			</header>

			{/* トーナメント作成フォーム */}
			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
				<h2 className="text-xl font-semibold text-slate-900 mb-6">トーナメントを作成</h2>
				<FlashMessage action={actionData?.source === 'create' ? actionData : undefined} />
				<Form method="post" className="space-y-4">
					<input type="hidden" name="_intent" value="create" />
					<div>
						<label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
							トーナメント名 <span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							id="name"
							name="name"
							required
							placeholder="例: 春季大会"
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label htmlFor="format" className="block text-sm font-medium text-slate-700 mb-2">
							形式
						</label>
						<select
							id="format"
							name="format"
							value={createFormat}
							onChange={(e) => setCreateFormat(e.target.value as 'single-elimination' | 'double-elimination' | 'ffa-2up')}
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						>
							<option value="single-elimination">シングルエリミネーション</option>
							<option value="double-elimination">ダブルエリミネーション</option>
							<option value="ffa-2up">FFA 2-up（4人1グループ→上位2名）</option>
						</select>
					</div>

					{createFormat === 'double-elimination' && (
						<div>
							<label htmlFor="grandFinalsFormat" className="block text-sm font-medium text-slate-700 mb-2">
								グランドファイナル形式
							</label>
							<select
								id="grandFinalsFormat"
								name="grandFinalsFormat"
								defaultValue="single"
								className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
							>
								<option value="single">シングル（1試合のみ）</option>
								<option value="reset">リセット（敗者側勝利時に追加試合）</option>
							</select>
							<p className="mt-1 text-xs text-slate-500">
								シングル: 1試合で優勝決定。リセット: 敗者側が勝った場合、追加試合（GF2）を実施。
							</p>
						</div>
					)}

					<div>
						<label htmlFor="seedingMode" className="block text-sm font-medium text-slate-700 mb-2">
							シード方式
						</label>
						<select
							id="seedingMode"
							name="seedingMode"
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						>
							<option value="random">ランダム</option>
							<option value="manual">手動</option>
						</select>
					</div>

					<div>
						<label htmlFor="entryMode" className="block text-sm font-medium text-slate-700 mb-2">
							参加モード
						</label>
						<select
							id="entryMode"
							name="entryMode"
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						>
							<option value="pair">ペア参加</option>
							<option value="solo">個別参加</option>
						</select>
						<p className="mt-1 text-xs text-slate-500">
							ペア参加: 既存のペアから選択して参加。個別参加: プレイヤーを個別に登録。
						</p>
					</div>

					<div className="flex justify-end">
						<button
							type="submit"
							disabled={isSubmitting}
							className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
						>
							{isSubmitting ? "作成中..." : "作成"}
						</button>
					</div>
				</Form>
			</section>

			{/* 登録済みトーナメント一覧 */}
			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
				<h2 className="text-xl font-semibold text-slate-900 mb-6">
					登録済みトーナメント ({tournaments.length})
				</h2>
				<FlashMessage action={actionData && actionData.source !== 'create' && actionData.source !== 'editor' ? actionData : undefined} />

				{tournaments.length === 0 ? (
					<p className="text-sm text-slate-500">まだトーナメントが作成されていません。</p>
				) : (
					<div className="space-y-4">
						{tournaments.map((tournament) => (
							<div key={tournament.id} className="rounded-lg border border-slate-200 bg-slate-50 p-6">
								<Form method="post" className="space-y-4">
									<input type="hidden" name="_intent" value="update" />
									<input type="hidden" name="tournamentId" value={tournament.id} />

									<div>
										<label className="block text-sm font-medium text-slate-700 mb-2">
											トーナメント名
										</label>
										<input
											type="text"
											name="name"
											defaultValue={tournament.name}
											required
											className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
										/>
									</div>

									<div>
										<label className="block text-sm font-medium text-slate-700 mb-2">
											形式
										</label>
										<select
											name="format"
											defaultValue={tournament.format}
											className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
										>
											<option value="single-elimination">シングルエリミネーション</option>
											<option value="double-elimination">ダブルエリミネーション</option>
											<option value="ffa-2up">FFA 2-up（4人1グループ→上位2名）</option>
										</select>
									</div>

									{tournament.format === 'double-elimination' && (
										<div>
											<label className="block text-sm font-medium text-slate-700 mb-2">
												グランドファイナル形式
											</label>
											<select
												name="grandFinalsFormat"
												defaultValue={tournament.grandFinalsFormat ?? 'single'}
												className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
											>
												<option value="single">シングル（1試合のみ）</option>
												<option value="reset">リセット（敗者側勝利時に追加試合）</option>
											</select>
											<p className="mt-1 text-xs text-slate-500">
												シングル: 1試合で優勝決定。リセット: 敗者側が勝った場合、追加試合（GF2）を実施。
											</p>
										</div>
									)}

									<div>
										<label className="block text-sm font-medium text-slate-700 mb-2">
											シード方式
										</label>
										<select
											name="seedingMode"
											defaultValue={tournament.seedingMode}
											className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
										>
											<option value="random">ランダム</option>
											<option value="manual">手動</option>
										</select>
									</div>

									<div>
										<label className="block text-sm font-medium text-slate-700 mb-2">
											参加モード
										</label>
										{(() => {
											const participantCount = participantCounts[tournament.id] ?? 0;
											const isDisabled = participantCount > 0;
											return (
												<>
													<select
														name="entryMode"
														defaultValue={tournament.entryMode}
														disabled={isDisabled}
														className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
															isDisabled ? 'bg-slate-100 cursor-not-allowed' : ''
														}`}
													>
														<option value="pair">ペア参加</option>
														<option value="solo">個別参加</option>
													</select>
													{isDisabled && (
														<p className="mt-1 text-xs text-orange-600">
															参加者が{participantCount}名登録されているため、参加モードを変更できません。先に参加者をすべて削除してください。
														</p>
													)}
													{!isDisabled && (
														<p className="mt-1 text-xs text-slate-500">
															ペア参加: 既存のペアから選択。個別参加: プレイヤーを個別に登録。
														</p>
													)}
												</>
											);
										})()}
									</div>

									<div className="text-xs text-slate-500">
										作成日時: {new Date(tournament.createdAt).toLocaleString('ja-JP')}
									</div>

									<div className="flex justify-end">
										<button
											type="submit"
											disabled={isSubmitting}
											className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
										>
											{isSubmitting ? "更新中..." : "更新"}
										</button>
									</div>
								</Form>

								<div className="mt-4 flex flex-wrap gap-2">
									<Link
										to={`/admin/events/${eventId}/tournaments/${tournament.id}/participants`}
										className="inline-flex items-center rounded-lg border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 transition hover:bg-green-100"
									>
										参加者管理
									</Link>
									<Link
										to={`/admin/events/${eventId}/tournaments/${tournament.id}/bracket`}
										className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
									>
										ブラケットを見る
									</Link>

									{(() => {
										const isSoloMode = tournament.entryMode === 'solo';
										const isFfa2Up = tournament.format === 'ffa-2up';
										const participantCount = participantCounts[tournament.id] ?? 0;
										
										let canGenerateBracket: boolean;
										if (isFfa2Up) {
											canGenerateBracket = isSoloMode && participantCount >= 4 && participantCount % 4 === 0;
										} else {
											canGenerateBracket = isSoloMode
												? participantCount >= 2 && participantCount % 2 === 0
												: participantCount >= 2 && participantCount % 2 === 0;
										}
										
										const isDisabled = isSubmitting || !canGenerateBracket;
										
										let disabledTitle: string | undefined;
										if (isFfa2Up) {
											if (!isSoloMode) {
												disabledTitle = 'FFA 2-up形式は個別参加モード（solo）でのみ利用できます';
											} else if (participantCount < 4) {
												disabledTitle = 'FFA 2-up形式では少なくとも4名の参加者が必要です';
											} else if (participantCount % 4 !== 0) {
												disabledTitle = `FFA 2-up形式では参加者数が4の倍数である必要があります。現在の参加者数: ${participantCount}`;
											}
										} else if (isSoloMode) {
											if (participantCount < 2) {
												disabledTitle = 'ブラケット生成には少なくとも2名の参加者が必要です';
											} else if (participantCount % 2 !== 0) {
												disabledTitle = 'ブラケット生成には参加者数が偶数である必要があります。参加者を追加または削除してください。';
											}
										} else {
											if (participantCount < 2) {
												disabledTitle = 'ブラケット生成には少なくとも2組のペアが必要です';
											} else if (participantCount % 2 !== 0) {
												disabledTitle = 'ブラケット生成にはペア数が偶数である必要があります';
											}
										}
										
										return (
											<Form method="post" className="inline">
												<input type="hidden" name="_intent" value="generate" />
												<input type="hidden" name="tournamentId" value={tournament.id} />
												<button
													type="submit"
													disabled={isDisabled}
													className={`rounded-lg px-3 py-1 text-xs font-medium text-white transition disabled:opacity-50 ${
														isDisabled
															? 'bg-slate-400 cursor-not-allowed'
															: 'bg-green-600 hover:bg-green-700'
													}`}
													title={disabledTitle}
												>
													{isSubmitting ? '生成中…' : 'ブラケット生成'}
												</button>
											</Form>
										);
									})()}

									<Form method="post" className="inline">
										<input type="hidden" name="_intent" value="delete" />
										<input type="hidden" name="tournamentId" value={tournament.id} />
										<button
											type="submit"
											disabled={isSubmitting}
											onClick={(e) => {
												if (!confirm('削除しますか？')) {
													e.preventDefault();
												}
											}}
											className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
										>
											削除
										</button>
									</Form>
								</div>
							</div>
						))}
					</div>
				)}
			</section>

			{/* インポート/エクスポート */}
			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
				<h2 className="text-xl font-semibold text-slate-900 mb-6">インポート / エクスポート</h2>
				
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					{/* エクスポート */}
					<div>
						<h3 className="text-lg font-medium text-slate-900 mb-4">エクスポート</h3>
						<textarea
							readOnly
							rows={8}
							value={tournamentsJson}
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
						<a
							href={`data:application/json;charset=utf-8,${encodeURIComponent(tournamentsJson)}`}
							download={`tournaments-${eventId}.json`}
							className="mt-2 inline-flex items-center rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
						>
							JSONをダウンロード
						</a>
					</div>

					{/* インポート */}
					<div>
						<h3 className="text-lg font-medium text-slate-900 mb-4">インポート</h3>
						<FlashMessage action={actionData?.source === 'import' ? actionData : undefined} />
						<Form method="post" className="space-y-4">
							<input type="hidden" name="_intent" value="import" />
							<div>
								<label className="block text-sm font-medium text-slate-700 mb-2">
									JSONデータ
								</label>
								<textarea
									name="payload"
									rows={8}
									value={importPayload}
									onChange={(e) => setImportPayload(e.target.value)}
									placeholder={importExample}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
								/>
							</div>
							<div className="flex justify-end">
								<button
									type="submit"
									disabled={isSubmitting}
									className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
								>
									{isSubmitting ? "取り込み中..." : "取り込み"}
								</button>
							</div>
						</Form>
						<p className="mt-2 text-xs text-slate-500">
							※ 空行や無効なエントリはスキップされます。既存トーナメントは上書きされます。
						</p>
					</div>
				</div>
			</section>

			{/* JSONエディタ */}
			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
				<div className="flex items-center justify-between mb-6">
					<div>
						<h2 className="text-xl font-semibold text-slate-900">JSONエディタで編集</h2>
						<p className="text-sm text-slate-600">直接JSONを編集し、上書き保存できます。</p>
					</div>
					<button
						type="button"
						onClick={() => {
							setEditorMode(!editorMode);
							if (!editorMode) {
								resetEditor();
							}
						}}
						className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
							editorMode
								? "bg-blue-100 text-blue-700"
								: "bg-slate-100 text-slate-700 hover:bg-slate-200"
						}`}
					>
						{editorMode ? '閉じる' : 'JSONエディタを開く'}
					</button>
				</div>

				{editorMode && (
					<>
						<FlashMessage action={actionData?.source === 'editor' ? actionData : undefined} />

						<div className={`space-y-4 ${editorError ? 'border-red-300' : ''}`}>
							<textarea
								rows={14}
								value={editorPayload}
								onChange={(e) => {
									setEditorPayload(e.target.value);
									validateEditorPayload();
								}}
								className={`w-full rounded-lg border px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 ${
									editorError
										? "border-red-300 focus:border-red-500 focus:ring-red-500"
										: "border-slate-300 focus:border-blue-500 focus:ring-blue-500"
								}`}
							/>
							{editorError && (
								<p className="text-sm text-red-600">⚠️ {editorError}</p>
							)}
						</div>

						<Form method="post" className="mt-4">
							<input type="hidden" name="_intent" value="import" />
							<input type="hidden" name="mode" value="editor" />
							<input type="hidden" name="payload" value={editorPayload} />
							<div className="flex justify-end gap-2">
								<button
									type="button"
									onClick={resetEditor}
									className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
								>
									元に戻す
								</button>
								<button
									type="submit"
									disabled={isSubmitting || Boolean(editorError)}
									className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
								>
									{isSubmitting ? "保存中..." : "JSONを保存"}
								</button>
							</div>
						</Form>
					</>
				)}
			</section>

			{/* 子ルートのコンテンツを表示 */}
			<Outlet />
		</div>
	);
}
