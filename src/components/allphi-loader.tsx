import Image from "next/image";
import { cn } from "@/lib/utils";

type AllphiLoaderProps = {
  size?: number;
  className?: string;
};

export function AllphiLoader({ size = 24, className }: AllphiLoaderProps) {
  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      aria-hidden
    >
      <Image
        src="/icons/allphi-logo-transparent.png"
        alt=""
        width={size}
        height={size}
        className="animate-spin object-contain"
        priority
      />
    </span>
  );
}
