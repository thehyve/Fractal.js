<template>
    <chart v-on:resize="resize">
        <control-panel name="Histogram Panel">
            <data-box :header="params.numVars.label"
                      :data-types="['numerical']"
                      v-on:update="updateNumVars"
                      v-model="params.numVars.value"
                      :valid-range="[params.numVars.minLength, params.numVars.maxLength]">
            </data-box>
            <data-box :header="params.catVars.label"
                      :data-types="['categorical']"
                      v-on:update="updateCatVars"
                      v-model="params.catVars.value"
                      :valid-range="[params.catVars.minLength, params.catVars.maxLength]">
            </data-box>
            <hr class="fjs-seperator"/>
            <div class="fjs-params">
                <label>
                    {{ params.bwFactor.label }}:
                    <input type="number" :min="params.bwFactor.min" step="0.1" v-model.lazy.number="params.bwFactor.value"/>
                </label>
                <label>
                    {{ params.numBins.label }}:
                    <input type="number" :min="params.numBins.min" step="1" v-model.lazy.number="params.numBins.value"/>
                </label>
            </div>
        </control-panel>
        <svg :height="height" :width="width">
            <g :transform="`translate(${margin.left}, ${margin.top})`">
                <html2svg :right="padded.width">
                    <draggable>
                        <div class="fjs-legend">
                            <div class="fjs-legend-element" v-for="group in groups">
                                <svg :width="iconSize" :height="iconSize">
                                    <rect :width="iconSize" :height="iconSize" :fill="group.color"></rect>
                                </svg>
                                <span>{{ group.name }}</span>
                            </div>
                        </div>
                    </draggable>
                </html2svg>
                <g class="fjs-hist-axis" ref="xAxis" :transform="`translate(0, ${this.padded.height})`"></g>
                <g class="fjs-hist-axis" ref="yAxis"></g>
                <crosshair :width="padded.width" :height="padded.height"></crosshair>
                <g class="fjs-brush" ref="brush"></g>
                <g class="fjs-histogram" v-for="histogram in histograms">
                    <rect class="fjs-bin"
                          :x="bin.x"
                          :y="bin.y"
                          :height="bin.height"
                          :width="bin.width"
                          :fill="histogram.color"
                          v-for="bin in histogram.bins">
                    </rect>
                </g>
                <g class="fjs-distributions" v-for="histogram in histograms">
                    <polyline class="fjs-distribution"
                              :stroke="histogram.color"
                              :points="histogram.distribution">
                    </polyline>
                </g>
                <g class="fjs-brush" ref="brush"></g>
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
  import Crosshair from '../components/Crosshair.vue'
  import Html2svg from '../components/HTML2SVG.vue'
  import Draggable from '../components/Draggable.vue'
  import tooltip from '../directives/tooltip'
  import ParameterInterface from '../mixins/parameter-interface'
  import _ from 'lodash'
  export default {
    name: 'histogram',
    components: {
      Draggable,
      Html2svg,
      ControlPanel,
      DataBox,
      Chart,
      Crosshair
    },
    mixins: [
      RunAnalysis,
      ParameterInterface
    ],
    directives: {
      tooltip
    },
    data () {
      return {
        height: 0,
        width: 0,
        params: {
          numVars: {
            label: 'Numerical Variables',
            type: Array,
            elementType: String,
            validValues: [],
            minLength: 1,
            maxLength: 1,
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
          bwFactor: {
            label: 'Bandwidth Factor',
            type: Number,
            min: 0.1,
            max: Infinity,
            value: 0.5
          },
          numBins: {
            label: 'Number of Bins',
            type: Number,
            min: 2,
            max: 50,
            value: 10
          }
        },
        selectedPoints: [],
        hasSetFilter: false,
        results: {
          data: [],
          label: '',
          subsets: [],
          subset_labels: [],
          categories: [],
          stats: {}
        },
        groupColors: d3.schemeCategory10
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
          bw_factor: this.params.bwFactor.value,
          num_bins: this.params.numBins.value,
          id_filter: this.idFilter.value,
          subsets: store.getters.subsets,
          subset_labels: store.getters.subsetLabels,
          data: this.params.numVars.value[0],
          categories: this.params.catVars.value
        }
      },
      validArgs () {
        return typeof this.args.data !== 'undefined'
      },
      margin () {
        const left = this.width / 20
        const top = this.height / 20
        const right = this.width / 20
        const bottom = this.height / 15
        return {left, top, right, bottom}
      },
      padded () {
        const width = this.width - this.margin.left - this.margin.right
        const height = this.height - this.margin.top - this.margin.bottom
        return {width, height}
      },
      iconSize () {
        return this.padded.width / 50
      },
      dataRanges () {
        let binEdgeGlobalMin = Number.MAX_SAFE_INTEGER
        let binEdgeGlobalMax = Number.MIN_SAFE_INTEGER
        let histGlobalMin = Number.MAX_SAFE_INTEGER
        let histGlobalMax = Number.MIN_SAFE_INTEGER
        this.groups.forEach(group => {
          const [localBinEdgeMin, localBinEdgeMax] = d3.extent(this.results.stats[group.category][group.subset].bin_edges)
          binEdgeGlobalMin = localBinEdgeMin < binEdgeGlobalMin ? localBinEdgeMin : binEdgeGlobalMin
          binEdgeGlobalMax = localBinEdgeMax > binEdgeGlobalMax ? localBinEdgeMax : binEdgeGlobalMax
          const [localHistMin, localHistMax] = d3.extent(this.results.stats[group.category][group.subset].hist)
          histGlobalMin = localHistMin < histGlobalMin ? localHistMin : histGlobalMin
          histGlobalMax = localHistMax > histGlobalMax ? localHistMax : histGlobalMax
        })
        return {binEdgeGlobalMin, binEdgeGlobalMax, histGlobalMin, histGlobalMax}
      },
      groups () {
        const groups = []
        this.results.categories.forEach(category => {
          this.results.subsets.forEach(subset => {
            if (!_.has(this.results.stats, [category, subset])) {
              return true
            }
            groups.push({
              name: this.getGroupName(category, subset),
              subset,
              category
            })
          })
        })
        groups.forEach((group, i) => {
          group.color = this.groupColors[i % this.groupColors.length]
        })
        return groups
      },
      scales () {
        const x = d3.scaleLinear()
          .domain([this.dataRanges.binEdgeGlobalMin, this.dataRanges.binEdgeGlobalMax])
          .range([0, this.padded.width])
        const y = d3.scaleLinear()
          .domain([this.dataRanges.histGlobalMin, this.dataRanges.histGlobalMax])
          .range([this.padded.height, 0])
        return {x, y}
      },
      axis () {
        const x = d3.axisBottom(this.scales.x)
        const y = d3.axisLeft(this.scales.y)
        return {x, y}
      },
      histograms () {
        return this.groups.map(group => {
          const binEdges = this.results.stats[group.category][group.subset].bin_edges
          const hist = this.results.stats[group.category][group.subset].hist
          const bins = hist.map((d, i) => {
            return {
              x: this.scales.x(binEdges[i]),
              y: this.scales.y(d),
              width: this.scales.x(binEdges[i + 1]) - this.scales.x(binEdges[i]),
              height: this.padded.height - this.scales.y(d)
            }
          })
          const dist = this.results.stats[group.category][group.subset].dist
          const xScale = d3.scaleLinear()
            .domain([0, dist.length - 1])
            .range([bins[0].x, bins[bins.length - 1].x + bins[bins.length - 1].width])
          const yScale = d3.scaleLinear()
            .domain(d3.extent(dist))
            .range([this.padded.height, 0])
          const distribution = dist.map((d, i) => {
            return xScale(i) + ',' + yScale(d)
          })
          return { bins, distribution, color: group.color }
        })
      },
      brush () {
        return d3.brushX()
          .extent([[0, 0], [this.padded.width, this.padded.height]])
          .on('end', () => {
            this.error = ''
            if (!d3.event.sourceEvent) { return }
            if (!d3.event.selection) {
              this.selectedPoints = []
            } else {
              const [x0, x1] = d3.event.selection
              this.selectedPoints = this.results.data.filter(d => {
                return x0 <= this.scales.x(d.value) && this.scales.x(d.value) <= x1
              })
              this.hasSetFilter = true
            }
            store.dispatch('setFilter', {
              source: this._uid,
              filter: 'ids',
              value: this.selectedPoints.map(d => d.id)
            })
          })
      }
    },
    methods: {
      runAnalysisWrapper (args) {
        this.runAnalysis('compute-histogram', args)
          .then(response => {
            const results = JSON.parse(response)
            results.data = JSON.parse(results.data)
            deepFreeze(results) // massively improve performance by telling Vue that the objects properties won't change
            this.results = results
          })
          .catch(error => console.error(error))
      },
      resize (width, height) {
        this.width = width
        this.height = height
      },
      getGroupName (category, subset) {
        return `${this.results.label} [${category}] [${this.results.subset_labels[subset]}]`
      },
      updateNumVars (ids) {
        this.params.numVars.validValues = ids
      },
      updateCatVars (ids) {
        this.params.catVars.validValues = ids
      }
    },
    watch: {
      'args': {
        handler: function (newArgs) {
          if (!this.hasSetFilter && this.validArgs) {
            this.runAnalysisWrapper(newArgs)
          }
          this.hasSetFilter = false
        }
      },
      'axis': {
        handler: function (newAxis) {
          this.$nextTick(() => {
            d3.select(this.$refs.xAxis).call(newAxis.x)
            d3.select(this.$refs.yAxis).call(newAxis.y)
          })
        }
      },
      'brush': {
        handler: function (newBrush) {
          this.$nextTick(() => {
            d3.select(this.$refs.brush).call(newBrush)
          })
        }
      },
      'idFilter': {
        handler: function (newIdFilter) {
          if (newIdFilter.source !== this._uid) {
            this.brush.move(d3.select(this.$refs.brush), null)
          }
        }
      }
    }
  }
</script>

<style lang="sass" scoped>
    @import '~assets/base.sass'

    .fjs-params
        display: flex
        flex-direction: column

    .fjs-legend
        .fjs-legend-element
            > svg
                margin-right: 0.5vw
            display: flex
            align-items: center

    .fjs-histogram
        .fjs-bin
            stroke: black
            stroke-width: 0
            shape-rendering: crispEdges
            opacity: 0.5

    .fjs-distributions
        .fjs-distribution
            fill: none
            stroke-width: 0.2em
            opacity: 0.8
</style>

<style lang="sass">
    @import '~assets/d3.sass'
    .fjs-hist-axis
        shape-rendering: crispEdges
        .tick
            shape-rendering: crispEdges
            line
                stroke: #E2E2E2
            text
                font-size: 0.75em
        path
            stroke: none
</style>
