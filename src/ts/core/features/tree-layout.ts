import {browser} from 'webextension-polyfill-ts'

import {Feature, Settings} from 'src/core/settings'
import {PanelElement} from 'src/core/features/vim-mode/roam/roam-panel'
import {RoamEvent} from 'src/core/features/vim-mode/roam/roam-event'
import {waitForSelectorToExist} from 'src/core/common/mutation-observer'
import {Selectors} from 'src/core/roam/selectors'
import {assumeExists} from 'src/core/common/assert'

export const config: Feature = {
    id: 'tree_layout',
    name: 'Layout Pages in a Tree',
    warning: 'Experimental; Intrusive, may interfere with your regular workflow',
    enabledByDefault: false,
}

const PANEL_SELECTOR = 'roam-toolkit--panel'

const toggleTreeLayoutDependingOnSetting = () => {
    Settings.isActive('tree_layout').then(active => {
        if (active) {
            startTreeLayoutMode()
        } else {
            stopTreeLayoutMode()
        }
    })
}

browser.runtime.onMessage.addListener(async message => {
    if (message === 'settings-updated') {
        toggleTreeLayoutDependingOnSetting()
    }
})

toggleTreeLayoutDependingOnSetting()

const LAST_SELECTED_PANEL_CSS = 'roam-toolkit--source-panel'

type PanelId = string
type PanelIdOrMain = string | null

class ExplorationTree {
    panelToParent: Map<PanelId, PanelIdOrMain>

    constructor() {
        this.panelToParent = new Map()
    }

    add(parentId: PanelIdOrMain, panelId: PanelId) {
        if (!this.panelToParent.has(panelId)) {
            this.panelToParent.set(panelId, parentId)
        }
    }

    updateToMatchSidebar() {
        this.adoptOrphanedPages()
        this.cleanMissingPanels()
    }

    private adoptOrphanedPages() {
        this.panelToParent.forEach((parentId, panelId) => {
            if (parentId && !document.getElementById(parentId)) {
                // the main panel is the ultimate grand parent
                const grandParent = this.panelToParent.get(parentId) || null
                this.panelToParent.set(panelId, grandParent)
            }
        })
    }

    private cleanMissingPanels() {
        this.panelToParent.forEach((_, panelId) => {
            if (!document.getElementById(panelId)) {
                this.panelToParent.delete(panelId)
            }
        })
    }

    toString() {
        return this.panelToParent
    }
}

const explorationTree = new ExplorationTree()

// null means the main panel
let justClickedPanelId: PanelIdOrMain = null
const saveParentPanel = (interactedElement: HTMLElement) => {
    const justClickedPanel = interactedElement.closest(`.${PANEL_SELECTOR}`)
    if (!justClickedPanel) {
        return
    }
    document.querySelectorAll(`.${LAST_SELECTED_PANEL_CSS}`).forEach(selection => {
        selection.classList.remove(LAST_SELECTED_PANEL_CSS)
    })
    justClickedPanel.classList.add(LAST_SELECTED_PANEL_CSS)
    justClickedPanelId = justClickedPanel.id || null
}

const rememberLastInteractedPanel = () => {
    document.addEventListener('click', event => {
        saveParentPanel(event.target as HTMLElement)
    })
    RoamEvent.onEditBlock(saveParentPanel)
}

const startTreeLayoutMode = async () => {
    await waitForSelectorToExist(Selectors.mainContent)
    rememberLastInteractedPanel()

    const updateExplorationTree = () => {
        const panels = Array.from(document.querySelectorAll(Selectors.sidebarPage)) as PanelElement[]
        panels.forEach(panelElement => {
            assignPanelId(panelElement)
            panelElement.classList.add('roam-toolkit--panel')
            explorationTree.add(justClickedPanelId, panelElement.id)
        })
        explorationTree.updateToMatchSidebar()
        layoutSidePanels()
        console.log(explorationTree)
    }

    RoamEvent.onSidebarToggle(updateExplorationTree)
    RoamEvent.onSidebarChange(updateExplorationTree)
}

const getPanelId = (panelElement: PanelElement): string => {
    const header = assumeExists(panelElement.querySelector('[draggable] > .level2, [draggable] > div')) as HTMLElement
    const headerText = assumeExists(header.innerText)
    if (headerText === 'Block Outline') {
        return assumeExists(panelElement.querySelector(Selectors.block)?.id)
    }
    return headerText
}

const assignPanelId = (panelElement: PanelElement) => {
    panelElement.id = `roam-toolkit--panel: ${getPanelId(panelElement)}`
}

const layoutSidePanels = () => {}

const stopTreeLayoutMode = () => {}
