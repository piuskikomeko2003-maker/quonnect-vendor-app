"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

const NATIVE_SCHEME = "com.quonnect.vendor:";

/** Map com.quonnect.vendor:///auth/confirm?code=... to an in-app route. */
function inAppPath(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== NATIVE_SCHEME) return null;
    const path = url.host ? `/${url.host}${url.pathname}` : url.pathname || "/";
    return `${path}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * Native-only glue: dark status bar icons, splash screen dismissal, and
 * routing Supabase email deep links back into the bundled app.
 */
export function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;
    let removeListener: (() => void) | undefined;

    const open = (url: string) => {
      const path = inAppPath(url);
      if (path) router.push(path);
    };

    async function setup() {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
      } catch {
        // Status bar plugin is optional at runtime.
      }

      const launch = await App.getLaunchUrl();
      if (active && launch?.url) open(launch.url);

      const listener = await App.addListener("appUrlOpen", (event) => open(event.url));
      removeListener = () => void listener.remove();

      try {
        await SplashScreen.hide();
      } catch {
        // Splash screen plugin is optional at runtime.
      }
    }

    void setup();

    return () => {
      active = false;
      removeListener?.();
    };
  }, [router]);

  return null;
}
