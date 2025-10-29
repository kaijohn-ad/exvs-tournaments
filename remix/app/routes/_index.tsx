import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { queryAll } from "~/utils/d1.server";

type LoaderData = {
	tables: string[];
};

export async function loader({ context }: LoaderFunctionArgs) {
	const tables = await queryAll<{ name: string }, [string]>(
		context,
		"SELECT name FROM sqlite_master WHERE type = ? ORDER BY name",
		{ bindings: ["table"] }
	);

	return json<LoaderData>({
		tables: tables.map((record) => record.name),
	});
}

export const meta: MetaFunction = () => {
	return [
		{ title: "New Remix App" },
		{ name: "description", content: "Welcome to Remix!" },
	];
};

export default function Index() {
	const { tables } = useLoaderData<typeof loader>();

	return (
		<div className="flex h-screen items-center justify-center">
			<div className="flex flex-col items-center gap-16">
				<header className="flex flex-col items-center gap-9">
					<h1 className="leading text-2xl font-bold text-gray-800 dark:text-gray-100">
						Welcome to <span className="sr-only">Remix</span>
					</h1>
					<div className="h-[144px] w-[434px]">
						<img
							src="/logo-light.png"
							alt="Remix"
							className="block w-full dark:hidden"
						/>
						<img
							src="/logo-dark.png"
							alt="Remix"
							className="hidden w-full dark:block"
						/>
					</div>
				</header>
				<nav className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-gray-200 p-6 dark:border-gray-700">
					<p className="leading-6 text-gray-700 dark:text-gray-200">
						Cloudflare D1 integration is live — detected tables:
					</p>
					<ul className="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-200">
						{tables.length > 0 ? (
							tables.map((name) => (
								<li key={name} className="rounded-full border border-gray-300 px-4 py-1 dark:border-gray-600">
									{name}
								</li>
							))
						) : (
							<li className="rounded-full border border-amber-400 bg-amber-50 px-4 py-1 text-amber-700 dark:border-amber-500 dark:bg-amber-500/10 dark:text-amber-200">
								No tables found yet. Run the D1 migrations before continuing.
							</li>
						)}
					</ul>
				</nav>
			</div>
		</div>
	);
}
