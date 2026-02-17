import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Career Path",
  description: "나의 커리어 로드맵 관리 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="font-pretendard antialiased">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
