import {range} from 'lodash'

import {Feature} from '../settings'
import {SRSSignal, SRSSignals} from './scheduler'
import {SM2Node} from './SM2Node'
import {AnkiScheduler} from './AnkiScheduler'
import {Roam} from '../roam/roam'
import {injectStyle} from 'src/core/common/css'

export const config: Feature = {
    id: 'srs',
    name: 'Spaced Repetition',
    settings: SRSSignals.map(it => ({
        type: 'shortcut',
        id: `srs_${SRSSignal[it]}`,
        label: `SRS: ${SRSSignal[it]}`,
        initValue: `ctrl+shift+${it}`,
        onPress: () => rescheduleCurrentNote(it),
    })),
}

export function rescheduleCurrentNote(signal: SRSSignal) {
    const scheduler = new AnkiScheduler()
    Roam.applyToCurrent(node => scheduler.schedule(new SM2Node(node.text, node.selection), signal))
}

const intervalStyle = (interval: string, nextReviewTip: string) => {
    return `
        [data-link-title^="[[interval]]:${interval}"] ~ [data-link-title]:last-child::before {
            content: "${nextReviewTip}";
        }
    `
}

const easeStyle = (ease: string, darkColor: string, lightColor: string) => {
    return `
        [data-link-title^="[[factor]]:${ease}"] ~ [data-link-title]:last-child::before {
            border: 1px solid ${darkColor};
            color: ${darkColor};
            background: ${lightColor};
        }
    `
}

injectStyle(
    `
    [data-link-title^="[[interval]]:"], [data-link-title^="[[factor]]:"] {
        display: none;
    }
    [data-link-title^="[[factor]]:"] ~ [data-link-title]:last-child::before {
        font-style: italic;
        margin-right: 6px;
        margin-left: -7px;
        padding: 3px 6px;
        border-radius: 6px;
        font-size: smaller;
        white-space: nowrap;
        position: relative;
        top: -1px;
    }
    ${intervalStyle('', '1+ month')}
    ${intervalStyle('1.', '1 day')}
    ${range(2, 6)
        .map(days => intervalStyle(`${days}.`, `${days + 1} days`))
        .join('\n')}
    ${range(7, 30)
        .map(days => intervalStyle(`${days}.`, `${Math.ceil(days / 7)} weeks`))
        .join('\n')}
    ${easeStyle('', 'darkgreen', 'honeydew')}
    ${easeStyle('1.', 'darkred', 'mistyrose')}
    ${easeStyle('2.', 'mediumblue', 'lightcyan')}
    `,
    'roam-toolkit--srs'
)
