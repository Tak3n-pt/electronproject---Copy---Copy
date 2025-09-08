import { useEffect } from 'react';

export function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Check for command/control key combinations
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      
      shortcuts.forEach(({ key, ctrl, shift, alt, callback }) => {
        const keyMatch = event.key.toLowerCase() === key.toLowerCase();
        const ctrlMatch = ctrl ? isCtrlOrCmd : !isCtrlOrCmd;
        const shiftMatch = shift ? event.shiftKey : !event.shiftKey;
        const altMatch = alt ? event.altKey : !event.altKey;
        
        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          callback();
        }
      });

      // ESC key to close modals
      if (event.key === 'Escape') {
        const modals = document.querySelectorAll('[data-modal="true"]');
        if (modals.length > 0) {
          event.preventDefault();
          // Trigger close on the topmost modal
          const closeEvent = new CustomEvent('close-modal');
          document.dispatchEvent(closeEvent);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Common shortcuts
export const SHORTCUTS = {
  QUICK_SEARCH: { key: 'k', ctrl: true, description: 'Quick Search' },
  NEW_PRODUCT: { key: 'n', ctrl: true, description: 'New Product' },
  NEW_DEBT: { key: 'd', ctrl: true, description: 'New Debt' },
  DASHBOARD: { key: '1', ctrl: true, description: 'Go to Dashboard' },
  INVENTORY: { key: '2', ctrl: true, description: 'Go to Inventory' },
  DEBTS: { key: '3', ctrl: true, description: 'Go to Debts' },
  REFRESH: { key: 'r', ctrl: true, description: 'Refresh Data' },
  HELP: { key: '/', ctrl: true, description: 'Show Help' },
};