/**
 * True where buttons open dialogs by themselves (`commandfor` / `command="show-modal"`).
 * Where it is false, an onClick handler has to call `showModal()` instead; where it is true,
 * calling it too would open the dialog twice (the browser warns).
 */
export function supportsCommandInvokers(): boolean {
  return typeof HTMLButtonElement !== 'undefined' && 'command' in HTMLButtonElement.prototype;
}
