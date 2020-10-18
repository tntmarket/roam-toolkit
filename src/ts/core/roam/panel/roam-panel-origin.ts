import {DisconnectFn, listenToEvent} from 'src/core/common/event'
import {RoamEvent} from 'src/core/features/vim-mode/roam/roam-event'
import {PANEL_SELECTOR, PanelId, plainId} from 'src/core/roam/panel/roam-panel-utils'

let _justClickedPanelId: PanelId | null = null

const clearJustClickedPanel = () => {
    _justClickedPanelId = null
}

const saveJustClickedPanel = (interactedElement: HTMLElement) => {
    const justClickedPanelElement = interactedElement.closest(PANEL_SELECTOR)
    if (!justClickedPanelElement) {
        return
    }
    _justClickedPanelId = plainId(justClickedPanelElement.id)
}

export const justClickedPanelId = (): PanelId | null => _justClickedPanelId

/**
 * Spatial Graph Mode needs to know where new panels are opened from,
 * so it can draw edges between panels
 */
export const rememberLastInteractedPanel = (): DisconnectFn => {
    clearJustClickedPanel()
    const disconnectFns = [
        // Don't count the the previous panel as being the "origin" when navigating forward/back
        // Unfortunately, this also makes it so plain clicks don't create edges.
        // You need to shift+click to create the edge for spatial mode.
        listenToEvent('popstate', clearJustClickedPanel),
        listenToEvent('mousedown', event => saveJustClickedPanel(event.target as HTMLElement)),
        RoamEvent.onEditBlock(saveJustClickedPanel),
    ]
    return () => {
        clearJustClickedPanel()
        disconnectFns.forEach(disconnect => disconnect())
    }
}
