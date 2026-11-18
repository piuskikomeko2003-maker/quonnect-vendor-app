"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export interface AdSlide {
  id: string;
  image: string;
  title: string;
  link?: string | null;
  active?: boolean;
}

const AUTOPLAY_MS = 5000;
const SWIPE_THRESHOLD = 42;

function PosterLink({
  slide,
  isCurrent,
}: {
  slide: AdSlide;
  isCurrent: boolean;
}) {
  if (!slide.link) return null;
  const external = /^https?:\/\//i.test(slide.link);

  if (external) {
    return (
      <a
        href={slide.link}
        target="_blank"
        rel="noreferrer"
        className="ad-slide-link"
        aria-label={slide.title}
        tabIndex={isCurrent ? 0 : -1}
      />
    );
  }

  return (
    <Link
      href={slide.link}
      className="ad-slide-link"
      aria-label={slide.title}
      tabIndex={isCurrent ? 0 : -1}
    />
  );
}

export function AdCarousel({ slides }: { slides: AdSlide[] }) {
  const items = slides.filter((slide) => slide.active !== false);
  const total = items.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const drag = useRef({ x: 0, y: 0, tracking: false });
  const moved = useRef(false);
  const current = total ? index % total : 0;

  const goTo = useCallback(
    (next: number) => {
      if (!total) return;
      setIndex(((next % total) + total) % total);
    },
    [total],
  );

  useEffect(() => {
    if (paused || total < 2) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % total);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [paused, total]);

  if (!total) return null;

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    drag.current = { x: event.clientX, y: event.clientY, tracking: true };
    moved.current = false;
    setPaused(true);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.tracking) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    drag.current.tracking = false;

    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      moved.current = true;
      goTo(current + (dx < 0 ? 1 : -1));
    }
    setPaused(false);
  }

  function handlePointerCancel() {
    drag.current.tracking = false;
    setPaused(false);
  }

  return (
    <div
      className="ad-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured posters"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDragStart={(event) => event.preventDefault()}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setPaused(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setPaused(false);
      }}
      onClickCapture={(event) => {
        if (!moved.current) return;
        moved.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        className="ad-track"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {items.map((slide, slideIndex) => {
          const isCurrent = slideIndex === current;
          const hasFailed = Boolean(failed[slide.id]);

          return (
            <div
              key={slide.id}
              className="ad-slide"
              aria-hidden={!isCurrent}
            >
              {!hasFailed ? <div className="ad-skeleton sk" /> : null}

              {hasFailed ? (
                <div className="ad-fallback">
                  <span className="ad-fallback-icon">
                    <Icon name="store" size={26} />
                  </span>
                  <strong>{slide.title}</strong>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slide.image}
                  alt={slide.title}
                  draggable={false}
                  loading={slideIndex === 0 ? "eager" : "lazy"}
                  onError={() =>
                    setFailed((prev) => ({ ...prev, [slide.id]: true }))
                  }
                />
              )}

              <PosterLink slide={slide} isCurrent={isCurrent} />
            </div>
          );
        })}
      </div>

      {total > 1 ? (
        <div className="ad-dots" aria-label="Choose poster">
          {items.map((slide, dotIndex) => (
            <button
              key={slide.id}
              type="button"
              className={`ad-dot${dotIndex === current ? " on" : ""}`}
              aria-label={`Show poster ${dotIndex + 1}: ${slide.title}`}
              aria-current={dotIndex === current}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => goTo(dotIndex)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
