<template>
    <chart v-on:resize="resize">
        <control-panel name="Survivalplot Panel">
            <data-box :header="params.durationVars.label"
                      :data-types="['numerical']"
                      :validRange="[params.durationVars.minLength, params.durationVars.maxLength]"
                      v-model="params.durationVars.value"
                      v-on:update="updateDurationVars">
            </data-box>
            <data-box :header="params.groupVars.label"
                      :data-types="['categorical']"
                      :validRange="[params.groupVars.minLength, params.groupVars.maxLength]"
                      v-model="params.groupVars.value"
                      v-on:update="updateGroupVars">
            </data-box>
            <data-box :header="params.observedVars.label"
                      :data-types="['categorical']"
                      :validRange="[params.observedVars.minLength, params.observedVars.maxLength]"
                      v-model="params.observedVars.value"
                      v-on:update="updateObservedVars">
            </data-box>
            <hr class="fjs-seperator"/>
            <div class="fjs-settings">
                <fieldset class="fjs-fieldset">
                    <legend>{{ params.estimator.label }}</legend>
                    <div v-for="method in params.estimator.validValues">
                        <label>
                            <input type="radio" :value="method" v-model="params.estimator.value">
                            {{ method }}
                        </label>
                    </div>
                </fieldset>
                <div>
                    <label>
                        {{ params.ignoreSubsets.label }}
                        <input type="checkbox" v-model="params.ignoreSubsets.value"/>
                    </label>
                </div>
            </div>

        </control-panel>
        <svg :height="height" :width="width">
            <g :transform="`translate(${margin.left}, ${margin.top})`">
                <rect :width="padded.width" :height="padded.height" style="opacity: 0"></rect>
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
                <crosshair :width="padded.width" :height="padded.height"/>
                <g class="fjs-axis" ref="yAxis2" :transform="`translate(${padded.width}, 0)`"></g>
                <g class="fjs-axis" ref="xAxis2"></g>
                <g class="fjs-axis" ref="xAxis1" :transform="`translate(0, ${padded.height})`"></g>
                <g class="fjs-axis" ref="yAxis1"></g>
                <text :transform="`translate(${padded.width / 2}, ${padded.height + margin.bottom * 0.90})`"
                      text-anchor="middle">
                    {{ results.label }}
                </text>
                <g class="fjs-paths">
                    <path class="fjs-estimate-path"
                          :style="{stroke: path.color}"
                          :d="path.d" v-for="path in paths">
                    </path>
                    <path class="fjs-ci-path"
                          :style="{fill: path.color}"
                          :d="path.d" v-for="path in ciPaths">
                    </path>
                </g>
            </g>
        </svg>
    </chart>
</template>

