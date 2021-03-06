<template>
  <chart v-on:resize="resize">

    <control-panel name="Boxplot Panel">
      <data-box :header="params.numVars.label"
                :dataTypes="['numerical', 'numerical_array']"
                :validRange="[params.numVars.minLength, params.numVars.maxLength]"
                v-model="params.numVars.value"
                v-on:update="updateNumVars">
      </data-box>
      <data-box :header="params.catVars.label"
                :dataTypes="['categorical']"
                :validRange="[params.catVars.minLength, params.catVars.maxLength]"
                v-model="params.catVars.value"
                v-on:update="updateCatVars">
      </data-box>
      <hr class="fjs-seperator"/>
      <div class="fjs-parameter-container">
        <div>
          <label>
            {{ params.transformation.label }}:
            <select class="fjs-transformation-select" v-model="params.transformation.value">
              <option v-for="t in params.transformation.validValues">{{ t }}</option>
            </select>
          </label>
        </div>
        <div>
          <label>
            <input type="checkbox" v-model="params.showOutliers.value"/>
            {{ params.showOutliers.label }}
          </label>
        </div>
        <div>
          <label>
            <input type="checkbox" v-model="params.showData.value"/>
            {{ params.showData.label }}
          </label>
        </div>
        <div>
          <label>
            <input type="checkbox" v-model="params.jitter.value"/>
            {{ params.jitter.label }}
          </label>
        </div>
        <div>
          <label>
            <input type="checkbox" v-model="params.showKDE.value"/>
            {{ params.showKDE.label }}
          </label>
        </div>
        <div>
          <label>
            <input type="checkbox" v-model="params.ignoreSubsets.value"/>
            {{ params.ignoreSubsets.label }}
          </label>
        </div>

      </div>
    </control-panel>

    <svg :width="width" :height="height">
      <g :transform="`translate(${margin.left}, ${margin.top})`">
        <text :x="this.padded.width / 2"
              class="fjs-anova-results"
              v-if="Object.keys(this.results.anova).length">
          ANOVA -- F-value: {{ anova.fValue }}
          &nbsp p-value: {{ anova.pValue }}
        </text>
        <g class="fjs-boxplot-axis fjs-y-axis" ref="yAxis"></g>
        <g class="fjs-box"
           :ref="`${label}-box`"
           :transform="`translate(${scales.x(label)}, 0)`"
           v-tooltip="{placement: 'bottom'}"
           @click="setIDFilter(label)"
           @mouseenter="showTooltip(label)"
           @mouseleave="hideTooltip(label)"
           v-for="label in labels">
          <rect class="fjs-select-rect"
                :y="boxes[label].u_wsk"
                :x="- boxplotWidth / 2 - 1"
                :height="boxes[label].l_wsk - boxes[label].u_wsk"
                :width="boxplotWidth + 4"
                v-show="selectedLabel === label">
          </rect>
          <text text-anchor="middle"
                :transform="`translate(${boxplotWidth / 1.8}, ${padded.height / 2})rotate(90)`">
            {{label}}
          </text>
          <line class="fjs-upper-whisker"
                :ref="`${label}-upper-whisker`"
                :title="results.statistics[label].u_wsk"
                v-tooltip="{placement: 'right'}"
                :x1="- boxplotWidth / 6"
                :y1="boxes[label].u_wsk"
                :x2="boxplotWidth / 6"
                :y2="boxes[label].u_wsk">
          </line>
          <line class="fjs-lower-whisker"
                :ref="`${label}-lower-whisker`"
                :title="results.statistics[label].l_wsk"
                v-tooltip="{placement: 'right'}"
                :x1="- boxplotWidth / 6"
                :y1="boxes[label].l_wsk"
                :x2="boxplotWidth / 6"
                :y2="boxes[label].l_wsk">
          </line>
          <line class="fjs-upper-quartile"
                :ref="`${label}-upper-quartile`"
                :title="results.statistics[label].u_qrt"
                v-tooltip="{placement: 'left'}"
                :x1="- boxplotWidth / 2"
                :y1="boxes[label].u_qrt"
                :x2="boxplotWidth / 2"
                :y2="boxes[label].u_qrt">
          </line>
          <line class="fjs-lower-quartile"
                :ref="`${label}-lower-quartile`"
                :title="results.statistics[label].l_qrt"
                v-tooltip="{placement: 'left'}"
                :x1="- boxplotWidth / 2"
                :y1="boxes[label].l_qrt"
                :x2="boxplotWidth / 2"
                :y2="boxes[label].l_qrt">
          </line>
          <line class="fjs-median"
                :ref="`${label}-median`"
                :title="results.statistics[label].median"
                v-tooltip="{placement: 'right'}"
                :x1="- boxplotWidth / 2"
                :y1="boxes[label].median"
                :x2="boxplotWidth / 2"
                :y2="boxes[label].median">
          </line>
          <line class="fjs-antenna"
                :x1="0"
                :y1="boxes[label].u_wsk"
                :x2="0"
                :y2="boxes[label].l_wsk">
          </line>
          <rect class="fjs-above-median-box"
                :x="- boxplotWidth / 2"
                :y="boxes[label].u_qrt"
                :width="boxplotWidth"
                :height="boxes[label].median - boxes[label].u_qrt">
          </rect>
          <rect class="fjs-below-median-box"
                :x="- boxplotWidth / 2"
                :y="boxes[label].median"
                :width="boxplotWidth"
                :height="boxes[label].l_qrt - boxes[label].median">
          </rect>
          <image :xlink:href="dataUrls[label]"
                 :data-label="label"
                 :height="padded.height"
                 :width="boxplotWidth / 2">
          </image>
          <polyline class="fjs-kde"
                    :points="kdePolyPoints[label]"
                    v-if="params.showKDE.value">
          </polyline>
        </g>
      </g>
    </svg>

  </chart>
