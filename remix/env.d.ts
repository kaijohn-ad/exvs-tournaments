export {};

declare global {
	interface Env {
		readonly DB: D1Database;
	}
}