<script>
  import ControlPanel from '../components/ControlPanel.vue'
  import Chart from '../components/Chart.vue'
  import DataBox from '../components/DataBox.vue'
  import RunAnalysis from '../mixins/run-analysis'
  import ParameterInterface from '../mixins/parameter-interface'
  import store from '../../store/store'
  import deepFreeze from 'deep-freeze-strict'
  import * as d3 from 'd3'
  import Crosshair from '../components/Crosshair.vue'
  import Html2svg from '../components/HTML2SVG.vue'
  import Draggable from '../components/Draggable.vue'
  import _ from 'lodash'
  export default {
    name: 'survivalplot',
    components: {Draggable, Html2svg, Crosshair, DataBox, Chart, ControlPanel},
    mixins: [RunAnalysis, ParameterInterface],
    data () {
      return {
        height: 0,
        width: 0,
        params: {
          durationVars: {
            label: 'Duration [numerical]',
            type: Array,
            elementType: String,
            validValues: [],
            minLength: 1,
            maxLength: 1,
            value: []
          },
          groupVars: {
            label: 'Groups (optional) [categorical]',
            type: Array,
            elementType: String,
            validValues: [],
            minLength: 0,
            maxLength: Infinity,
            value: []
          },
          observedVars: {
            label: 'Observed (optional) [categorical]',
            type: Array,
            elementType: String,
            validValues: [],
            minLength: 0,
            maxLength: 1,
            value: []
          },
          estimator: {
            label: 'Estimator',
            type: String,
            validValues: ['KaplanMeier', 'NelsonAalen'],
            value: 'KaplanMeier'
          },
          ignoreSubsets: {
            label: 'Ignore Subsets',
            type: Boolean,
            value: false
          }
        },
        groupColors: d3.schemeCategory10,
        results: {
          subsets: [],
          categories: [],
          stats: {}
        }
      }
    },
    mounted () {
      this.registerParameterObjectInterface('params')
    },
    computed: {
      args () {
        return {
          durations: this.params.durationVars.value,
          categories: this.params.groupVars.value,
          event_observed: this.params.observedVars.value,
          estimator: this.params.estimator.value,
          id_filter: store.getters.filter('ids').value,
          subsets: this.params.ignoreSubsets.value ? [] : store.getters.subsets,
          subset_labels: this.params.ignoreSubsets.value ? [] : store.getters.subsetLabels
        }
      },
      validArgs () {
        return this.params.durationVars.value.length === 1
      },
      margin () {
        const left = this.width / 15
        const top = this.height / 15
        const right = this.width / 15
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
        let timelineGlobalMin = Number.MAX_SAFE_INTEGER
        let timelineGlobalMax = Number.MIN_SAFE_INTEGER
        let estimateGlobalMin = Number.MAX_SAFE_INTEGER
        let estimateGlobalMax = Number.MIN_SAFE_INTEGER
        this.groups.forEach(group => {
          const [localTimelineMin, localTimelineMax] = d3.extent(this.results.stats[group.category][group.subset].timeline)
          timelineGlobalMin = localTimelineMin < timelineGlobalMin ? localTimelineMin : timelineGlobalMin
          timelineGlobalMax = localTimelineMax > timelineGlobalMax ? localTimelineMax : timelineGlobalMax
          const [localEstimateMin, localEstimateMax] = d3.extent(this.results.stats[group.category][group.subset].estimate)
          estimateGlobalMin = localEstimateMin < estimateGlobalMin ? localEstimateMin : estimateGlobalMin
          estimateGlobalMax = localEstimateMax > estimateGlobalMax ? localEstimateMax : estimateGlobalMax
        })
        return { timelineGlobalMin, timelineGlobalMax, estimateGlobalMin, estimateGlobalMax }
      },
      scales () {
        const x = d3.scaleLinear()
          .domain([this.dataRanges.timelineGlobalMin, this.dataRanges.timelineGlobalMax])
          .range([0, this.padded.width])
        const y = d3.scaleLinear()
          .domain([this.dataRanges.estimateGlobalMin, this.dataRanges.estimateGlobalMax])
          .range([this.padded.height, 0])
        return { x, y }
      },
      axis () {
        const x1 = d3.axisBottom(this.scales.x)
        const y1 = d3.axisLeft(this.scales.y)
        const x2 = d3.axisBottom(this.scales.x)
          .tickSizeInner(this.padded.height)
          .tickFormat('')
        const y2 = d3.axisLeft(this.scales.y)
          .tickSizeInner(this.padded.width)
          .tickFormat('')
        return { x1, x2, y1, y2 }
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
      paths () {
        return this.groups.map(group => {
          let path = ''
          this.results.stats[group.category][group.subset].estimate.forEach((d, i, arr) => {
            const stats = this.results.stats[group.category][group.subset]
            const x = this.scales.x(stats.timeline[i])
            if (i === 0) {
              path += `M ${x} ${this.scales.y(d)}`
            } else {
              path += `L ${x} ${this.scales.y(arr[i - 1])}`
              path += `L ${x} ${this.scales.y(d)}`
            }
          })
          return { d: path, color: group.color }
        })
      },
      ciPaths () {
        return this.groups.map(group => {
          const stats = this.results.stats[group.category][group.subset]
          let path = ''
          let backpath = ' Z '
          this.results.stats[group.category][group.subset].ci_upper.forEach((_, i) => {
            const x = this.scales.x(stats.timeline[i])
            if (i === 0) {
              return true
            } else if (i === 1) {
              path += `M ${x} ${this.scales.y(stats.ci_upper[i])} `
              backpath = ` L ${x} ${this.scales.y(stats.ci_lower[i])}` + backpath
            } else {
              path += `L ${x} ${this.scales.y(stats.ci_upper[i - 1])} `
              path += `L ${x} ${this.scales.y(stats.ci_upper[i])} `
              backpath = ` L ${x} ${this.scales.y(stats.ci_lower[i - 1])}` + backpath
              backpath = ` L ${x} ${this.scales.y(stats.ci_lower[i])}` + backpath
            }
          })
          return { d: path + backpath, color: group.color }
        })
      }
    },
    methods: {
      resize (width, height) {
        this.width = width
        this.height = height
      },
      runAnalysisWrapper (args) {
        this.runAnalysis('survival-analysis', args)
          .then(response => {
            const results = JSON.parse(response)
            deepFreeze(results) // massively improve performance by telling Vue that the objects properties won't change
            this.results = results
          })
          .catch(error => console.error(error))
      },
      getGroupName (category, subset) {
        return `${this.results.label} [${category}] [${this.results.subset_labels[subset]}]`
      },
      updateDurationVars (ids) {
        this.params.durationVars.validValues = ids
      },
      updateGroupVars (ids) {
        this.params.groupVars.validValues = ids
      },
      updateObservedVars (ids) {
        this.params.observedVars.validValues = ids
      }
    },
    watch: {
      'args': {
        handler: function (newArgs) {
          if (this.validArgs) {
            this.runAnalysisWrapper(newArgs)
          }
        }
      },
      'axis': {
        handler: function (newAxis) {
          this.$nextTick(() => {
            d3.select(this.$refs.xAxis1).call(newAxis.x1)
            d3.select(this.$refs.yAxis1).call(newAxis.y1)
            d3.select(this.$refs.yAxis2).call(newAxis.y2)
            d3.select(this.$refs.xAxis2).call(newAxis.x2)
          })
        }
      }
    }
  }
</script>

<style lang="sass" scoped>
    @import '~assets/base.sass'

    .fjs-control-panel
        .fjs-settings > *
            margin-bottom: 1vh

    .fjs-legend
        .fjs-legend-element
            > svg
                margin-right: 0.5vw
            display: flex
            align-items: center

    svg
        .fjs-paths
            path
                shape-rendering: crispEdges
            .fjs-estimate-path
                stroke-width: 2px
                fill: none
            .fjs-ci-path
                opacity: 0.4
</style>

<!--CSS for dynamically created components-->
<style lang="sass">
    @import '~assets/d3.sass'

    .fjs-axis
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
