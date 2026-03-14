"use client";

import { WORKFLOW_STEPS } from "@/constants/workflow";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface StepProgressProps {
  currentStep: number;
}

export function StepProgress({ currentStep }: StepProgressProps) {
  const progress = ((currentStep + 1) / WORKFLOW_STEPS.length) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Workflow Progress</p>
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Step {currentStep + 1} of {WORKFLOW_STEPS.length}
        </p>
      </div>
      <Progress value={progress} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        {WORKFLOW_STEPS.map((step, index) => {
          const done = index <= currentStep;
          return (
            <div
              key={step}
              className={cn(
                "rounded-xl border px-2 py-2 text-center text-xs font-medium transition-colors",
                done
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                  : "border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
              )}
            >
              {step}
            </div>
          );
        })}
      </div>
    </div>
  );
}
