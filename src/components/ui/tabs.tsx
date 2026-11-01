"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

const tabsListVariants = cva("inline-flex items-center text-muted-foreground", {
  variants: {
    // default: the boxed/pill style (bg-muted container, each active trigger
    // gets its own background pill) - used by InvoiceGrid/InvoiceTable/
    // TagsTable's status filters. line: an underline style (no container
    // background, a border under the whole list, active trigger gets its
    // own bottom-border indicator) - for a plainer, form-like tab switch.
    variant: {
      default: "h-9 w-fit justify-center gap-1 rounded-lg bg-muted p-1",
      line: "w-full justify-start gap-6 border-b border-border",
    },
  },
  defaultVariants: { variant: "default" },
})

function TabsList({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "flex-1 rounded-md border border-transparent px-3 py-1 focus-visible:border-ring data-[state=active]:bg-background data-[state=active]:shadow-sm",
        line: "border-b-2 border-transparent px-0.5 pb-3 text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

function TabsTrigger({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & VariantProps<typeof tabsTriggerVariants>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
