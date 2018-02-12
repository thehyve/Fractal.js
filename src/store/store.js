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
    locked: false,
    expanded: false
  },
  subsets: [],
  filters: {
    ids: []
  },
  options: {
    controlPanelPosition: 'left'
  }
}

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
