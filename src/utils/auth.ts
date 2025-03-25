import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function isAdmin() {
  const session = await getSession();
  return session?.user?.rol === "ADMIN";
}
