"use client";

import { Component } from "react";
import type { ReactNode } from "react";

export interface InlineErrorBoundaryProps {
  children: ReactNode;
  /** Rendered in place of `children` when they throw. */
  fallback: ReactNode;
}

interface InlineErrorBoundaryState {
  failed: boolean;
}

/**
 * An error boundary for ONE region of a screen.
 *
 * The only boundaries this repository had are `src/app/error.tsx` and
 * `src/app/global-error.tsx`, both route-segment ones: a rejected `next/dynamic`
 * promise climbs to them and REPLACES the whole screen. Inside a card, what
 * falls is the card's own region and nothing else (ADR 0099).
 */
export class InlineErrorBoundary extends Component<
  InlineErrorBoundaryProps,
  InlineErrorBoundaryState
> {
  constructor(props: Readonly<InlineErrorBoundaryProps>) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): InlineErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    // A CONSTANT message plus `error.name`, and NOTHING else: the message a
    // runtime builds quotes the data that broke it (E-031).
    console.error(
      "InlineErrorBoundary caught a render error",
      error?.name ?? "UnknownError",
    );
  }

  render(): ReactNode {
    if (this.state.failed === true) return this.props.fallback;
    return this.props.children;
  }
}

export default InlineErrorBoundary;
