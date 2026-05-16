import NextAuth from 'next-auth';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { migrateGlucoseLogsUserId } from '@/lib/db/glucose';
import { getUserByEmail, upsertOAuthUser } from '@/lib/db/users';
import { getEnv } from '@/lib/env';

const env = getEnv();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  trustHost: true,
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        const email =
          typeof credentials.email === 'string'
            ? credentials.email.trim().toLowerCase()
            : '';
        const password =
          typeof credentials.password === 'string' ? credentials.password : '';

        if (!EMAIL_PATTERN.test(email) || password.length < 8) return null;

        const user = await getUserByEmail(email);
        if (!user?.hashedPassword) return null;

        const validPassword = await bcrypt.compare(password, user.hashedPassword);
        if (!validPassword) return null;

        return {
          id: user._id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (account?.provider === 'google') {
        const oauthEmail = coerceString(user.email);
        if (!oauthEmail) return token;

        const appUser = await upsertOAuthUser({
          email: oauthEmail,
          name: coerceString(user.name),
          image: coerceString(user.image),
          emailVerified: hasVerifiedEmail(profile) ? new Date() : null,
        });
        const previousSub = coerceString(token.sub) ?? coerceString(user.id);
        if (appUser) {
          token.sub = appUser._id;
          token.email = appUser.email;
          token.name = appUser.name;
          token.picture = appUser.image;
          if (previousSub) {
            await migrateGlucoseLogsUserId(previousSub, appUser._id);
          }
        }
        return token;
      }

      const tokenEmail = coerceString(token.email);
      if (tokenEmail && (!token.sub || !ObjectId.isValid(token.sub))) {
        const appUser = await upsertOAuthUser({
          email: tokenEmail,
          name: coerceString(token.name),
          image: coerceString(token.picture),
          emailVerified: null,
        });
        const previousSub = coerceString(token.sub);
        if (appUser) {
          token.sub = appUser._id;
          token.name = appUser.name;
          token.picture = appUser.image;
          if (previousSub) {
            await migrateGlucoseLogsUserId(previousSub, appUser._id);
          }
        }
        return token;
      }

      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});

function coerceString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function hasVerifiedEmail(profile: unknown): boolean {
  return (
    typeof profile === 'object' &&
    profile !== null &&
    'email_verified' in profile &&
    profile.email_verified === true
  );
}
