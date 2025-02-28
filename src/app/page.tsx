import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

export default async function Home() {
  const session = await getServerSession();

  if (session) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }

  // This won't be reached, but is needed for TypeScript
  return null;
}
