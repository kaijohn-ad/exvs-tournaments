export {};

declare global {
	interface Env {
		readonly DB: D1Database;
		readonly USE_MEMORY_STORE?: string;
	}
}
