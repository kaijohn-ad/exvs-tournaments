import { describe, it, expect, beforeEach } from "vitest";
import { loader } from "../view.$slug";
import type { LoaderFunctionArgs } from "@remix-run/cloudflare";

describe("view slug route", () => {
	let context: LoaderFunctionArgs["context"];

	beforeEach(() => {
		context = {
			cloudflare: {
				env: {
					DB: {
						prepare: () => ({
							all: () => Promise.resolve({ results: [] }),
							first: () => Promise.resolve(null),
							run: () => Promise.resolve({ success: true }),
						}),
					},
				},
			},
		} as any;
	});

	it("returns placeholder data for slug", async () => {
		const result = await loader({
			context,
			params: { slug: "test-slug" },
			request: new Request("http://localhost"),
		});
		const data = await result.json();

		expect(data.slug).toBe("test-slug");
		expect(data.eventName).toBe("Sample Event");
		expect(data.tournaments).toEqual([]);
		expect(data.message).toBe("Public view implementation in progress");
	});

	it("throws error when slug is missing", async () => {
		await expect(
			loader({
				context,
				params: {},
				request: new Request("http://localhost"),
			})
		).rejects.toThrow();
	});
});
