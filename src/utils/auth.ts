import { getServerSession } from "next-auth";
import { authOptions } from "./authOptions";
import { roles } from "./roles";

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function hasSuperAdminPrivileges() {
  const session = await getSession();
  return session?.user?.rol === roles.SUPER_ADMIN;
}