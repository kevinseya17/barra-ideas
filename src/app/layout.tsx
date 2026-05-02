import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BarraPRO — Control de inventario para eventos",
  description: "Sistema de inventario, ventas y cuadre de dinero para barras en eventos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
