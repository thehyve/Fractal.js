import Vue from 'vue'
import Vuex from 'vuex'
import mutations from './mutations'
import getters from './getters'
import actions from './actions'

Vue.use(Vuex)

const state = {
  data: [],
  tasks: {},
  requestManager: null,
  chartManager: null,
  stateManager: null,
  controlPanel: {
    panels: [],
    locked: false
  },
  subsets: [],
  filters: {
    ids: {source: null, value: []}
  },
  options: {
    controlPanelPosition: 'left',
    controlPanelExpanded: false
  },
  init () {
    this.controlPanel.expanded = this.options.controlPanelExpanded
    return this
  }
}.init()

const store = new Vuex.Store({
  state,
  getters,
  actions,
  mutations
})

const initialState = JSON.parse(JSON.stringify(store.state))

export function resetState () {
  store.replaceState(JSON.parse(JSON.stringify(initialState)))
}

export default store
