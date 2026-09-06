import { memo, useEffect } from 'react';
import { useLocation } from 'react-router';

export type DatadogRumViewTrackerProps = {
  trackView: (name: string) => void;
};

export const DatadogRumViewTracker = memo(function DatadogRumViewTracker({ trackView }: DatadogRumViewTrackerProps) {
  const location = useLocation();

  useEffect(() => {
    trackView(location.pathname);
  }, [location.pathname, trackView]);

  return null;
});
DatadogRumViewTracker.displayName = 'DatadogRumViewTracker';
