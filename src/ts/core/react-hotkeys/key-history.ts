// @ts-ignore this internal import is needed to workaround a react-hotkeys issue
import KeyEventManager from 'react-hotkeys/es/lib/KeyEventManager'

import {Handler} from 'src/core/react-hotkeys/key-handler'

/**
 * React hotkeys activates `g g` twice when pressing `g g g`,
 * because it listens to a "rolling window" of keyChords
 *
 * Clear the key history after each sequence using this workaround:
 * https://github.com/greena13/react-hotkeys/issues/255#issuecomment-558199060
 */
export const clearKeyPressesAfterFinishingKeySequence = (handler: Handler): Handler => async event => {
    await handler(event)
    KeyEventManager.getInstance()._clearKeyHistory()
}