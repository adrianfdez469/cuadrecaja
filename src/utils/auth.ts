import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { roles } from "./roles";

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function isVendedor() {
  const session = await getSession();
  return session?.user?.rol === roles.SUPER_ADMIN;
}

export async function isAdmin() {
  const session = await getSession();
  return session?.user?.rol === roles.ADMIN;
}

export async function isSuperAdmin() {
  const session = await getSession();
  return session?.user?.rol === roles.SUPER_ADMIN;
}

export async function hasAdminPrivileges() {
  const session = await getSession();
  return session?.user?.rol === roles.SUPER_ADMIN || session?.user?.rol === roles.ADMIN;
}
export async function hasSuperAdminPrivileges() {
  const session = await getSession();
  return session?.user?.rol === roles.SUPER_ADMIN;
}
