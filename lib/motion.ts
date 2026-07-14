"use client";

import { animate, stagger } from "animejs";

// All UI motion goes through anime.js. Every helper is a no-op when the
// user asks the OS for reduced motion.
function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type Targets = Element | Element[] | NodeListOf<Element> | null | undefined;

export function fadeInUp(targets: Targets) {
  if (!targets || reducedMotion()) return;
  animate(targets, {
    opacity: [0, 1],
    translateY: [8, 0],
    duration: 220,
    ease: "outQuad",
  });
}

export function staggerIn(targets: Targets) {
  if (!targets || reducedMotion()) return;
  const list = "length" in (targets as NodeListOf<Element>)
    ? Array.from(targets as NodeListOf<Element>)
    : [targets as Element];
  if (list.length === 0) return;
  animate(list, {
    opacity: [0, 1],
    translateY: [6, 0],
    delay: stagger(22),
    duration: 200,
    ease: "outQuad",
  });
}

export function slideInLeft(targets: Targets) {
  if (!targets) return;
  if (reducedMotion()) return;
  animate(targets, {
    translateX: ["-100%", "0%"],
    duration: 240,
    ease: "outQuad",
  });
}

export function fadeIn(targets: Targets, duration = 180) {
  if (!targets || reducedMotion()) return;
  animate(targets, { opacity: [0, 1], duration, ease: "outQuad" });
}
