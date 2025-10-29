import { afterEach } from "vitest";
import { webcrypto } from "node:crypto";
import { resetRepositoriesForTests } from "./app/repositories/database.server";

if (!globalThis.crypto) {
	// Vitest (Node environment) does not expose the Web Crypto API by default.
	globalThis.crypto = webcrypto as unknown as Crypto;
}

afterEach(() => {
	resetRepositoriesForTests();
});
