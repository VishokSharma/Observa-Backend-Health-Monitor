export function safeExecute(fn: () => void) {
  try {
    fn();
  } catch {
    
  }
}
