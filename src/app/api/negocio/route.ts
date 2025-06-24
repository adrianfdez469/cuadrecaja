import { prisma } from "@/lib/prisma";
import { hasSuperAdminPrivileges } from "@/utils/auth";
import { NextResponse } from "next/server";
import dayjs from 'dayjs';

export async function GET() {
  try {
    const negocios = await prisma.negocio.findMany();
    
    return NextResponse.json(negocios);
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error cargar los negocios' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {

    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const futureDate = dayjs().add(3, 'month').set('hour', 23).set('minute', 59).set('second', 0).set('millisecond', 0);

    const { nombre, locallimit, userlimit, productlimit } = await request.json();
    

    const newNegocio = await prisma.negocio.create({
      data: { 
        nombre, 
        limitTime: futureDate.toISOString(), 
        locallimit, 
        userlimit,
        productlimit: productlimit || 0 // Default a 0 si no se especifica
      },
    });
    return NextResponse.json(newNegocio, { status: 201 });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al crear el negocio' }, { status: 500 });
  }
}