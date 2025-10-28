import type { PagesFunction } from "@cloudflare/workers-types";
import worker from "../server";

export const onRequest: PagesFunction = async (context) => {
	return worker.fetch(context.request, context.env, context);
};
