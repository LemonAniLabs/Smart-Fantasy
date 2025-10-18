import NextAuth, { NextAuthOptions } from "next-auth"

const authOptions: NextAuthOptions = {
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
      }
      return token
    },
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken as string
      session.refreshToken = token.refreshToken as string
      session.expiresAt = token.expiresAt as number
      return session
    },
  },
  pages: {
    signIn: '/',
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
