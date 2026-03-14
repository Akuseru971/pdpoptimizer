export const WORKFLOW_STEPS = [
  "Product Input",
  "PDP Audit",
  "Title Optimization",
  "Image Plan",
  "Contact Finder",
  "Preview PDP",
  "Export",
] as const;

export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];
