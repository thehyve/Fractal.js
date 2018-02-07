import store from '../store/store'

export default class {
  /**
   * For a given selector call back the given callback with the stateID whenever the state changes.
   * In short, this can be used to get a unique identifier for the current state of a chart and to restore it later on.
   * @param selector: Must identify a unique fjs-chart element.
   * @param callback: An arbitrary callback with one argument (the state ID).
   */
  chart2id (selector, callback) {
    let chartElement = document.querySelectorAll(selector)
    if (chartElement.length !== 1) {
      throw new Error('The given selector must point to exactly one element. ' +
        '#Elements for this selector: ' + chartElement.length)
    }
    chartElement = chartElement[0]
    if (typeof chartElement.__vue__ === 'undefined' || chartElement.__vue__.$options.name !== 'chart') {
      throw new Error('The given selector must point to a div element with class "fjs-chart". ' +
        'This is the div that replaced the placeholder when creating the chart initially.')
    }
    if (typeof chartElement.__vue__.$parent._setStateChangedCallback === 'undefined') {
      throw new Error('Cannot generate an id for this chart. It does not permit state saving.')
    }
    chartElement.__vue__.$parent._setStateChangedCallback(async function (name, state) {
      const rv = await store.getters.requestManager.saveState({chartName: name, chartState: state})
      const stateID = rv.data.state_id
      callback(stateID)
    })
  }

  /**
   * For a given state ID submit GET requests until state is available or until access is denied.
   * @param stateID. The id given to the callback in chart2id()
   * @returns {Promise}. Resolves with the requested state on success or rejects with an exception otherwise.
   */
  async getState (stateID) {
    function timeout (ms) {
      return new Promise(resolve => setTimeout(resolve, ms))
    }
    await store.getters.requestManager.requestStateAccess(stateID)
    let timeWaited = 0
    let delay = 200
    while (timeWaited <= 900000) {  // we wait 15 minutes
      await timeout(delay)
      timeWaited += delay
      delay += 100
      delay = delay > 3000 ? 3000 : delay
      const rv = await store.getters.requestManager.getState(stateID)
      if (rv.status === 200) {
        return rv.data.state
      }
    }
  }

  /**
   * For a given state id attempt to restore a chart as a child of the given selector element.
   * @param selector: The parent of where the chart should be restored.
   * @param stateID: The ID returned by chart2id()
   * @returns {Promise}. Empty resolve on success or reject with exception otherwise.
   */
  async id2chart (selector, stateID) {
    const state = await this.getState(stateID)
    const vm = store.getters.chartManager.setChart(state.chartName, selector)
    vm._setState(state.chartState)
  }
}
