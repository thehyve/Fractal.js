import { version } from '../package.json'
import store from './store/store'
import RequestManager from './services/request-manager'
import ChartManager from './services/chart-manager'
import StateManager from './services/state-manager'
require('./assets/fonts/Roboto/Roboto.sass')
require('./assets/fonts/MaterialIcons/MaterialIcons.sass')

class FractalJS {
  constructor (handler, dataSource, fractalisNode, getAuth, options) {
    const requestManager = new RequestManager(handler, dataSource, fractalisNode, getAuth)
    const chartManager = new ChartManager()
    const stateManager = new StateManager()
    store.dispatch('setRequestManager', requestManager)
    store.dispatch('setChartManager', chartManager)
    store.dispatch('setStateManager', stateManager)
    store.dispatch('updateData')
    store.dispatch('setOptions', options)
    this._versionCheck()
  }

  // noinspection JSMethodCanBeStatic
  async _versionCheck () {
    const rv = await store.getters.requestManager.getVersion()
    const fractaljsVersions = version.split('.')
    const fractaljsMajor = fractaljsVersions[0]
    const fractaljsMinor = fractaljsVersions[1]
    const fractalisVersions = rv.data.version.split('.')
    const fractalisMajor = fractalisVersions[0]
    const fractalisMinor = fractalisVersions[1]
    if (fractaljsMajor !== fractalisMajor || fractaljsMinor !== fractalisMinor) {
      console.warn(`WARNING: The Fractalis backend is version ${rv.data.version},
      but the frontend is version ${version}. This might or might not cause issues.`)
    }
  }

  // noinspection JSMethodCanBeStatic
  loadData (descriptors) {
    return store.getters.requestManager.createData(descriptors)
  }

  // noinspection JSMethodCanBeStatic
  setChart (chart, selector) {
    return store.getters.chartManager.setChart(chart, selector)
  }

  // noinspection JSMethodCanBeStatic
  removeAllCharts () {
    return store.getters.chartManager.removeAllCharts()
  }

  // noinspection JSMethodCanBeStatic
  getAvailableCharts () {
    return store.getters.chartManager.getAvailableCharts()
  }

  // noinspection JSMethodCanBeStatic
  clearCache () {
    return store.getters.requestManager.deleteAllData()
  }

  // noinspection JSMethodCanBeStatic
  setSubsets (subsets) {
    store.dispatch('setSubsets', subsets)
  }

  // noinspection JSMethodCanBeStatic
  deleteSubsets () {
    store.dispatch('setSubsets', [])
  }

  // FIXME: temporarily disabled. Focus on stabilizing core functionality for now.
  // // noinspection JSMethodCanBeStatic
  // chart2id (vm, callback) {
  //   return store.getters.stateManager.chart2id(vm, callback)
  // }
  //
  // // noinspection JSMethodCanBeStatic
  // id2chart (selector, stateID) {
  //   return store.getters.stateManager.id2chart(selector, stateID)
  // }

  // noinspection JSMethodCanBeStatic
  /**
   * For a given chart register a callback that accepts exactly one argument (the parameterDescription object)
   * The callback is called every time the parameters of the chart change
   * Example for parameterDescriptionObject: {ignoreSubsets: {label: 'Ignore Subsets', type: Boolean, value: true}, ...}
   * @param vm The chart VM (returned by setChart)
   * @param callback The callback to register.
   */
  getChartParameterDescription (vm, callback) {
    store.getters.chartManager.getChartParamDescr(vm, callback)
  }

  // noinspection JSMethodCanBeStatic
  /**
   * Update the given vm with the given parameter object.
   * Example for parameter object: {ignoreSubsets: false, ...}
   * @param vm (returned by setChart)
   * @param parameters (key:value pairs / parameterName:parameterValue pairs)
   */
  setChartParameter (vm, parameters) {
    store.getters.chartManager.setChartParams(vm, parameters)
  }
}

/**
 * Initialize FractalJS and return an instance that contains all basic methods necessary to use this library.
 *
 * @param handler: The service in which this library is used. Example: 'ada', 'tranSMART', 'variantDB'
 * @param dataSource: The base URL of the service in which this library is used. Example: 'https://my.service.org/'
 * @param fractalisNode: The base URL of the fractalis back end that you want to use. 'http://fractalis.uni.lu/'
 * @param getAuth: This MUST be a function that can be called at any time to retrieve credentials to authenticate with
 * @param options: Optional object to configure fractal.js within the target UI.
 * the API of the service specified in dataSource.
 * @returns {FractalJS}: An instance of FractalJS.
 */
export function init ({handler, dataSource, fractalisNode, getAuth, options}) {
  if (!handler) {
    throw new Error(`handler property must not be ${handler}`)
  }
  if (!dataSource) {
    throw new Error(`handler property must not be ${dataSource}`)
  }
  if (!fractalisNode) {
    throw new Error(`handler property must not be ${fractalisNode}`)
  }
  if (!getAuth) {
    throw new Error(`handler property must not be ${getAuth}`)
  }
  return new FractalJS(handler, dataSource, fractalisNode, getAuth, options)
}
