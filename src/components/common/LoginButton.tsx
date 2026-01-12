"use client";
import { useSession, signIn, signOut } from "next-auth/react";

export default function LoginButton() {
  const { data: session, status } = useSession();
  if (status === "loading") return null;

  if (session) {
    return (
      <>
        Signed in as {session.user?.email} <br />
        <button onClick={() => signOut()}>Sign out</button>
      </>
    );
  }
  return <button onClick={() => signIn("google")}>Sign in with Google</button>;
}
