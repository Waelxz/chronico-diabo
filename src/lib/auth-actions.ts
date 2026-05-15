'use server';

import { AuthError } from 'next-auth';
import bcrypt from 'bcryptjs';
import { createUser, getUserByEmail } from '@/lib/db/users';
import { signIn, signOut } from '@/lib/auth';

type AuthActionResult = {
  success: boolean;
  error?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signInWithGoogle(formData?: FormData) {
  const redirectToValue = formData?.get('callbackUrl');
  const redirectTo =
    typeof redirectToValue === 'string' && isSafeRedirect(redirectToValue)
      ? redirectToValue
      : '/';
  await signIn('google', { redirectTo });
}

export async function signOutCurrentUser() {
  await signOut();
}

export async function signInWithCredentials(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === 'CredentialsSignin') {
        return {
          success: false,
          error: 'Email ou mot de passe incorrect.',
        };
      }
      return {
        success: false,
        error: 'Connexion impossible pour le moment.',
      };
    }
    throw error;
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
): Promise<AuthActionResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return { success: false, error: 'Adresse email invalide.' };
  }

  if (password.length < 8) {
    return {
      success: false,
      error: 'Le mot de passe doit contenir au moins 8 caractères.',
    };
  }

  if (!normalizedName) {
    return { success: false, error: 'Le nom est obligatoire.' };
  }

  const existingUser = await getUserByEmail(normalizedEmail);
  if (existingUser) {
    return { success: false, error: 'Un compte existe déjà avec cet email.' };
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  let createdUser;
  try {
    createdUser = await createUser({
      email: normalizedEmail,
      hashedPassword,
      name: normalizedName,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { success: false, error: 'Un compte existe déjà avec cet email.' };
    }
    throw error;
  }

  if (!createdUser) {
    return {
      success: false,
      error: 'Base de données indisponible. Réessayez plus tard.',
    };
  }

  return signInWithCredentials(normalizedEmail, password);
}

function isSafeRedirect(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
