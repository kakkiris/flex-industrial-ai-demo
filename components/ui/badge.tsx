import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Visual revamp 2026-05-27. Two-mode badge:
// - default: brand-indigo pill, used ONLY for the demo-ID chip on the home grid
// - outline: rounded-sm data-tag, used for confidence/source/inline tags
// New shared StatusPill component handles tone-tinted status badges; the
// generic Badge stays minimal so callers can opt into the right shape.
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "rounded-sm bg-primary text-primary-foreground font-mono text-[11px] tracking-tight [a]:hover:bg-primary/90",
        secondary:
          "rounded-sm bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "rounded-sm bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "rounded-sm border-border text-foreground-muted [a]:hover:bg-foreground/[0.04] [a]:hover:text-foreground",
        ghost:
          "rounded-sm hover:bg-foreground/[0.04] hover:text-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
