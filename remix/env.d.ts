export {};

declare global {
	interface Env {
		readonly DB: D1Database;
		readonly USE_MEMORY_STORE?: string;
		readonly ENVIRONMENT_STAGE?: string;
		readonly CF_PAGES_URL?: string;
		readonly BASIC_AUTH_USER?: string;
		readonly BASIC_AUTH_PASSWORD?: string;
	}
}
