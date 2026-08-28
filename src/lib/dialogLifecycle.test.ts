import { describe, expect, it, vi } from 'vitest'
import { openDialogLifecycle } from './dialogLifecycle'
import type { DialogLike } from './dialogLifecycle'

type CloseListener = () => void
type Scheduler = (dispatch: () => void) => void

/** Fires the dialog's queued 'close' dispatch inline, as part of close(). */
const immediateScheduler: Scheduler = (dispatch) => dispatch()
/** Fires it on the microtask queue, e.g. `queueMicrotask`. */
const microtaskScheduler: Scheduler = (dispatch) => queueMicrotask(dispatch)
/** Fires it on a macrotask, e.g. `setTimeout(fn, 0)`. */
const macrotaskScheduler: Scheduler = (dispatch) => setTimeout(dispatch, 0)

const SCHEDULERS: Array<[string, Scheduler]> = [
  ['immediate', immediateScheduler],
  ['microtask', microtaskScheduler],
  ['macrotask', macrotaskScheduler],
]

/** Awaits a real setTimeout(1ms), which drains all three schedulers above. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1))
}

/**
 * Models the WHATWG `<dialog>` element's `close()` contract closely enough
 * to reproduce G-03-5: `close()` synchronously flips `open` to false but
 * only QUEUES the 'close' event — per the spec, it "queue[s] an element
 * task on the user interaction task source... to fire an event named
 * close". The listener list is snapshotted at DISPATCH time (inside the
 * scheduled callback), not at the moment close() is called, matching real
 * `dispatchEvent` semantics: whichever listeners are attached WHEN the
 * queued task actually runs are the ones that receive the event, even if
 * they were attached after close() returned.
 */
class FakeDialog implements DialogLike {
  open = false
  #listeners: CloseListener[] = []
  #scheduler: Scheduler

  constructor(scheduler: Scheduler) {
    this.#scheduler = scheduler
  }

  showModal(): void {
    if (this.open) throw new Error('InvalidStateError: dialog is already open')
    this.open = true
  }

  close(): void {
    if (!this.open) return
    this.open = false
    this.#scheduler(() => {
      // Snapshot taken at dispatch time, not at close()-call time — this is
      // what makes a listener re-attached AFTER close() returns (but
      // before the queued task runs) the one that receives the event.
      const listenersCopy = [...this.#listeners]
      for (const listener of listenersCopy) listener()
    })
  }

  addEventListener(type: 'close', listener: CloseListener): void {
    if (type !== 'close') return
    this.#listeners.push(listener)
  }

  removeEventListener(type: 'close', listener: CloseListener): void {
    if (type !== 'close') return
    this.#listeners = this.#listeners.filter((l) => l !== listener)
  }
}

/**
 * Replicates 03-04's shipped implementation (commit 90ca09d) exactly:
 * attach a live handler, open if not already open, and a cleanup that
 * detaches the handler THEN closes unconditionally. Exists solely to prove
 * the harness has teeth — see the meta-test suite below.
 */
function legacyLifecycle(dialog: DialogLike, onDismiss: () => void): () => void {
  const handleClose = () => onDismiss()
  dialog.addEventListener('close', handleClose)
  if (!dialog.open) dialog.showModal()
  return () => {
    dialog.removeEventListener('close', handleClose)
    dialog.close()
  }
}

/**
 * Drives React StrictMode's dev-only mount double-invoke sequence (setup,
 * then cleanup, then setup again, all synchronously back to back with no
 * await between them) against whichever lifecycle function is passed in.
 * Returns the second (surviving) cleanup, matching what a real component
 * unmount would later call.
 */
function runStrictModeSequence(
  lifecycle: (dialog: DialogLike, onDismiss: () => void) => () => void,
  dialog: DialogLike,
  onDismiss: () => void,
): () => void {
  const cleanup1 = lifecycle(dialog, onDismiss)
  cleanup1()
  return lifecycle(dialog, onDismiss)
}

/** Binds a counter box into the two-argument lifecycle shape the helpers above expect. */
function withCounter(counter: { current: number }) {
  return (dialog: DialogLike, onDismiss: () => void) => openDialogLifecycle(dialog, onDismiss, counter)
}

