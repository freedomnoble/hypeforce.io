import { type ReactNode } from "react";
import wordmarkAsset from "@/assets/hypeforce-wordmark-v2.png.asset.json";
import { SafeBg } from "@/components/hypeforce/safe-bg";

export function OnboardingLayout({
  step,
  total = 7,
  children,
}: {
  step: number;
  total?: number;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-start sm:justify-center px-4 py-6 sm:py-10 relative">
      <SafeBg />


      <div className="w-full max-w-[440px] relative z-10">
        <header className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <img src={wordmarkAsset.url} alt="Hypeforce" className="h-5 w-auto" />
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i + 1 < step
                    ? "w-4 bg-electric"
                    : i + 1 === step
                    ? "w-6 bg-electric"
                    : "w-4 bg-foreground/15"
                }`}
              />
            ))}
          </div>
        </header>

        <div className="glass-strong rounded-3xl p-6 sm:p-8 ring-glow">{children}</div>
      </div>
    </div>
  );
}

export function StepTitle({ children, subtitle }: { children: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">{children}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>}
    </div>
  );
}
