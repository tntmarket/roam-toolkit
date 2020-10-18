import {browser} from 'webextension-polyfill-ts'

import {Feature, Settings, Shortcut} from 'src/core/settings'
import {RoamEvent} from 'src/core/features/vim-mode/roam/roam-event'
import {waitForSelectorToExist} from 'src/core/common/mutation-observer'
import {Selectors} from 'src/core/roam/selectors'
import {assumeExists} from 'src/core/common/assert'
import {Mouse} from 'src/core/common/mouse'
import {getMode, Mode} from 'src/core/features/vim-mode/vim'
import {VimRoamPanel as RoamVimPanel} from 'src/core/features/vim-mode/roam/roam-vim-panel'
import {updateVimView} from 'src/core/features/vim-mode/vim-view'
import {PanelChange, RoamPanel} from 'src/core/roam/panel/roam-panel'
import {DisconnectFn, listenToEvent} from 'src/core/common/event'
import {GraphVisualization} from 'src/core/features/spatial-graph-mode/graph-visualization'
import {isVimModeOn} from 'src/core/features/vim-mode/vim-init'
import {GraphModeSettings} from 'src/core/features/spatial-graph-mode/graph-mode-settings'

/**
 * TODO Be able to resize nodes
 * https://github.com/iVis-at-Bilkent/cytoscape.js-node-editing
 * Need to impose dimensions if manually adjusted, but react to DOM otherwise
 *
 * TODO Be able to disable the graph mode, but still have it run in the background,
 * so it can be resumed
 *
 * TODO Maybe allow cutting edges with double click?
 */

export const spatialShortcut = (
    key: string,
    label: string,
    onPress: (graph: GraphVisualization) => void,
    selectMiddleNode: boolean = true
): Shortcut => ({
    type: 'shortcut',
    id: `spatialGraphMode_${label}`,
    label,
    initValue: key,
    onPress: event => {
        if (getMode() === Mode.NORMAL) {
            const graph = GraphVisualization.get()
            onPress(graph)

            if (selectMiddleNode) {
                graph.selectMiddleOfViewport()
            }
            // Avoid using the arrow keys for scroll, if they're bound.
            // But still allow regular keyboard navigation in insert mode
            event.preventDefault()
        }
    },
})

const panSpeed = () => Number.parseInt(GraphModeSettings.get('Keyboard Pan Speed'), 10)
const dragSpeed = () => Number.parseInt(GraphModeSettings.get('Keyboard Drag Speed'), 10)

export const config: Feature = {
    id: 'spatial_graph_mode',
    name: 'Spatial Graph Mode',
    warning: 'Will probably break custom css;',
    enabledByDefault: false,
    settings: [
        ...GraphModeSettings.all,
        spatialShortcut('Ctrl+ArrowUp', 'Zoom in', graph => graph.zoomBy(5 / 4)),
        spatialShortcut('Ctrl+ArrowDown', 'Zoom out', graph => graph.zoomBy(4 / 5)),
        spatialShortcut('Ctrl+0', 'Zoom in completely', graph => graph.zoomBy(10)),
        spatialShortcut('Ctrl+9', 'Zoom out completely', graph => graph.zoomOutCompletely()),
        spatialShortcut('ArrowLeft', 'Pan left', graph => graph.panBy(panSpeed(), 0)),
        spatialShortcut('ArrowDown', 'Pan down', graph => graph.panBy(0, -panSpeed())),
        spatialShortcut('ArrowUp', 'Pan up', graph => graph.panBy(0, panSpeed())),
        spatialShortcut('ArrowRight', 'Pan right', graph => graph.panBy(-panSpeed(), 0)),
        spatialShortcut('Shift+ArrowLeft', 'Move node left', graph => graph.dragSelectionBy(-dragSpeed(), 0), false),
        spatialShortcut('Shift+ArrowDown', 'Move node down', graph => graph.dragSelectionBy(0, dragSpeed()), false),
        spatialShortcut('Shift+ArrowUp', 'Move node up', graph => graph.dragSelectionBy(0, -dragSpeed()), false),
        spatialShortcut('Shift+ArrowRight', 'Move node right', graph => graph.dragSelectionBy(dragSpeed(), 0), false),
    ],
}

const toggleSpatialGraphModeDependingOnSetting = () => {
    Settings.isActive('spatial_graph_mode').then(active => {
        if (active) {
            // Re-initialize if a setting changed
            if (GraphVisualization.instance) {
                stopSpatialGraphMode()
            }
            startSpatialGraphMode()
        } else {
            stopSpatialGraphMode()
        }
    })
}

browser.runtime.onMessage.addListener(async message => {
    if (message === 'settings-updated') {
        toggleSpatialGraphModeDependingOnSetting()
    }
})

toggleSpatialGraphModeDependingOnSetting()

let disconnectFunctions: DisconnectFn[] = []
const startSpatialGraphMode = async () => {
    await GraphModeSettings.refresh()
    await waitForSelectorToExist(Selectors.mainContent)
    await GraphVisualization.init()
    const graph = GraphVisualization.get()

    const updateGraphToMatchOpenPanels = (panelChange: PanelChange) => {
        if (panelChange.renamedPanel) {
            graph.replaceNodeNames(panelChange.renamedPanel.before, panelChange.renamedPanel.after)
            return
        }

        panelChange.addedPanels?.forEach(({from, to}) => {
            graph.addNode(to, from)
        })

        panelChange.removedPanels?.forEach(panel => {
            // Only remove the panel if it's the last remaining one.
            // We don't want to remove the whole node, if it's just a dupe
            if (!RoamPanel.get(panel)) {
                graph.removeNode(panel)
            }
        })

        // Avoid having identical sidebar pages open
        const redundantPanels = Array.from(document.getElementsByClassName('roam-toolkit--panel-dupe')).filter(
            panelElement => !panelElement.classList.contains('roam-toolkit--panel-dupe-main')
        )
        if (redundantPanels.length > 0) {
            redundantPanels.forEach(panel => {
                const closeButton = panel.querySelector(Selectors.closeButton)
                if (closeButton) {
                    Mouse.leftClick(closeButton as HTMLElement)
                }
            })
            // Skip re-rendering, cause the sidebar pages will change after closing the panel anyways
            return
        }

        graph.ensureNodeIsSelected()
        graph.runLayout(panelChange.isInitialAdd)
    }

    graph.onSelectNode(nodeId => {
        if (isVimModeOn()) {
            const panel = assumeExists(RoamPanel.get(nodeId))
            RoamVimPanel.get(panel).select()
            updateVimView()
        }
    })

    disconnectFunctions = [
        listenToEvent('resize', () => graph.runLayout()),
        RoamEvent.onChangeBlock(() => graph.runLayout()),
        RoamEvent.onEditBlock(() => graph.runLayout()),
        RoamEvent.onBlurBlock(() => graph.runLayout()),
        RoamPanel.onPanelChange(updateGraphToMatchOpenPanels),
    ]
}

/**
 * Cleaning up is very important for Spatial Mode!
 * If some handlers aren't cleaned up, zombie handlers might break
 * vim mode, or future invocations of graph mode.
 */
const stopSpatialGraphMode = () => {
    disconnectFunctions.forEach(disconnect => disconnect())
    GraphVisualization.destroy()
}