</template>

<script>
  import DataBox from '../components/DataBox.vue'
  import ControlPanel from '../components/ControlPanel.vue'
  import Chart from '../components/Chart.vue'
  import store from '../../store/store'
  import RunAnalysis from '../mixins/run-analysis'
  import * as d3 from 'd3'
  import deepFreeze from 'deep-freeze-strict'
  import tooltip from '../directives/tooltip'
  import ParameterInterface from '../mixins/parameter-interface'
  import getHDPICanvas from '../../utils/high-dpi-canvas'
  export default {
    name: 'boxplot',
    data () {
      return {
        params: {
          numVars: {
            label: 'Numerical Variables',
            type: Array,
            elementType: String,
            validValues: [],
            minLength: 1,
            maxLength: Infinity,
            value: []
          },
          catVars: {
            label: 'Categorical Variables',
            type: Array,
            elementType: String,
            validValues: [],
            minLength: 0,
            maxLength: Infinity,
            value: []
          },
          showOutliers: {
            label: 'Show Outliers',
            type: Boolean,
            value: true
          },
          showData: {
            label: 'Show Points',
            type: Boolean,
            value: false
          },
          jitter: {
            label: 'Jitter Data',
            type: Boolean,
            value: false
          },
          showKDE: {
            label: 'Show Density Est.',
            type: Boolean,
            value: false
          },
          ignoreSubsets: {
            label: 'Ignore Subsets',
            type: Boolean,
            value: false
          },
          transformation: {
            label: 'Data transformation',
            type: String,
            value: 'identity',
            validValues: ['identity', 'log2(x)', 'log10(x)', '2^x', '10^x']
          }
        },
        width: 0,
        height: 0,
        hasSetFilter: false,
        selectedLabel: '',
        tooltips: {
          boxes: {}
        },
        results: {
          data: [],
          statistics: {},
          anova: {}
        },
        dataUrls: {}
      }
    },
    mounted () {
      this.registerParameterObjectInterface('params')
    },
    computed: {
      idFilter () {
        return store.getters.filter('ids')
      },
      args () {
        return {
          features: this.params.numVars.value,
          categories: this.params.catVars.value,
          id_filter: this.idFilter.value,
          transformation: this.params.transformation.value,
          subsets: this.params.ignoreSubsets.value ? [] : store.getters.subsets,
          subset_labels: this.params.ignoreSubsets.value ? [] : store.getters.subsetLabels
        }
      },
      pointSize () {
        return this.width / 150
      },
      validArgs () {
        return this.params.numVars.value.length > 0
      },
      margin () {
        const left = 10
        const top = this.height / 20
        const right = this.width / 15
        const bottom = 10
        return { left, top, right, bottom }
      },
      padded () {
        const width = this.width - this.margin.left - this.margin.right
        const height = this.height - this.margin.top - this.margin.bottom
        return { width, height }
      },
      labels () {
        return Object.keys(this.results.statistics).sort()
      },
      canvas () {
        const canvas = {}
        this.labels.forEach(label => {
          canvas[label] = getHDPICanvas(this.boxplotWidth / 2, this.padded.height)
        })
        return canvas
      },
      points () {
        const points = {}
        this.labels.forEach(label => {
          let [feature, category, subset] = label.split('//')
          subset = parseInt(subset.substring(1)) - 1 // revert subset string formatting
          points[label] = this.results.data
            .filter(d => d.subset === subset &&
              d.feature === feature &&
              d.category === category &&
              (this.params.showOutliers.value ? true : !d.outlier) &&
              typeof d.value === 'number')
            .map(d => {
              return {
                id: d.id,
                value: d.value,
                jitter: Math.max(this.pointSize / 2, (this.params.jitter.value ? Math.random() * this.boxplotWidth / 2 : this.boxplotWidth / 2) - this.pointSize / 2),
                subset: d.subset,
                category: d.category,
                outlier: d.outlier
              }
            })
        })
        return points
      },
      boxes () {
        const boxes = {}
        this.labels.forEach(label => {
          boxes[label] = {
            u_wsk: this.scales.y(this.results.statistics[label].u_wsk),
            l_wsk: this.scales.y(this.results.statistics[label].l_wsk),
            u_qrt: this.scales.y(this.results.statistics[label].u_qrt),
            l_qrt: this.scales.y(this.results.statistics[label].l_qrt),
            median: this.scales.y(this.results.statistics[label].median)
          }
        })
        return boxes
      },
      numOfBoxplots () {
        return this.labels.length
      },
      boxplotWidth () {
        const maxBoxplotWidth = this.padded.width / 4
        const minBoxplotWidth = 10
        let boxplotWidth = this.padded.width / this.numOfBoxplots - this.padded.width * 0.05
        boxplotWidth = boxplotWidth > maxBoxplotWidth ? maxBoxplotWidth : boxplotWidth
        boxplotWidth = boxplotWidth < minBoxplotWidth ? minBoxplotWidth : boxplotWidth
        return boxplotWidth
      },
      scales () {
        const values = this.results.data
          .filter(d => this.params.showOutliers.value ? true : !d.outlier)
          .map(d => d.value)
        const flattened = [].concat.apply([], values)
        const extent = d3.extent(flattened)
        const padding = (extent[1] - extent[0]) / 20
        const x = d3.scalePoint()
          .domain(this.labels)
          .range([0, this.padded.width])
          .padding(0.5)
        const y = d3.scaleLinear()
          .domain([extent[0] - padding, extent[1] + padding])
          .range([this.padded.height, 0])
        return { x, y }
      },
      kdePolyPoints () {
        const polyPoints = {}
        this.labels.forEach(label => {
          polyPoints[label] = this.results.statistics[label].kde.map((d, i) => {
            return -this.kdeScales[label].y(d) + ',' + this.kdeScales[label].x(i)
          }).join(' ')
        })
        return polyPoints
      },
      kdeScales () {
        const polyPoints = {}
        this.labels.forEach(label => {
          const x = d3.scaleLinear()
            .domain([0, this.results.statistics[label].kde.length - 1])
            .range([this.scales.y(this.results.statistics[label].l_wsk),
              this.scales.y(this.results.statistics[label].u_wsk)])
          const y = d3.scaleLinear()
            .domain(d3.extent(this.results.statistics[label].kde))
            .range([0, this.boxplotWidth / 2])
          polyPoints[label] = { x, y }
        })
        return polyPoints
      },
      yAxis () {
        return d3.axisRight(this.scales.y).tickSizeInner(this.padded.width)
      },
      anova () {
        let fValue = this.results.anova.f_value == null ? 'NaN' : this.results.anova.f_value.toPrecision(4)
        let pValue = this.results.anova.p_value == null ? 'NaN' : this.results.anova.p_value.toPrecision(4)
        return {pValue, fValue}
      }
    },
    // IMPORTANT: If the code within the watchers does interact with the DOM the code should be wrapped into a $nextTick
    // statement. This helps with the integration into the Vue component lifecycle. E.g.: an animation can't be
    // applied to an element that does not exist yet.
    watch: {
      'args': {
        handler: function () {
          if (this.validArgs && !this.hasSetFilter) {
            this.runAnalysisWrapper(this.args)
          }
          this.hasSetFilter = false
        }
      },
      'yAxis': {
        handler: function (newAxis) {
          this.$nextTick(() => {
            d3.select(this.$refs.yAxis).call(newAxis)
          })
        }
      },
      'params.showData.value': {
        handler: function () { this.$nextTick(() => this.drawPoints()) }
      },
      'params.jitter.value': {
        handler: function () { this.$nextTick(() => this.drawPoints()) }
      },
      'points': {
        handler: function () { this.$nextTick(() => this.drawPoints()) }
      }
    },
    methods: {
      getTippyInstances (label) {
        // prepare mouseover event to populare tippy instances (s. tooltip.js)
        const event = document.createEvent('Event')
        event.initEvent('mouseover', true, true)
        return [
          this.$refs[`${label}-upper-whisker`][0],
          this.$refs[`${label}-lower-whisker`][0],
          this.$refs[`${label}-upper-quartile`][0],
          this.$refs[`${label}-lower-quartile`][0],
          this.$refs[`${label}-median`][0]
        ].map(el => {
          el.dispatchEvent(event)
          return el._tippy
        })
      },
      showTooltip (label) {
        this.getTippyInstances(label).forEach(d => d.show())
      },
      hideTooltip (label) {
        this.getTippyInstances(label).forEach(d => d.hide())
      },
      setIDFilter (label) {
        if (label === this.selectedLabel) {
          store.dispatch('setFilter', {source: this._uid, filter: 'ids', value: []})
          this.selectedLabel = ''
          this.hasSetFilter = false
        } else {
          store.dispatch('setFilter', {source: this._uid, filter: 'ids', value: this.points[label].map(d => d.id)})
          this.selectedLabel = label
          this.hasSetFilter = true
        }
      },
      drawPoints () {
        this.labels.forEach(label => {
          const canvas = this.canvas[label]
          const ctx = canvas.getContext('2d')
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          if (this.params.showData.value) {
            this.points[label].forEach(point => {
              ctx.beginPath()
              ctx.fillStyle = point.outlier ? '#f00' : '#000'
              ctx.fillRect(
                point.jitter - this.pointSize / 2,
                this.scales.y(point.value) - this.pointSize / 2,
                this.pointSize,
                this.pointSize
              )
            })
          }
          // we create new properties. We need to tell Vue that they are reactive
          this.$set(this.dataUrls, label, canvas.toDataURL())
        })
      },
      resize (width, height) {
        this.width = width
        this.height = height
      },
      runAnalysisWrapper (args) {
        this.runAnalysis('compute-boxplot', args)
          .then(response => {
            const results = JSON.parse(response)
            results.data = JSON.parse(results.data)
            deepFreeze(results) // massively improve performance by telling Vue that the objects properties won't change
            this.results = results
          })
          .catch(error => console.error(error))
      },
      updateNumVars (ids) {
        this.params.numVars.validValues = ids
      },
      updateCatVars (ids) {
        this.params.catVars.validValues = ids
      }
    },
    components: {
      ControlPanel,
      DataBox,
      Chart
    },
    mixins: [
      RunAnalysis,
      ParameterInterface
    ],
    directives: {
      tooltip
    }
  }
