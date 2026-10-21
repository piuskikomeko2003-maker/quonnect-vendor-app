"use client";

import { signOutAction } from "@/actions/auth";

export function SignOutButton({ className = "btn out" }: { className?: string }) {
  return (
    <button className={className} onClick={() => void signOutAction()}>
      Log out
    </button>
  );
}
