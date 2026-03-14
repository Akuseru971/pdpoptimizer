"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WORKFLOW_STEPS } from "@/constants/workflow";
import { StepProgress } from "@/components/workflow/step-progress";
import { ProductInputStep } from "@/components/forms/product-input-step";
import { PdpAuditStep } from "@/components/audit/pdp-audit-step";
import { TitleOptimizerStep } from "@/components/forms/title-optimizer-step";
import { ImagePlanStep } from "@/components/forms/image-plan-step";
import { ContactFinderStep } from "@/components/forms/contact-finder-step";
import { PdpPreviewStep } from "@/components/pdp/pdp-preview-step";
import { ExportStep } from "@/components/export/export-step";
import { Button } from "@/components/ui/button";

export function WorkflowShell() {
  const [stepIndex, setStepIndex] = useState(0);

  const stepContent = useMemo(() => {
    switch (stepIndex) {
      case 0:
        return <ProductInputStep />;
      case 1:
        return <PdpAuditStep />;
      case 2:
        return <TitleOptimizerStep />;
      case 3:
        return <ImagePlanStep />;
      case 4:
        return <ContactFinderStep />;
      case 5:
        return <PdpPreviewStep />;
      case 6:
        return <ExportStep />;
      default:
        return null;
    }
  }, [stepIndex]);

  return (
    <section className="space-y-5">
      <StepProgress currentStep={stepIndex} />

      <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">{stepContent}</div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0}>
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>

        <div className="text-sm text-zinc-500 dark:text-zinc-300">{WORKFLOW_STEPS[stepIndex]}</div>

        <Button
          onClick={() => setStepIndex((value) => Math.min(WORKFLOW_STEPS.length - 1, value + 1))}
          disabled={stepIndex === WORKFLOW_STEPS.length - 1}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
