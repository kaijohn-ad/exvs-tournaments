/**
 * UUID生成のヘルパー関数
 * ブラウザ環境とNode.js環境の両方で動作する
 */
export function generateUUID(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	
	// Node.js環境でのフォールバック
	if (typeof require !== 'undefined') {
		try {
			return require('crypto').randomUUID();
		} catch (error) {
			// crypto.randomUUID()が利用できない場合のフォールバック
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				const r = Math.random() * 16 | 0;
				const v = c === 'x' ? r : (r & 0x3 | 0x8);
				return v.toString(16);
			});
		}
	}
	
	// 最後のフォールバック（ブラウザ環境でcrypto.randomUUID()が利用できない場合）
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}
