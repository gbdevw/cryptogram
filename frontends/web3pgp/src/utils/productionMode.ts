/**
 * Production mode utilities
 * Disables console logging and dev tools in production
 */

/**
 * Suppress console logging in production
 * Keep errors and warnings visible for critical issues
 */
export function suppressConsoleLogs(): void {
  if (typeof window === 'undefined') {
    return // Skip on server side
  }

  const isDev = process.env.NODE_ENV === 'development'

  if (!isDev) {
    // Suppress debug logs and info logs in production
    const noop = () => {}
    
    // Keep errors and warnings visible
    console.log = noop
    console.debug = noop
    
    // You might want to keep errors and warnings, but suppress them if you want full silence:
    // console.error = noop
    // console.warn = noop
  }
}

/**
 * Disable developer tools in production
 */
export function disableDevTools(): void {
  if (typeof window === 'undefined') {
    return // Skip on server side
  }

  const isDev = process.env.NODE_ENV === 'development'

  if (!isDev) {
    // Disable F12, Ctrl+Shift+I, Cmd+Option+I dev tools shortcuts
    document.addEventListener('keydown', (e) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault()
      }
      // Ctrl+Shift+I (Windows/Linux)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault()
      }
      // Cmd+Option+I (Mac)
      if (e.metaKey && e.altKey && e.key === 'i') {
        e.preventDefault()
      }
      // Ctrl+Shift+K (Windows/Linux alternate)
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault()
      }
      // Cmd+Option+K (Mac alternate)
      if (e.metaKey && e.altKey && e.key === 'k') {
        e.preventDefault()
      }
    })

    // Detect if dev tools are open (basic detection)
    setInterval(() => {
      const threshold = 160
      if (
        window.outerHeight - window.innerHeight > threshold ||
        window.outerWidth - window.innerWidth > threshold
      ) {
        // Dev tools detected - you can log, redirect, or take action
        // For privacy, just return silently
      }
    }, 500)
  }
}

/**
 * Initialize production mode settings
 */
export function initializeProductionMode(): void {
  suppressConsoleLogs()
  disableDevTools()
}
