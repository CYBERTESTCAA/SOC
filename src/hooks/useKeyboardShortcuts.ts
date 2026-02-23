import { useEffect, useCallback } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
}

const SHORTCUTS: ShortcutConfig[] = [];

/**
 * Hook pour gérer les raccourcis clavier globaux
 */
export function useKeyboardShortcuts(
  onNavigate: (view: string) => void,
  onRefresh?: () => void
) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignorer si on est dans un input/textarea
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const { key, ctrlKey, altKey, shiftKey } = event;

    // Navigation avec Ctrl + touche
    if (ctrlKey && !altKey && !shiftKey) {
      switch (key.toLowerCase()) {
        case 'd':
          event.preventDefault();
          onNavigate('dashboard');
          break;
        case 'i':
          event.preventDefault();
          onNavigate('incidents');
          break;
        case 'c':
          event.preventDefault();
          onNavigate('signins');
          break;
        case 'e':
          event.preventDefault();
          onNavigate('exchange');
          break;
        case 'a':
          event.preventDefault();
          onNavigate('devices');
          break;
        case 'p':
          event.preventDefault();
          onNavigate('settings');
          break;
        case 'r':
          if (onRefresh) {
            event.preventDefault();
            onRefresh();
          }
          break;
      }
    }

    // Raccourci Alt + touche pour actions rapides
    if (altKey && !ctrlKey && !shiftKey) {
      switch (key.toLowerCase()) {
        case 'n':
          event.preventDefault();
          // Ouvrir notifications (à implémenter)
          break;
        case 's':
          event.preventDefault();
          onNavigate('settings');
          break;
      }
    }

    // Échap pour fermer les modales
    if (key === 'Escape') {
      // Géré par les composants individuels
    }
  }, [onNavigate, onRefresh]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Liste des raccourcis disponibles pour affichage
 */
export const KEYBOARD_SHORTCUTS = [
  { keys: 'Ctrl + D', action: 'Dashboard', category: 'Navigation' },
  { keys: 'Ctrl + I', action: 'Incidents', category: 'Navigation' },
  { keys: 'Ctrl + C', action: 'Connexions', category: 'Navigation' },
  { keys: 'Ctrl + E', action: 'Exchange', category: 'Navigation' },
  { keys: 'Ctrl + A', action: 'Appareils', category: 'Navigation' },
  { keys: 'Ctrl + P', action: 'Paramètres', category: 'Navigation' },
  { keys: 'Ctrl + R', action: 'Actualiser', category: 'Actions' },
  { keys: 'Alt + S', action: 'Paramètres', category: 'Actions' },
  { keys: 'Escape', action: 'Fermer modal', category: 'Actions' },
];
