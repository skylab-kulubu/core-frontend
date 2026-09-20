function oauthIssuer(): string {
  return (process.env.OAUTH2_ISSUER || '').replace(/\/+$/, '');
}

function oauthEndpoint(path: string): string {
  const issuer = oauthIssuer();
  return issuer ? `${issuer}/protocol/openid-connect/${path}` : '';
}

function oauthClientId(): string {
  return process.env.OAUTH2_CLIENT_ID || '';
}

function oauthClientSecret(): string | undefined {
  return process.env.OAUTH2_CLIENT_SECRET;
}

function oauthRedirectUri(): string {
  return process.env.OAUTH2_REDIRECT_URI || '';
}

export function getOAuth2AuthUrl(state?: string): string {
  const clientId = oauthClientId();
  const redirectUri = oauthRedirectUri();
  const authUrl = oauthEndpoint('auth');
  if (!clientId || !redirectUri || !authUrl) {
    return '/login?error=config_missing';
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    ...(state && { state }),
  });

  return `${authUrl}?${params.toString()}`;
}

export function getOAuth2LogoutUrl(postLogoutRedirectUri?: string): string {
  const logoutUrl = oauthEndpoint('logout');
  if (!logoutUrl || !oauthClientId()) {
    return '/login?error=config_missing';
  }
  const params = new URLSearchParams({
    client_id: oauthClientId(),
    ...(postLogoutRedirectUri && { post_logout_redirect_uri: postLogoutRedirectUri }),
  });

  return `${logoutUrl}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
): Promise<{ access_token: string; refresh_token: string }> {
  const clientId = oauthClientId();
  const redirectUri = oauthRedirectUri();
  const clientSecret = oauthClientSecret();
  const tokenUrl = oauthEndpoint('token');
  if (!clientId || !redirectUri || !tokenUrl) {
    throw new Error('OAuth2 configuration is incomplete');
  }
  const bodyParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  if (clientSecret) {
    bodyParams.append('client_secret', clientSecret);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token exchange failed:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
      clientId,
      redirectUri,
      hasClientSecret: !!clientSecret,
    });
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string }> {
  const clientId = oauthClientId();
  const clientSecret = oauthClientSecret();
  const tokenUrl = oauthEndpoint('token');
  if (!clientId || !tokenUrl) {
    throw new Error('OAuth2 configuration is incomplete');
  }
  const bodyParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  if (clientSecret) {
    bodyParams.append('client_secret', clientSecret);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token refresh failed:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
  };
}
