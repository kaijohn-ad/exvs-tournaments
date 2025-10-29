import worker from "../server";

type WorkerFetchArgs = Parameters<typeof worker.fetch>;
type WorkerResponse = Awaited<ReturnType<typeof worker.fetch>>;

export const onRequest: PagesFunction = async (context) => {
	const response = await worker.fetch(
		context.request as WorkerFetchArgs[0],
		context.env as unknown as WorkerFetchArgs[1],
		{
			waitUntil: context.waitUntil.bind(context),
			passThroughOnException: context.passThroughOnException.bind(context),
		} as WorkerFetchArgs[2]
	);

	return response as WorkerResponse;
};
