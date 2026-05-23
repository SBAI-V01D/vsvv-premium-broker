import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop — Scrollt bei jeder Navigation automatisch nach oben
 * Wird global in App.jsx eingebunden und betrifft alle Seiten
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scrollt sofort nach oben bei Routenänderung
    window.scrollTo(0, 0);
  }, [pathname]);

  return null; // Rendert nichts, ist nur ein Helper
}