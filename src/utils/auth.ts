import { getServerSession } from "next-auth";
import { authOptions } from "./authOptions";
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

export const hasPermision = async (rol: string) => {
  if ((await isSuperAdmin()) && rol !== roles.SUPER_ADMIN) return true;
  if ((await isAdmin()) && rol === roles.VENDEDOR) return true;
  return false;
};