/**
 * `/admin` 配下へのアクセスに対してBasic認証を要求する
 * 環境変数が未設定の場合は認証をスキップ（本番環境のみ設定して有効化）
 * @param request リクエストオブジェクト
 * @param env 環境変数オブジェクト
 * @returns 認証が必要な場合は401レスポンス、それ以外はnull
 */
export function requireBasicAuthOnAdmin(request: Request, env: Env): Response | null {
	const { BASIC_AUTH_USER, BASIC_AUTH_PASSWORD } = env;
	// 環境変数が未設定の場合は認証をスキップ（本番環境のみ設定して有効化）
	if (!BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD) {
		return null;
	}

	const { pathname } = new URL(request.url);
	// `/admin` 配下のパスかどうかを判定
	const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');
	if (!isAdminPath) {
		return null;
	}

	const header = request.headers.get('authorization') ?? '';
	const [scheme, encoded] = header.split(' ');

	// Authorizationヘッダが正しい形式でない場合は401を返す
	if (scheme?.toLowerCase() !== 'basic' || !encoded) {
		return new Response('Unauthorized', {
			status: 401,
			headers: {
				'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"',
			},
		});
	}

	// Base64デコードしてユーザー名とパスワードを取得
	let decoded = '';
	try {
		decoded = atob(encoded);
	} catch {
		// Base64デコードに失敗した場合は401を返す
		return new Response('Unauthorized', {
			status: 401,
			headers: {
				'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"',
			},
		});
	}

	const idx = decoded.indexOf(':');
	if (idx === -1) {
		// コロンが見つからない場合は401を返す
		return new Response('Unauthorized', {
			status: 401,
			headers: {
				'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"',
			},
		});
	}

	const user = decoded.slice(0, idx);
	const pass = decoded.slice(idx + 1);

	// ユーザー名とパスワードが一致しない場合は401を返す
	if (user !== BASIC_AUTH_USER || pass !== BASIC_AUTH_PASSWORD) {
		return new Response('Unauthorized', {
			status: 401,
			headers: {
				'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"',
			},
		});
	}

	// 認証成功
	return null;
}

