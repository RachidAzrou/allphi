"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group rounded-xl border border-border bg-card text-foreground text-sm shadow-[0_20px_40px_rgba(24,28,32,0.06)]",
          error: "!bg-red-50 !border-red-100 !text-red-700",
          success: "!bg-green-50 !border-green-100 !text-green-700",
          warning: "!bg-amber-50 !border-amber-100 !text-amber-700",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
