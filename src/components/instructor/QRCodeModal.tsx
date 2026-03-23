"use client";

import { useRef } from "react";
import { X, Download } from "lucide-react";
import QRCode from "react-qr-code";

interface QRCodeModalProps {
  url: string;
  onClose: () => void;
}

export default function QRCodeModal({ url, onClose }: QRCodeModalProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, 0, 0, 512, 512);
      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = "MyCareerPath_가입QR.png";
      link.href = pngUrl;
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-lg">학생 가입 QR 코드</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          ref={qrRef}
          className="flex justify-center p-4 bg-white rounded-lg"
        >
          <QRCode value={url} size={256} />
        </div>

        <p className="text-sm text-gray-500 text-center mt-3 break-all">
          {url}
        </p>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 bg-purple-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-purple-600 transition"
          >
            <Download className="w-4 h-4" />
            이미지 다운로드
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-200 transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
