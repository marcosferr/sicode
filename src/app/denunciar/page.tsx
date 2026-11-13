import type { Metadata } from "next";
import { FormularioDenuncia } from "@/components/FormularioDenuncia";

export const metadata: Metadata = { title: "Presentar denuncia" };

export default function Denunciar() {
  return <FormularioDenuncia />;
}
