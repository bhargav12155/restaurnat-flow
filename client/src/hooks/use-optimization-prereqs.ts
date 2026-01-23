import { useMemo } from "react";

interface OptimizationPrereqsParams {
  contentType: string;
  topic: string;
  lastGenerated: { content?: string } | null;
  selectedMenuItem: any | null;
  isGenerating: boolean;
  isPending: boolean;
}

interface ChecklistItem {
  id: string;
  label: string;
  isMet: boolean;
}

interface OptimizationPrereqsResult {
  ready: boolean;
  unmetReasons: string[];
  checklistItems: ChecklistItem[];
}

function validateOptimizationPrereqs(
  params: OptimizationPrereqsParams
): OptimizationPrereqsResult {
  const {
    contentType,
    topic,
    lastGenerated,
    selectedMenuItem,
    isGenerating,
    isPending,
  } = params;

  const checklistItems: ChecklistItem[] = [];
  const unmetReasons: string[] = [];

  // Check 1: Must have generated content to optimize
  const hasContent = Boolean(lastGenerated?.content);
  checklistItems.push({
    id: "has-content",
    label: "Generated content available",
    isMet: hasContent,
  });
  if (!hasContent) {
    unmetReasons.push("Generate content first before optimizing");
  }

  // Check 2: Topic validation (for non-menu_item_feature types)
  if (contentType !== "menu_item_feature") {
    const hasTopic = topic.trim().length > 0;
    checklistItems.push({
      id: "has-topic",
      label: "Topic specified",
      isMet: hasTopic,
    });
    if (!hasTopic) {
      unmetReasons.push("Enter a topic for your content");
    }
  }

  // Check 3: Menu item selection (for menu_item_feature type)
  if (contentType === "menu_item_feature") {
    const hasMenuItem = Boolean(selectedMenuItem);
    checklistItems.push({
      id: "has-menu-item",
      label: "Menu item selected",
      isMet: hasMenuItem,
    });
    if (!hasMenuItem) {
      unmetReasons.push("Select a menu item to feature");
    }
  }

  // Check 4: Not currently generating
  const notGenerating = !isGenerating && !isPending;
  checklistItems.push({
    id: "not-generating",
    label: "Ready to optimize",
    isMet: notGenerating,
  });
  if (!notGenerating) {
    unmetReasons.push("Wait for current operation to complete");
  }

  const ready = unmetReasons.length === 0;

  return {
    ready,
    unmetReasons,
    checklistItems,
  };
}

export function useOptimizationPrereqs(
  params: OptimizationPrereqsParams
): OptimizationPrereqsResult {
  return useMemo(
    () => validateOptimizationPrereqs(params),
    [
      params.contentType,
      params.topic,
      params.lastGenerated?.content,
      params.selectedMenuItem,
      params.isGenerating,
      params.isPending,
    ]
  );
}
