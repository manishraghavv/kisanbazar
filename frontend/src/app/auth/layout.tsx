import type { ReactNode } from "react";
import { GuestGuard } from "@/components/auth/GuestGuard";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <GuestGuard>{children}</GuestGuard>;
}
