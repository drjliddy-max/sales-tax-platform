import { useState, useEffect } from 'react';

/**
 * Custom hook to track media query matches
 * @param query - The media query string (e.g., '(max-width: 768px)')
 * @returns boolean - Whether the media query matches
 */
export function useMediaQuery(query: string): boolean {
  // Initialize with false to prevent hydration mismatches in SSR
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Check if window is available (client-side)
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    
    // Set initial value
    setMatches(mediaQuery.matches);

    // Define the event listener
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add event listener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    // Cleanup function
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // Fallback for older browsers
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
}

/**
 * Hook for common breakpoints
 */
export function useBreakpoint() {
  const isXs = useMediaQuery('(max-width: 475px)');
  const isSm = useMediaQuery('(max-width: 640px)');
  const isMd = useMediaQuery('(max-width: 768px)');
  const isLg = useMediaQuery('(max-width: 1024px)');
  const isXl = useMediaQuery('(max-width: 1280px)');
  const is2Xl = useMediaQuery('(max-width: 1536px)');

  // Current breakpoint detection
  const getCurrentBreakpoint = (): string => {
    if (isXs) return 'xs';
    if (isSm) return 'sm';
    if (isMd) return 'md';
    if (isLg) return 'lg';
    if (isXl) return 'xl';
    if (is2Xl) return '2xl';
    return '3xl';
  };

  return {
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    is2Xl,
    currentBreakpoint: getCurrentBreakpoint(),
    isMobile: isMd,
    isTablet: !isMd && isLg,
    isDesktop: !isLg
  };
}

/**
 * Hook for specific device detection
 */
export function useDeviceDetection() {
  const [userAgent, setUserAgent] = useState('');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUserAgent(window.navigator.userAgent);
    }
  }, []);

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
  const isChrome = /Chrome/.test(userAgent);
  const isFirefox = /Firefox/.test(userAgent);

  return {
    isMobile,
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isFirefox,
    userAgent
  };
}

/**
 * Hook for orientation detection
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateOrientation = () => {
      if (window.screen?.orientation) {
        setOrientation(window.screen.orientation.angle === 0 || window.screen.orientation.angle === 180 ? 'portrait' : 'landscape');
      } else {
        // Fallback for browsers that don't support screen.orientation
        setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
      }
    };

    // Set initial orientation
    updateOrientation();

    // Listen for orientation changes
    const handleOrientationChange = () => {
      // Small delay to ensure dimensions are updated
      setTimeout(updateOrientation, 100);
    };

    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    } else {
      // Fallback for older browsers
      window.addEventListener('orientationchange', handleOrientationChange);
      window.addEventListener('resize', updateOrientation);
    }

    return () => {
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange);
      } else {
        window.removeEventListener('orientationchange', handleOrientationChange);
        window.removeEventListener('resize', updateOrientation);
      }
    };
  }, []);

  return orientation;
}

/**
 * Hook for touch device detection
 */
export function useTouchDevice() {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkTouch = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore - for older browsers
        navigator.msMaxTouchPoints > 0
      );
    };

    checkTouch();
  }, []);

  return isTouchDevice;
}
