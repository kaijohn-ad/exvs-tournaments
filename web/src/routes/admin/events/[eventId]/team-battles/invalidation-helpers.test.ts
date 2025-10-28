import { describe, expect, it } from 'vitest';
import { getInvalidateResource, shouldInvalidateTeamBattles } from './invalidation-helpers';

const createForm = (success: boolean) => ({
	success,
	type: success ? 'success' : 'error',
	source: 'create'
});

describe('invalidate helpers', () => {
	it('getInvalidateResource returns expected key', () => {
		expect(getInvalidateResource('abc')).toBe('team-battles:abc');
	});

	it('shouldInvalidateTeamBattles returns true when success and browser', () => {
		expect(shouldInvalidateTeamBattles(createForm(true), true)).toBe(true);
	});

	it('shouldInvalidateTeamBattles returns false when not browser', () => {
		expect(shouldInvalidateTeamBattles(createForm(true), false)).toBe(false);
	});

	it('shouldInvalidateTeamBattles returns false when form missing', () => {
		expect(shouldInvalidateTeamBattles(undefined, true)).toBe(false);
	});

	it('shouldInvalidateTeamBattles returns false when success false', () => {
		expect(shouldInvalidateTeamBattles(createForm(false), true)).toBe(false);
	});
});
