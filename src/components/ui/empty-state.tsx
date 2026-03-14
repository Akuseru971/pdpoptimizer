import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/60">
      <Icon className="mb-3 h-7 w-7 text-zinc-400" />
      <h4 className="font-semibold">{title}</h4>
      <p className="mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-300">{description}</p>
    </div>
  );
}