</script>

<style lang="sass" scoped>
  @import '~assets/base.sass'
  .fjs-control-panel
    .fjs-parameter-container
      display: flex
      flex-direction: column
      > div
        margin-bottom: 0.5vh
  svg
    .fjs-box
      cursor: pointer
      .fjs-select-rect
        fill: none
        stroke: red
        stroke-width: 2px
      .fjs-median, .fjs-lower-quartile, .fjs-upper-quartile
        opacity: 1
      .fjs-lower-whisker, .fjs-upper-whisker, .fjs-antenna
        shape-rendering: crispEdges
        stroke: black
        stroke-width: 1px
      .fjs-below-median-box
        stroke: none
        fill: rgb(205, 232, 254)
        shape-rendering: crispEdges
      .fjs-above-median-box
        stroke: none
        fill: rgb(180, 221, 253)
        shape-rendering: crispEdges
    .fjs-kde
      fill: none
      stroke: black
      stroke-width: 0.2%
    .fjs-anova-results
      text-anchor: middle
</style>


<!--CSS for dynamically created components-->
<style lang="sass">
  .fjs-boxplot-axis
    shape-rendering: crispEdges
    .tick
      shape-rendering: crispEdges
      text
        font-size: 0.75em
    line
      stroke: #E2E2E2
    path
      stroke: none
</style>