describe('openDialogLifecycle', () => {
  for (const [name, scheduler] of SCHEDULERS) {
    describe(`[${name} dispatch]`, () => {
      it('test 1 (the gap) — StrictMode sequence leaves the dialog open with no dismissal call', async () => {
        const dialog = new FakeDialog(scheduler)
        const onDismiss = vi.fn()
        const counter = { current: 0 }
        runStrictModeSequence(withCounter(counter), dialog, onDismiss)
        await flush()
        expect(onDismiss).not.toHaveBeenCalled()
        expect(dialog.open).toBe(true)
      })

      it('test 2 — a visitor dismissal after the StrictMode sequence fires exactly once', async () => {
        const dialog = new FakeDialog(scheduler)
        const onDismiss = vi.fn()
        const counter = { current: 0 }
        runStrictModeSequence(withCounter(counter), dialog, onDismiss)
        await flush()

        // Escape, the backdrop handler and the Tanca button all funnel into
        // the dialog element's own close() — never through this module.
        dialog.close()
        await flush()

        expect(onDismiss).toHaveBeenCalledTimes(1)
        expect(dialog.open).toBe(false)
      })

      it('test 3 — a visitor dismissal on a plain single mount fires exactly once', async () => {
        const dialog = new FakeDialog(scheduler)
        const onDismiss = vi.fn()
        const counter = { current: 0 }
        openDialogLifecycle(dialog, onDismiss, counter)

        dialog.close()
        await flush()

        expect(onDismiss).toHaveBeenCalledTimes(1)
        expect(dialog.open).toBe(false)
      })

      it('test 4 — cleanup while still open (genuine unmount) closes without a dismissal call', async () => {
        const dialog = new FakeDialog(scheduler)
        const onDismiss = vi.fn()
        const counter = { current: 0 }
        const cleanup = openDialogLifecycle(dialog, onDismiss, counter)

        cleanup()
        await flush()

        expect(dialog.open).toBe(false)
        expect(onDismiss).not.toHaveBeenCalled()
      })

      it('test 5 — the suppression counter returns to 0 after the StrictMode sequence', async () => {
        const dialog = new FakeDialog(scheduler)
        const onDismiss = vi.fn()
        const counter = { current: 0 }
        runStrictModeSequence(withCounter(counter), dialog, onDismiss)
        await flush()

        // A leftover spurious call here is itself proof the counter
        // accounting is wrong: a correctly-absorbed close leaves nothing
        // to observe, on the callback or the counter.
        expect(onDismiss).not.toHaveBeenCalled()
        expect(counter.current).toBe(0)
      })

      it('test 6 — a second setup against an already-open dialog does not throw or reopen it', () => {
        const dialog = new FakeDialog(scheduler)
        const onDismiss = vi.fn()
        const counter = { current: 0 }
        openDialogLifecycle(dialog, onDismiss, counter)

        expect(() => openDialogLifecycle(dialog, onDismiss, counter)).not.toThrow()
        expect(dialog.open).toBe(true)
      })
    })
  }
})

describe('meta-test: the harness reproduces the original 03-04 (G-03-5) defect', () => {
  it('legacyLifecycle receives a spurious close under microtask dispatch', async () => {
    const dialog = new FakeDialog(microtaskScheduler)
    const onDismiss = vi.fn()
    runStrictModeSequence(legacyLifecycle, dialog, onDismiss)
    await flush()
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('legacyLifecycle receives a spurious close under macrotask dispatch', async () => {
    const dialog = new FakeDialog(macrotaskScheduler)
    const onDismiss = vi.fn()
    runStrictModeSequence(legacyLifecycle, dialog, onDismiss)
    await flush()
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('legacyLifecycle does NOT receive a spurious close under immediate dispatch (why 03-04 looked correct on paper)', async () => {
    const dialog = new FakeDialog(immediateScheduler)
    const onDismiss = vi.fn()
    runStrictModeSequence(legacyLifecycle, dialog, onDismiss)
    await flush()
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
