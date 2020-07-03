import {Set} from 'immutable'
import {KEY_TO_UNSHIFTED} from 'src/core/common/keycodes'

export type KeyChordString = string

type Modifier = 'alt' | 'shift' | 'control' | 'command'

/**
 * A "KeyChord" is a single combination of one or more keys
 * For example: 'command+x' or just 'x'
 */
export class KeyChord {
    private readonly key: string
    private readonly modifiers: Set<Modifier>

    constructor(key: string, modifiers: Set<Modifier>) {
        this.key = key
        this.modifiers = modifiers
    }

    /**
     * Converts a shifted character to it's non-shifted character, plus the shift key
     *
     * Examples:
     * - D => shift+D
     * - alt+D => alt+shift+D
     * - d => d
     *
     * @return the keychord with capitals converted to shift+lowercase, or null if
     *         the key is already lowercase
     */
    convertCapitalToShiftAndLowercase(): KeyChord {
        const unshifted = KEY_TO_UNSHIFTED[this.key]
        if (unshifted) {
            return new KeyChord(unshifted, this.modifiers.add('shift'))
        }
        return this
    }

    toString(): string {
        return [...this.modifiers.values(), this.key].join('+')
    }

    static fromString(keyChordString: KeyChordString): KeyChord {
        const keys = keyChordString.split('+')
        return new KeyChord(keys.pop()!, Set(keys.map(modifier => modifier.toLowerCase() as Modifier)))
    }
}
