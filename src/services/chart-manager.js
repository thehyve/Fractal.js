import Vue from 'vue'

export default class {
  constructor () {
    this.availableCharts = {}
    const req = require.context('../vue/charts/', true, /\.vue$/)
    req.keys().forEach(key => {
      const vm = req(key).default
      this.availableCharts[vm.name] = vm
    })
  }

  /**
   * Attempts to set a chart based on a given name as a child of the given selector.
   * @param chart: The name of the chart. Must be a name of a vue component within availableCharts.
   * @param selector: A unique selector which will be the parent of the chart.
   * @returns {Vue} The mounted vue component.
   */
  setChart (chart, selector) {
    if (!this.availableCharts.hasOwnProperty(chart)) {
      throw new Error(`Chart '${chart} is not available. Must be one of: ${this.availableCharts}`)
    }
    let container = document.querySelectorAll(selector)
    if (container.length !== 1) {
      throw new Error(`Selector to set a chart must match exactly one element. Matched elements: ${container.length}`)
    }
    container = container[0]
    const Chart = Vue.extend(this.availableCharts[chart])
    const vm = new Chart()
    const el = document.createElement('div')
    container.appendChild(el)
    vm.$mount(el)
    return vm
  }

  getAvailableCharts () {
    return Object.keys(this.availableCharts)
  }
}
