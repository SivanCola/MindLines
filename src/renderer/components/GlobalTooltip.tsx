import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type TooltipPlacement = 'top' | 'bottom' | 'right';

type TooltipState = {
  anchor: HTMLElement;
  text: string;
};

type TooltipPosition = {
  top: number;
  left: number;
  visible: boolean;
  placement: TooltipPlacement;
  arrowLeft: number;
  arrowTop: number;
};

const POSITION_EPSILON = 0.5;

function stablePixel(value: number): number {
  return Math.round(value);
}

function normalizePosition(position: TooltipPosition): TooltipPosition {
  return {
    ...position,
    top: stablePixel(position.top),
    left: stablePixel(position.left),
    arrowLeft: stablePixel(position.arrowLeft),
    arrowTop: stablePixel(position.arrowTop)
  };
}

function samePixel(current: number, next: number): boolean {
  return Math.abs(current - next) <= POSITION_EPSILON;
}

function samePosition(current: TooltipPosition, next: TooltipPosition): boolean {
  return samePixel(current.top, next.top) &&
    samePixel(current.left, next.left) &&
    current.visible === next.visible &&
    current.placement === next.placement &&
    samePixel(current.arrowLeft, next.arrowLeft) &&
    samePixel(current.arrowTop, next.arrowTop);
}

export function GlobalTooltip() {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [position, setPosition] = useState<TooltipPosition>({
    top: 0,
    left: 0,
    visible: false,
    placement: 'top',
    arrowLeft: 0,
    arrowTop: 0
  });

  useEffect(() => {
    function findAnchor(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return null;
      }
      return target.closest<HTMLElement>('[data-tooltip]');
    }

    function showTooltip(target: EventTarget | null) {
      const anchor = findAnchor(target);
      const text = anchor?.dataset.tooltip?.trim();
      if (!anchor || !text || anchor.matches(':disabled, [aria-disabled="true"]')) {
        setTooltip(null);
        return;
      }
      setTooltip((current) => (current?.anchor === anchor && current.text === text ? current : { anchor, text }));
    }

    function hideTooltip(target: EventTarget | null) {
      const nextAnchor = findAnchor(target);
      setTooltip((current) => (current?.anchor && nextAnchor === current.anchor ? current : null));
    }

    const handlePointerOver = (event: PointerEvent) => showTooltip(event.target);
    const handlePointerMove = (event: PointerEvent) => showTooltip(event.target);
    const handlePointerOut = (event: PointerEvent) => hideTooltip(event.relatedTarget);
    const handleFocusIn = (event: FocusEvent) => showTooltip(event.target);
    const handleFocusOut = (event: FocusEvent) => hideTooltip(event.relatedTarget);

    document.addEventListener('pointerover', handlePointerOver);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerout', handlePointerOut);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('pointerover', handlePointerOver);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerout', handlePointerOut);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  useEffect(() => {
    if (!tooltip) {
      setPosition((current) => (current.visible ? { ...current, visible: false } : current));
      return undefined;
    }

    const interval = window.setInterval(() => {
      if (!tooltip.anchor.isConnected) {
        setTooltip(null);
        return;
      }
      const nextText = tooltip.anchor.dataset.tooltip?.trim();
      if (!nextText) {
        setTooltip(null);
        return;
      }
      setTooltip((current) => (current && current.anchor === tooltip.anchor && current.text !== nextText ? { ...current, text: nextText } : current));
    }, 120);

    return () => window.clearInterval(interval);
  }, [tooltip]);

  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) {
      return undefined;
    }
    const activeTooltip = tooltip;
    let frameId = 0;

    function updatePosition() {
      if (!tooltipRef.current) {
        return;
      }
      if (!activeTooltip.anchor.isConnected) {
        setTooltip(null);
        return;
      }

      const viewportGap = 10;
      const offset = 10;
      const anchorRect = activeTooltip.anchor.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const anchorCenterX = anchorRect.left + anchorRect.width / 2;
      const anchorCenterY = anchorRect.top + anchorRect.height / 2;
      const maxLeft = Math.max(viewportGap, window.innerWidth - tooltipRect.width - viewportGap);
      const maxTop = Math.max(viewportGap, window.innerHeight - tooltipRect.height - viewportGap);
      const preferRight = activeTooltip.anchor.closest('.activity-bar') || activeTooltip.anchor.dataset.tooltipPlacement === 'right';

      if (preferRight) {
        const left = Math.min(Math.max(viewportGap, anchorRect.right + offset), maxLeft);
        const top = Math.min(Math.max(viewportGap, anchorCenterY - tooltipRect.height / 2), maxTop);
        const nextPosition: TooltipPosition = {
          top,
          left,
          visible: true,
          placement: 'right',
          arrowLeft: 0,
          arrowTop: Math.min(Math.max(12, anchorCenterY - top), tooltipRect.height - 12)
        };
        const normalizedPosition = normalizePosition(nextPosition);
        setPosition((current) => (samePosition(current, normalizedPosition) ? current : normalizedPosition));
        return;
      }

      const preferredTop = anchorRect.top - tooltipRect.height - offset;
      const placement: TooltipPlacement = preferredTop >= viewportGap ? 'top' : 'bottom';
      const rawTop = placement === 'top' ? preferredTop : anchorRect.bottom + offset;
      const top = Math.min(Math.max(viewportGap, rawTop), maxTop);
      const left = Math.min(Math.max(viewportGap, anchorCenterX - tooltipRect.width / 2), maxLeft);

      const nextPosition: TooltipPosition = {
        top,
        left,
        visible: true,
        placement,
        arrowLeft: Math.min(Math.max(12, anchorCenterX - left), tooltipRect.width - 12),
        arrowTop: 0
      };
      const normalizedPosition = normalizePosition(nextPosition);
      setPosition((current) => (samePosition(current, normalizedPosition) ? current : normalizedPosition));
    }

    function scheduleUpdatePosition() {
      if (frameId) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updatePosition();
      });
    }

    scheduleUpdatePosition();
    window.addEventListener('resize', scheduleUpdatePosition);
    window.addEventListener('scroll', scheduleUpdatePosition, true);
    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener('resize', scheduleUpdatePosition);
      window.removeEventListener('scroll', scheduleUpdatePosition, true);
    };
  }, [tooltip]);

  if (!tooltip) {
    return null;
  }

  const tooltipStyle = {
    top: position.top,
    left: position.left,
    '--tooltip-arrow-left': `${position.arrowLeft}px`,
    '--tooltip-arrow-top': `${position.arrowTop}px`
  } as CSSProperties;

  return createPortal(
    <div ref={tooltipRef} className={`global-tooltip ${position.visible ? 'visible' : ''} ${position.placement}`} style={tooltipStyle} role="tooltip">
      {tooltip.text}
    </div>,
    document.body
  );
}
