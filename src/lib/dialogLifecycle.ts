/**
 * Structural contract for a native `<dialog>`-like element, narrowed to the
 * `close` event only. A real `HTMLDialogElement` satisfies this
 * structurally (no cast needed at the call site) because DOM lib methods
 * are declared with method-shorthand syntax, which TypeScript checks
 * bivariantly against a narrower listener signature.
 */
export interface DialogLike {
  readonly open: boolean
  showModal(): void
  close(): void
  addEventListener(type: 'close', listener: () => void): void
  removeEventListener(type: 'close', listener: () => void): void
}

/**
 * Opens `dialog` and wires its native `close` event to `onDismiss`,
 * returning a cleanup function. Absorbs exactly one spurious close per
 * lifecycle-initiated close via `suppressCounter`, regardless of when the
 * browser dispatches the `close` event (G-03-5).
 *
 * The WHATWG spec's `close()` algorithm does not dispatch the `close`
 * event synchronously — it "queue[s] an element task on the user
 * interaction task source... to fire an event named close", i.e. the event
 * fires later, as a separately queued browser task. React StrictMode's
 * dev-only mount double-invoke (setup -> cleanup -> setup) runs entirely
 * synchronously within one effect-flush pass, well before that queued task
 * can run. So a cleanup-initiated `close()` (StrictMode's simulated
 * unmount) does not necessarily dispatch its event into the listener that
 * was attached when `close()` was called — it can land on a NEW listener
 * re-attached by the very next (synchronous) setup, before the queued
 * event ever fires. Ordering the cleanup as "detach listener, then close"
 * (the first fix attempt, G-03-2/90ca09d) only defends against a
 * hypothetical SYNCHRONOUS dispatch into the OLD listener; it does nothing
 * against this actual asynchronous one.
 *
 * The caller-owned `suppressCounter` makes the fix independent of that
 * timing entirely. Every cleanup-initiated close increments the counter by
 * one BEFORE calling `close()` — i.e. before the browser can possibly
 * dispatch the resulting event, under any dispatch timing — and every
 * close handler decrements the counter and swallows the event (instead of
 * invoking `onDismiss`) whenever the counter is above zero. Whichever
 * handler happens to be attached when the queued event eventually fires
 * (the old one, under a synchronous dispatch, or a new one re-attached by
 * an interleaved StrictMode remount) reads the same shared counter and
 * absorbs the same close exactly once.
 */
export function openDialogLifecycle(
  dialog: DialogLike,
  onDismiss: () => void,
  suppressCounter: { current: number },
): () => void {
  const handleClose = () => {
    if (suppressCounter.current > 0) {
      suppressCounter.current -= 1
      return
    }
    onDismiss()
  }

  dialog.addEventListener('close', handleClose)
  if (!dialog.open) dialog.showModal()

  return () => {
    // Order carries the whole fix. Incrementing BEFORE close() (rather than
    // detaching first) means: under a synchronous dispatch, the
    // still-attached handler consumes the count immediately, during this
    // very close() call; under a queued dispatch, the handler attached by
    // the NEXT setup consumes it later, once the queued task finally runs.
    // Either way exactly one close event is absorbed per lifecycle-initiated
    // close, and the counter returns to zero. Guarding both the increment
    // and the close on the element being open means a cleanup that follows
    // a genuine dismissal (element already closed) neither closes again nor
    // leaves a phantom count behind that would eat the visitor's next real
    // dismissal.
    if (dialog.open) {
      suppressCounter.current += 1
      dialog.close()
    }
    dialog.removeEventListener('close', handleClose)
  }
}
