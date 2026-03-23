"use client";

import { useState } from "react";
import { Copy, FileDown, Mail, Loader2, Check } from "lucide-react";

interface ResultActionBarProps {
  onCopy: () => Promise<boolean> | boolean;
  onPDF: () => void;
  onEmail?: () => Promise<void>;
  emailDisabled?: boolean;
  emailTooltip?: string;
  hideEmail?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export default function ResultActionBar({
  onCopy,
  onPDF,
  onEmail,
  emailDisabled = false,
  emailTooltip,
  hideEmail = false,
  size = "sm",
  className = "",
}: ResultActionBarProps) {
  const [copied, setCopied] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleCopy = async () => {
    const result = await onCopy();
    if (result) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEmail = async () => {
    if (!onEmail || emailDisabled) return;
    setIsSendingEmail(true);
    try {
      await onEmail();
    } finally {
      setIsSendingEmail(false);
    }
  };

  const btnBase = size === "sm"
    ? "flex items-center gap-1.5 text-xs px-2 py-1 rounded"
    : "flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg";

  const btnStyle = `${btnBase} text-gray-500 hover:text-purple-500 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-purple-400 transition-colors`;
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button onClick={handleCopy} className={btnStyle} title="클립보드 복사">
        {copied ? <Check className={`${iconSize} text-green-500`} /> : <Copy className={iconSize} />}
        {copied ? "복사됨" : "복사"}
      </button>
      <button onClick={onPDF} className={btnStyle} title="PDF 다운로드">
        <FileDown className={iconSize} />
        PDF
      </button>
      {onEmail && !hideEmail && (
        <button
          onClick={handleEmail}
          disabled={emailDisabled || isSendingEmail}
          className={`${btnStyle} ${emailDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
          title={emailTooltip || "이메일 발송"}
        >
          {isSendingEmail ? <Loader2 className={`${iconSize} animate-spin`} /> : <Mail className={iconSize} />}
          이메일
        </button>
      )}
    </div>
  );
}
