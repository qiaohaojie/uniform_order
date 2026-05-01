"use client";
import { createAuthClient } from "@neondatabase/auth/next";

export const authClient = createAuthClient();
export const { useSession, signIn, signOut, signUp } = authClient;
