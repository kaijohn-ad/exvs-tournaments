import type { AppLoadContext } from "@remix-run/cloudflare";

// Thin wrapper helpers around the Cloudflare D1 binding so loaders/actions
// can share consistent behaviour without rewriting boilerplate.
type PreparedStatement = ReturnType<AppLoadContext["db"]["prepare"]>;

type StatementOptions<TParams extends unknown[]> = {
	bindings?: TParams;
};

function bindStatement<TParams extends unknown[]>(
	statement: PreparedStatement,
	bindings: TParams | undefined
) {
	if (!bindings?.length) {
		return statement;
	}

	return statement.bind(...bindings);
}

export function getDatabase(context: AppLoadContext) {
	return context.db;
}

export async function queryAll<TResult extends Record<string, unknown>, TParams extends unknown[]>(
	context: AppLoadContext,
	query: string,
	options: StatementOptions<TParams> = {}
) {
	const statement = bindStatement(context.db.prepare(query), options.bindings);
	const { results } = await statement.all<TResult>();
	return results;
}

export async function queryFirst<TResult extends Record<string, unknown>, TParams extends unknown[]>(
	context: AppLoadContext,
	query: string,
	options: StatementOptions<TParams> = {}
) {
	const records = await queryAll<TResult, TParams>(context, query, options);
	return records[0] ?? null;
}

export async function execute(
	context: AppLoadContext,
	query: string,
	options: StatementOptions<unknown[]> = {}
) {
	const statement = bindStatement(context.db.prepare(query), options.bindings);
	return statement.run();
}
