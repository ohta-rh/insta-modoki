/** Two taps this close together (ms) are a double tap. */
export const DOUBLE_TAP_MS = 300;

/** Whether a tap at `now` is the second tap of a double tap that began with the tap at `previousAt`. */
export const isDoubleTap = (previousAt: number | null, now: number): boolean =>
  previousAt !== null && now >= previousAt && now - previousAt <= DOUBLE_TAP_MS;
