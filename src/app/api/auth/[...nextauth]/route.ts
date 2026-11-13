import NextAuth from "next-auth";
import { opcionesAuth } from "@/lib/auth";

const manejador = NextAuth(opcionesAuth);
export { manejador as GET, manejador as POST };
