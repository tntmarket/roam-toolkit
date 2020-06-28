// @ts-ignore this internal import is needed to workaround a react-hotkeys issue
import {KeySequence} from './key-sequence'
import {clearKeyPressesAfterFinishingKeySequence} from 'src/core/react-hotkeys/key-history'

/**
 * A "Handler" is function to run in response to a keypress.
 * It may return a promise to indicate that the function is asynchronous, and
 * takes time to finish.
 */
export type Handler = (event: KeyboardEvent) => Promise<any> | undefined

let executingHandler = 0

const preventWhileOtherHandlersAreExecuting = (handler: Handler): Handler => {
    return async (event: KeyboardEvent) => {
        if (executingHandler === 0) {
            await trackIfHandlerIsExecuting(handler)(event)
        }
    }
}

const trackIfHandlerIsExecuting = (handler: Handler): Handler => async (event: KeyboardEvent) => {
    executingHandler += 1
    try {
        await handler(event)
    } catch (error) {
        console.error(error)
    }
    executingHandler -= 1
}

/**
 * If we artificially simulate a key press, that keypress should not
 * trigger our own hotkeys.
 *
 * For example, simulating "Esc" to unfocus a block should not trigger
 * our own hotkey for "Esc".
 *
 * @return a decorated version of a handler that does nothing if other
 *         handlers are running
 */
const dontTriggerWhenKeyPressIsSimulated = (keySequence: KeySequence, handler: Handler): Handler => {
    if (keySequence.mightBeSimulated()) {
        return preventWhileOtherHandlersAreExecuting(handler)
    } else {
        return trackIfHandlerIsExecuting(handler)
    }
}

export const adaptHandlerToReactHotkeys = (keySequence: KeySequence, handler: Handler) => {
    if (keySequence.usesMultipleKeyChords()) {
        handler = clearKeyPressesAfterFinishingKeySequence(handler)
    }
    return dontTriggerWhenKeyPressIsSimulated(keySequence, handler)
}
