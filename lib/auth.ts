import { NextAuthOptions } from "next-auth"

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "yahoo",
      name: "Yahoo",
      type: "oauth",
      clientId: process.env.YAHOO_CLIENT_ID,
      clientSecret: process.env.YAHOO_CLIENT_SECRET,
      issuer: "https://api.login.yahoo.com",
      wellKnown: "https://api.login.yahoo.com/.well-known/openid-configuration",
      authorization: {
        url: "https://api.login.yahoo.com/oauth2/request_auth",
        params: {
          scope: "openid profile email fspt-r",
          response_type: "code",
        },
      },
      token: "https://api.login.yahoo.com/oauth2/get_token",
      userinfo: "https://api.login.yahoo.com/openid/v1/userinfo",
      client: {
        authorization_signed_response_alg: "ES256",
        id_token_signed_response_alg: "ES256",
      },
      checks: ["pkce", "nonce"],
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        }
      },
    },
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
        return token
      }

      // Return previous token if it hasn't expired yet
      if (Date.now() < (token.expiresAt as number) * 1000) {
        return token
      }

      // Token has expired, try to refresh it
      console.log('Access token expired, attempting refresh...')

      try {
        const response = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(
              `${process.env.YAHOO_CLIENT_ID}:${process.env.YAHOO_CLIENT_SECRET}`
            ).toString('base64')}`,
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: token.refreshToken as string,
          }),
        })

        const refreshedTokens = await response.json()

        if (!response.ok) {
          console.error('Token refresh failed:', refreshedTokens)
          throw new Error('Token refresh failed')
        }

        console.log('Token refreshed successfully')

        return {
          ...token,
          accessToken: refreshedTokens.access_token,
          refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
          expiresAt: Math.floor(Date.now() / 1000 + refreshedTokens.expires_in),
        }
      } catch (error) {
        console.error('Error refreshing access token:', error)
        // Return token with error flag so we can handle it on the frontend
        return {
          ...token,
          error: 'RefreshAccessTokenError',
        }
      }
    },
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken as string
      session.refreshToken = token.refreshToken as string
      session.expiresAt = token.expiresAt as number
      session.error = token.error as string | undefined
      return session
    },
  },
  pages: {
    signIn: '/',
  },
}
