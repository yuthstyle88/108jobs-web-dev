"use client";

import React from "react";
import {useJobFlowSidebar} from "@/modules/chat/contexts/JobFlowSidebarContext";

export default function JobFlowSidebar() {
  const {isOpen, setOpen, content} = useJobFlowSidebar();

  const desktop = "hidden md:flex md:static md:order-last h-full md:w-64 lg:w-80 xl:w-96 max-w-[360px] border-l bg-gray-50 shadow-none flex-col";
  const mobile = `md:hidden fixed top-16 sm:top-20 right-0 h-[calc(100vh-64px)] sm:h-[calc(100vh-80px)] w-[80vw] sm:w-[70vw] max-w-[360px] bg-white border-l shadow-xl z-40 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`;

  return (
    <>
      {/* Desktop static sidebar */}
      <aside className={desktop} role="complementary" aria-label="Job Flow Sidebar">
        {content}
      </aside>
      {/* Mobile slide-over */}
      {isOpen && (
        <aside className={mobile} role="dialog" aria-modal="true" aria-label="Job Flow Sidebar">
          {content}
        </aside>
      )}
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
