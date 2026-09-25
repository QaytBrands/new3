import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";

export default async function Home() {
  const user = await getCurrentUser();
  if (user?.role === "STUDENT") redirect("/dashboard");
  if (user) redirect("/admin");
  redirect("/login");
}
