import React, { ReactNode } from "react";

interface MobileContainerProps {
  children: ReactNode;
  className?: string;
}

export default function MobileContainer({
  children,
  className = "",
}: MobileContainerProps) {
  return (
    // Outer Background (Desktop)
    <div className="h-dvh w-full bg-neutral-900 flex items-center justify-center p-0 md:p-4">
      {/* Phone Frame */}
      {/* Changed h-[100dvh] to h-dvh explicitly */}
      <div
        className={`
        relative w-full max-w-md bg-black text-white 
        h-dvh md:h-[850px] md:max-h-[90vh]
        md:rounded-3xl md:border-4 md:border-neutral-800 md:shadow-2xl
        overflow-hidden flex flex-col
        ${className}
      `}
      >
        {/* Content Area */}
        {/* We use flex-1 to allow pages to control their own vertical spacing */}
        <main className="flex-1 w-full h-full overflow-y-auto scrollbar-hide">
          {children}
        </main>

        {/* Bottom Notch (Desktop Visual Only) */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-neutral-800 rounded-full md:block hidden opacity-50 pointer-events-none" />
      </div>
    </div>
  );
}
