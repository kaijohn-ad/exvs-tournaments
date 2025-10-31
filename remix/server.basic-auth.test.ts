import { describe, expect, test } from "vitest";
import { requireBasicAuthOnAdmin } from "./app/utils/basic-auth.server";

describe("requireBasicAuthOnAdmin", () => {
	test("環境変数未設定の場合は認証をスキップ（nullを返す）", () => {
		const request = new Request("https://example.com/admin");
		const env = {} as Env;

		const result = requireBasicAuthOnAdmin(request, env);

		expect(result).toBeNull();
	});

	test("環境変数設定済み・Authorizationヘッダなしの場合は401を返す", () => {
		const request = new Request("https://example.com/admin");
		const env = {
			BASIC_AUTH_USER: "admin",
			BASIC_AUTH_PASSWORD: "password",
		} as Env;

		const result = requireBasicAuthOnAdmin(request, env);

		expect(result).not.toBeNull();
		expect(result?.status).toBe(401);
		expect(result?.headers.get("WWW-Authenticate")).toBe('Basic realm="Admin", charset="UTF-8"');
	});

	test("環境変数設定済み・誤った認証情報の場合は401を返す", () => {
		const credentials = btoa("wronguser:wrongpass");
		const request = new Request("https://example.com/admin", {
			headers: {
				Authorization: `Basic ${credentials}`,
			},
		});
		const env = {
			BASIC_AUTH_USER: "admin",
			BASIC_AUTH_PASSWORD: "password",
		} as Env;

		const result = requireBasicAuthOnAdmin(request, env);

		expect(result).not.toBeNull();
		expect(result?.status).toBe(401);
		expect(result?.headers.get("WWW-Authenticate")).toBe('Basic realm="Admin", charset="UTF-8"');
	});

	test("環境変数設定済み・正しい認証情報の場合はnullを返す（認証成功）", () => {
		const credentials = btoa("admin:password");
		const request = new Request("https://example.com/admin", {
			headers: {
				Authorization: `Basic ${credentials}`,
			},
		});
		const env = {
			BASIC_AUTH_USER: "admin",
			BASIC_AUTH_PASSWORD: "password",
		} as Env;

		const result = requireBasicAuthOnAdmin(request, env);

		expect(result).toBeNull();
	});

	test("/admin 以外のパスへのアクセスは認証をスキップ", () => {
		const request = new Request("https://example.com/events");
		const env = {
			BASIC_AUTH_USER: "admin",
			BASIC_AUTH_PASSWORD: "password",
		} as Env;

		const result = requireBasicAuthOnAdmin(request, env);

		expect(result).toBeNull();
	});

	test("/admin/ で始まるパスも認証が必要", () => {
		const request = new Request("https://example.com/admin/events");
		const env = {
			BASIC_AUTH_USER: "admin",
			BASIC_AUTH_PASSWORD: "password",
		} as Env;

		const result = requireBasicAuthOnAdmin(request, env);

		expect(result).not.toBeNull();
		expect(result?.status).toBe(401);
	});

	test("不正なBase64エンコードの場合は401を返す", () => {
		const request = new Request("https://example.com/admin", {
			headers: {
				Authorization: "Basic invalid-base64!@#$",
			},
		});
		const env = {
			BASIC_AUTH_USER: "admin",
			BASIC_AUTH_PASSWORD: "password",
		} as Env;

		const result = requireBasicAuthOnAdmin(request, env);

		expect(result).not.toBeNull();
		expect(result?.status).toBe(401);
	});

	test("コロンを含まない認証情報の場合は401を返す", () => {
		const credentials = btoa("nocolon");
		const request = new Request("https://example.com/admin", {
			headers: {
				Authorization: `Basic ${credentials}`,
			},
		});
		const env = {
			BASIC_AUTH_USER: "admin",
			BASIC_AUTH_PASSWORD: "password",
		} as Env;

		const result = requireBasicAuthOnAdmin(request, env);

		expect(result).not.toBeNull();
		expect(result?.status).toBe(401);
	});
});

