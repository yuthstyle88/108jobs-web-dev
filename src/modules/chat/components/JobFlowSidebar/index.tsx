"use client";

import React from "react";
import {useJobFlowSidebar} from "@/modules/chat/contexts/JobFlowSidebarContext";

/**
 * The permanent Order/Media sidebar, desktop only.
 *
 * Mobile used to get a second copy of this as a fixed slide-over with a
 * backdrop, toggled from the header. It is now an in-flow pane inside
 * `ChatRoomView`, selected by `ChatRoomTabs` -- see that component for why.
 * The context's `isOpen` still exists and still means "the mobile Order pane
 * is showing"; this component simply no longer has an opinion about it, which
 * is what makes the desktop sidebar unconditional.
 */
export default function JobFlowSidebar() {
  const {content} = useJobFlowSidebar();

  return (
    <aside
      className="hidden md:flex md:static md:order-last h-full md:w-64 lg:w-80 xl:w-96 max-w-[360px] border-l bg-gray-50 shadow-none flex-col"
      role="complementary"
      aria-label="Job Flow Sidebar"
    >
      {content}
    </aside>
  );
}
