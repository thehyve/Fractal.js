import types from './mutation-types'

export default {
  [types.SET_DATA] (state, data) {
    state.data = data
  },
  [types.SET_REQUEST_MANAGER] (state, manager) {
    state.requestManager = manager
  },
  [types.SET_SUBSETS] (state, subsets) {
    state.subsets = subsets
  }
}