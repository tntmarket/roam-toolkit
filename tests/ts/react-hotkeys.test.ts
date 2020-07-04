import {KeyChord, KeyChordString} from 'src/core/react-hotkeys/key-chord'
import {KeySequence, KeySequenceString} from 'src/core/react-hotkeys/key-sequence'
import {blockConcurrentHandlingOfSimulatedKeys, Handler} from 'src/core/react-hotkeys/key-handler'
import {delay} from 'src/core/common/async'

jest.mock('src/core/react-hotkeys/key-history')

describe("Using a capital letter as shorthand for a shifted key", () => {
    it('converts capital letters to their shifted version', () => {
        expect(KeySequence.fromString('G').toMouseTrapSyntax()).toEqual('shift+g')
    })

    it('leaves lower case letters alone', () => {
        expect(KeySequence.fromString('g').toMouseTrapSyntax()).toEqual('g')
    })
})

describe('Normalizing key chords to have a consistent format', () => {
    const normalizeChord = (keyChordString: KeyChordString) =>
        KeyChord.fromString(keyChordString).convertCapitalToShiftAndLowercase().toString()

    it('Lower cases the letter and adds shift', () => {
        expect(normalizeChord('G')).toEqual('shift+g')
    })

    it('keeps the other modifiers while adding shift', () => {
        expect(normalizeChord('alt+G')).toEqual('alt+shift+g')
    })

    it('leaves lowercase letters alone', () => {
        expect(normalizeChord('g')).toEqual('g')
    })
})

describe('Not recursively triggering our own hotkeys when simulating keys for native actions', () => {
    const adaptHandler = (keySequenceString: KeySequenceString, handler: Handler): Handler =>
        blockConcurrentHandlingOfSimulatedKeys(KeySequence.fromString(keySequenceString), handler)

    it('lets handlers trigger when no other handler is running', () => {
        const ourCustomEscapeHotkey = jest.fn()
        const escapeHandler = adaptHandler('Escape', ourCustomEscapeHotkey)

        escapeHandler({} as KeyboardEvent)

        expect(ourCustomEscapeHotkey).toHaveBeenCalled()
    })

    it("should not trigger our own Escape hotkey when simulating 'Escape' from a different hotkey", async () => {
        const ourCustomEscapeHotkey = jest.fn()
        const escapeHandler = adaptHandler('Escape', ourCustomEscapeHotkey)
        const anotherHandler = adaptHandler('D', async () => {
            await delay(1)
            // Pretend that our handler simulates "Escape"
            escapeHandler({} as KeyboardEvent)
        })

        await anotherHandler({} as KeyboardEvent)

        expect(ourCustomEscapeHotkey).not.toHaveBeenCalled()
    })

    it("allows keys that aren't simulated to run while other hotkeys are running",async () => {
        const ourCustomHotkey = jest.fn()
        const handler = adaptHandler('J', async () => {
            await delay(1)
            // Pretend that our handler simulates "Escape"
            ourCustomHotkey({} as KeyboardEvent)
        })

        // Don't block hotkeys from executing by default, so repeated keys feel responsive
        handler({} as KeyboardEvent)
        await handler({} as KeyboardEvent)

        expect(ourCustomHotkey).toHaveBeenCalledTimes(2)
    })
})
