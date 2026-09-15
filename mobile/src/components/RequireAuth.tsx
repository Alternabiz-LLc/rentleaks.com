import { router } from "expo-router";
import type { ReactNode } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { Screen } from "./Screen";
import { Button, EmptyState, type IconName } from "./ui";

export function RequireAuth({ children, icon, title, body }: { children: ReactNode; icon: IconName; title: string; body: string }) {
  const { user, ready } = useAuth();
  if (!ready) return <Screen>{null}</Screen>;
  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon={icon}
          title={title}
          body={body}
          action={<Button label="Sign in or create an account" onPress={() => router.push("/auth/sign-in")} />}
        />
      </Screen>
    );
  }
  return <>{children}</>;
}
