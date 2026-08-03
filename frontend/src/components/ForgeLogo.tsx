import React from "react";

export type ForgeLogoProps = {
  variant?: "full" | "emblem" | "header" | "collapsed";
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
};

export function ForgeEmblem({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <img
      src="/logo-square.png"
      alt="Forge Emblem"
      className={`${className} object-contain select-none`}
    />
  );
}

export default function ForgeLogo({ variant = "full", className = "", size = "md" }: ForgeLogoProps) {
  const imageHeights = {
    sm: "h-7",
    md: "h-10",
    lg: "h-12",
    xl: "h-16"
  };

  const emblemSizes = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-11 w-11",
    xl: "h-14 w-14"
  };

  if (variant === "emblem" || variant === "collapsed") {
    return (
      <div className={`flex items-center justify-center shrink-0 ${className}`}>
        <img
          src="/logo-square.png"
          alt="Forge Emblem"
          className={`${emblemSizes[size]} object-contain select-none transition-all`}
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center select-none shrink-0 ${className}`}>
      <img
        src="/logo-horizontal.png"
        alt="Forge India Connect Pvt. Ltd."
        className={`${imageHeights[size]} w-auto object-contain max-w-full brightness-105 transition-all`}
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = "none";
        }}
      />
    </div>
  );
}
