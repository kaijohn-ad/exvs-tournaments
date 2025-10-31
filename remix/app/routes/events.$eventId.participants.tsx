import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { getDatabase } from "~/repositories/database.server";
import type { PlayerRecord } from "~/repositories/players";
import type { PairRecord } from "~/repositories/pairs";

type LoaderData = {
	eventId: string;
	event: {
		id: string;
		name: string;
		slug: string | null;
		createdAt: string;
	};
	players: PlayerRecord[];
	pairs: PairRecord[];
};

export async function loader({ params, context }: LoaderFunctionArgs) {
	const eventId = params.eventId;
	if (!eventId) {
		throw new Response("Event ID is required", { status: 400 });
	}

	const db = getDatabase(context);

	try {
		const event = await db.events.ensureEvent(eventId);
		const [players, pairs] = await Promise.all([
			db.players.listPlayers(eventId),
			db.pairs.listPairs(eventId),
		]);

		// プレイヤーを名前順でソート
		const sortedPlayers = [...players].sort((a, b) =>
			a.name.localeCompare(b.name, 'ja')
		);

		// ペアをシード順でソート
		const sortedPairs = [...pairs].sort((a, b) => {
			if (a.seed === null && b.seed === null) return 0;
			if (a.seed === null) return 1;
			if (b.seed === null) return -1;
			return a.seed - b.seed;
		});

		return json<LoaderData>({
			eventId,
			event: {
				id: event.id,
				name: event.name,
				slug: event.slug,
				createdAt: event.createdAt,
			},
			players: sortedPlayers,
			pairs: sortedPairs,
		});
	} catch (error) {
		console.error("[events.$eventId.participants:load] failed", {
			eventId,
			error: error instanceof Error ? error.message : error,
		});
		throw new Response("指定したイベントが見つかりません。", { status: 404 });
	}
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
	{ title: `${data?.event.name || "イベント"} - 参加者 | Boost Bracket` },
	{ name: "description", content: `${data?.event.name || "イベント"}の参加者一覧` },
];

export default function EventParticipantsRoute() {
	const { eventId, event, players, pairs } = useLoaderData<typeof loader>();

	// プレイヤー名のマップを作成
	const playerNameMap = new Map(players.map((p) => [p.id, p.name]));

	const getPairDisplayName = (pair: PairRecord): string => {
		const player1Name = playerNameMap.get(pair.player1_id) ?? "?";
		const player2Name = playerNameMap.get(pair.player2_id) ?? "?";
		return `${player1Name} / ${player2Name}`;
	};

	return (
		<div className="flex flex-col gap-8">
			<header className="flex flex-col gap-2">
				<h2 className="text-2xl font-bold text-slate-900">参加者一覧</h2>
				<p className="text-sm text-slate-600">
					このイベントに参加登録されているプレイヤーとペアの一覧です。
				</p>
			</header>

			{/* プレイヤー一覧 */}
			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="participants-list">
				<h3 className="text-lg font-semibold text-slate-900 mb-4">
					プレイヤー ({players.length})
				</h3>
				{players.length === 0 ? (
					<p className="text-sm text-slate-500">登録されているプレイヤーはありません。</p>
				) : (
					<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
						{players.map((player) => (
							<div
								key={player.id}
								data-testid={`participant-${player.id}`}
								className="rounded-lg border border-slate-200 bg-slate-50 p-4"
							>
								<div className="font-medium text-slate-900">{player.name}</div>
								{player.note && (
									<p className="mt-1 text-xs text-slate-500">{player.note}</p>
								)}
							</div>
						))}
					</div>
				)}
			</section>

			{/* ペア一覧 */}
			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="participants-list">
				<h3 className="text-lg font-semibold text-slate-900 mb-4">
					ペア ({pairs.length})
				</h3>
				{pairs.length === 0 ? (
					<p className="text-sm text-slate-500">登録されているペアはありません。</p>
				) : (
					<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
						{pairs.map((pair) => (
							<div
								key={pair.id}
								data-testid={`pair-${pair.id}`}
								className="rounded-lg border border-slate-200 bg-slate-50 p-4"
							>
								<div className="font-medium text-slate-900">
									{getPairDisplayName(pair)}
								</div>
								{pair.seed !== null && (
									<p className="mt-1 text-xs text-slate-500">シード: {pair.seed}</p>
								)}
							</div>
						))}
					</div>
				)}
			</section>
		</div>
	);
}

