import {KeyChord} from './key-chord'


export type KeySequenceString = string

/**
 * These keys should not trigger other handlers in the middle of an existing handler.
 * Allow the others to run concurrently though, so the UI feels more responsive.
 */
const KEYS_THAT_WE_ALSO_SIMULATE: KeySequenceString[] = ['Escape']

/**
 * A "KeySequence" is a series of one or more KeyChords to press in succession, separated by space.
 * For example: 'g g' or just 'alt+D'
 */
export class KeySequence {
    public keyChords: KeyChord[]

    constructor(keyChords: KeyChord[]) {
        this.keyChords = keyChords
    }

    usesMultipleKeyChords(): boolean {
        return this.keyChords.length > 1
    }

    mightBeSimulated(): boolean {
        return KEYS_THAT_WE_ALSO_SIMULATE.includes(this.toString())
    }

    toString(): string {
        return this.keyChords.join(' ')
    }

    map(mapFn: (keyChord: KeyChord) => KeyChord): KeySequence {
        return new KeySequence(this.keyChords.map(mapFn))
    }

    /**
     * @return a list of key sequence strings, in Mousetrap style:
     *         https://github.com/greena13/react-hotkeys#defining-key-maps
     */
    toMouseTrapSyntax(): KeySequenceString[] {
        return this.keySequencesForBothHeldAndInitialPress().map(keySequence => keySequence.toString())
    }

    /**
     * Pressing down "shift+j" triggers "shift+j", but _holding_ it down triggers _just_ "J".
     * Binding just "J" should trigger the action in both cases.
     *
     * @return a list of alternative key sequences that should all trigger the same handler
     */
    private keySequencesForBothHeldAndInitialPress(): KeySequence[] {
        const keyChord = this.keyChords[0]
        if (keyChord.isCapitalLetter() && !this.usesMultipleKeyChords()) {
            return [this, this.map(keyChord => keyChord.convertCapitalToShiftAndLowercase())]
        }

        return [this.map(keyChord => keyChord.convertCapitalToShiftAndLowercase())]
    }

    static fromString(keySequenceString: KeySequenceString) {
        return new KeySequence(keySequenceString.split(' ').map(KeyChord.fromString))
    }
}