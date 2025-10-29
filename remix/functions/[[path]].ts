import worker from "../server";

type WorkerFetchArgs = Parameters<typeof worker.fetch>;
type WorkerResponse = Awaited<ReturnType<typeof worker.fetch>>;

export const onRequest: PagesFunction = async (context) => {
    const url = new URL(context.request.url);

    // Let Cloudflare Pages serve built static assets directly
    // This includes hashed assets emitted by Vite under /assets and common root files
    if (
        url.pathname.startsWith("/assets/") ||
        url.pathname === "/favicon.ico" ||
        url.pathname.startsWith("/manifest-") ||
        url.pathname.endsWith(".css") ||
        url.pathname.endsWith(".js")
    ) {
        return context.next();
    }

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
