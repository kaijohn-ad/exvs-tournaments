import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { getDatabase } from "~/repositories/database.server";
import type { EventRecord } from "~/repositories/events";
import type { TournamentRecord } from "~/repositories/tournaments";

type LoaderData = {
	slug: string;
	eventName: string;
	tournaments: TournamentRecord[];
	message: string;
};

export async function loader({ params, context }: LoaderFunctionArgs) {
	const slug = params.slug;

	if (!slug) {
		throw new Response("Slug is required", { status: 400 });
	}

	const db = getDatabase(context);

	// TODO: スラッグベースのイベント検索機能を実装
	// 現在はプレースホルダー実装
	const eventName = "Sample Event";
	const tournaments: TournamentRecord[] = [];
	const message = "Public view implementation in progress";

	return json<LoaderData>({
		slug,
		eventName,
		tournaments,
		message,
	});
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
	{ title: `${data?.eventName || "Event"} | Boost Bracket` },
	{ name: "description", content: "イベント詳細ページ" },
];

export default function ViewSlug() {
	const { slug, eventName, tournaments, message } = useLoaderData<typeof loader>();

	return (
		<div className="min-h-screen bg-gradient-to-b from-indigo-50 to-slate-50 text-slate-900">
			<section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
				<header className="flex flex-col gap-2">
					<h1 className="text-3xl font-bold text-slate-900">{eventName}</h1>
					<p className="text-slate-600">
						イベントスラッグ: <code className="bg-slate-200 px-2 py-1 rounded text-sm font-mono">{slug}</code>
					</p>
				</header>

				<section className="bg-white rounded-2xl p-7 shadow-lg border border-slate-200">
					<h2 className="text-xl font-semibold text-slate-900 mb-5">トーナメント一覧</h2>
					<p className="text-slate-600">{message}</p>
				</section>
			</section>
		</div>
	);
}
