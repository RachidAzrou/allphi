"use client";

import { FileText, Download, ExternalLink } from "lucide-react";

interface DocumentItem {
  type: string;
  filename: string;
  date?: string;
  url?: string;
}

interface DocumentListCardProps {
  data: {
    documents: DocumentItem[];
  };
}

export function DocumentListCard({ data }: DocumentListCardProps) {
  const { documents } = data;

  if (!documents || documents.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-[#DCE6EE] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="bg-[#E8F4FB] px-4 py-3 border-b border-[#DCE6EE]">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#2799D7]" />
          <span className="text-sm font-heading font-semibold text-[#163247]">
            Documenten
          </span>
          <span className="text-xs text-[#5F7382] ml-auto">
            {documents.length} {documents.length === 1 ? "document" : "documenten"}
          </span>
        </div>
      </div>
      <div className="divide-y divide-[#DCE6EE]">
        {documents.map((doc, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 hover:bg-[#F7F9FC] transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-[#E8F4FB] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-[#2799D7]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#163247] truncate">
                {doc.type}
              </p>
              <p className="text-xs text-[#5F7382] truncate">{doc.filename}</p>
            </div>
            {doc.url && (
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-[#E8F4FB] text-[#5F7382] hover:text-[#2799D7] transition-colors"
              >
                {doc.url.startsWith("http") ? (
                  <ExternalLink className="w-4 h-4" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
