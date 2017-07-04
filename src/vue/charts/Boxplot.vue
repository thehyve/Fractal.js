<template>
  <div :class="`fjs-boxplot fjs-vm-uid-${this._uid}`">
    <div class="fjs-data-box-container">
      <data-box class="fjs-data-box"
                header="Numerical Variables"
                dataType="numerical"
                v-on:update="update_numData">
      </data-box>
      <data-box class="fjs-data-box"
                header="Categorical Variables"
                dataType="categorical"
                v-on:update="update_catData">
      </data-box>
    </div>

    <div class="fjs-parameter-container">
    </div>

    <div class="fjs-vis-container">
      <svg :width="width"
           :height="height">
        <g :transform="`translate(${margin.left}, ${margin.top})`">
          <g class="fjs-bplt-axis fjs-x-axis" :transform="`translate(0, ${padded.height})`"></g>
          <g class="fjs-bplt-axis fjs-y-axis"></g>
          <g v-for="label in Object.keys(results.statistics)" :transform="`translate(${scales.x(label)}, 0)`">
            <line class="fjs-whisker"
                  :x1="- boxplotWidth / 6"
                  :y1="scales.y(stat)"
                  :x2="boxplotWidth / 6"
                  :y2="scales.y(stat)"
                  v-for="stat in [results.statistics[label].l_wsk, results.statistics[label].u_wsk]">
            </line>
            <line class="fjs-quartile"
                  :x1="- boxplotWidth / 2"
                  :y1="scales.y(stat)"
                  :x2="boxplotWidth / 2"
                  :y2="scales.y(stat)"
                  v-for="stat in [results.statistics[label].l_qrt, results.statistics[label].u_qrt]">
            </line>
            <line class="fjs-antenna"
                  :x1="0"
                  :y1="scales.y(results.statistics[label].u_wsk)"
                  :x2="0"
                  :y2="scales.y(results.statistics[label].l_wsk)">
            </line>
            <rect class="fjs-above-median-box"
                  :x="- boxplotWidth / 2"
                  :y="scales.y(results.statistics[label].u_qrt) + 1"
                  :width="boxplotWidth"
                  :height="scales.y(results.statistics[label].median) - scales.y(results.statistics[label].u_qrt)">
            </rect>
            <rect class="fjs-below-median-box"
                  :x="- boxplotWidth / 2"
                  :y="scales.y(results.statistics[label].median)"
                  :width="boxplotWidth"
                  :height="scales.y(results.statistics[label].l_qrt) - scales.y(results.statistics[label].median) - 1">
            </rect>
            <!--<circle class="fjs-point"-->
                    <!--:cx="scales.x(label)"-->
                    <!--:cy="scales.y(row[label])"-->
                    <!--r="4"-->
                    <!--v-if="row[label] !== null"-->
                    <!--v-for="row in results.data">-->
            <!--</circle>-->
          </g>
        </g>
      </svg>
    </div>
  </div>
</template>

<script>
  import DataBox from '../components/DataBox.vue'
  import store from '../../store/store'
  import requestHandling from '../methods/run-analysis'
  import * as d3 from 'd3'
  import { TweenLite } from 'gsap'
  import svgtooltip from '../directives/v-svgtooltip'
  import TaskView from '../components/TaskView.vue'
  import deepFreeze from 'deep-freeze-strict'
  export default {
    name: 'boxplot',
    data () {
      return {
        width: 0,
        height: 0,
        numData: [],
        catData: [],
        results: {
          data: [],
          statistics: {}
        }
      }
    },
    computed: {
      args () {
        return {
          variables: this.numData.map(d => `$${d}$`),
          categories: this.catData.map(d => `$${d}$`),
          id_filter: [],
          subsets: store.getters.subsets
        }
      },
      validArgs () {
        return this.numData.length > 0
      },
      margin () {
        const left = 50
        const top = 10
        const right = 10
        const bottom = 50
        return { left, top, right, bottom }
      },
      padded () {
        const width = this.width - this.margin.left - this.margin.right
        const height = this.height - this.margin.top - this.margin.bottom
        return { width, height }
      },
      numOfBoxplots () {
        return Object.keys(this.results.statistics).length
      },
      boxplotWidth () {
        const maxBoxplotWidth = this.padded.width / 4
        let boxplotWidth = this.padded.width / this.numOfBoxplots - this.padded.width * 0.05
        boxplotWidth = boxplotWidth > maxBoxplotWidth ? maxBoxplotWidth : boxplotWidth
        return boxplotWidth
      },
      scales () {
        const values = this.results.data.map(entry => this.results.variables.map(v => entry[v]))
        const flattened = [].concat.apply([], values)
        const extent = d3.extent(flattened)
        const padding = (extent[1] - extent[0]) / 10
        const x = d3.scalePoint()
          .domain(Object.keys(this.results.statistics))
          .range([0, this.padded.height])
          .padding(1)
        const y = d3.scaleLinear()
          .domain([extent[0] - padding, extent[1] + padding])
          .range([this.padded.width, 0])
        return { x, y }
      },
      axis () {
        const x = d3.axisBottom(this.scales.x)
        const y = d3.axisLeft(this.scales.y)
        return { x, y }
      }
    },
    watch: {
      'args': {
        handler: function (newArgs, oldArgs) {
          // if our data selection change we will want to re-initialize the current view
          const init = JSON.stringify(newArgs.variables) !== JSON.stringify(oldArgs.variables) ||
            JSON.stringify(newArgs.categories) !== JSON.stringify(oldArgs.categories)
          if (this.validArgs) {
            this.runAnalysisWrapper({init, args: this.args})
          }
        }
      },
      'axis': {
        handler: function (newAxis) {
          d3.select(`.fjs-vm-uid-${this._uid} .fjs-x-axis`)
            .call(newAxis.x)
            .selectAll('text')
            .attr('transform', 'rotate(20)')
          d3.select(`.fjs-vm-uid-${this._uid} .fjs-y-axis`)
            .call(newAxis.y)
        }
      }
    },
    methods: {
      update_numData (ids) {
        this.numData = ids
      },
      update_catData (ids) {
        this.catData = ids
      },
      handleResize () {
        const container = this.$el.querySelector(`.fjs-vm-uid-${this._uid} .fjs-vis-container svg`)
        // noinspection JSSuspiciousNameCombination
        this.height = container.getBoundingClientRect().width
        this.width = container.getBoundingClientRect().width
      },
      runAnalysisWrapper ({args}) {
        // function made available via requestHandling mixin
        this.runAnalysis({task_name: 'compute-boxplot', args})
          .then(response => {
            const results = JSON.parse(response)
            const data = JSON.parse(results.data)
            results.data = Object.keys(data).map(key => data[key])
            deepFreeze(results) // massively improve performance by telling Vue that the objects properties won't change
            this.results = results
          })
          .catch(error => console.error(error))
      }
    },
    components: {
      DataBox,
      TaskView
    },
    mixins: [
      requestHandling,
      svgtooltip
    ],
    mounted () {
      window.addEventListener('resize', this.handleResize)
      this.handleResize()
    },
    beforeDestroy () {
      window.removeEventListener('resize', this.handleResize)
    }
  }
</script>

<style lang="sass" scoped>
  @import './src/assets/base.sass'

  *
    font-family: Roboto, sans-serif

  .fjs-boxplot
    height: 100%
    width: 100%
    display: flex
    flex-direction: column

    .fjs-data-box-container
      height: 160px
      display: flex
      justify-content: space-around

    .fjs-vis-container
      flex: 1
      display: flex
      svg
        flex: 1
      .fjs-whisker, .fjs-quartile, .fjs-antenna
        shape-rendering: crispEdges
        stroke: black
        stroke-width: 2px
      .fjs-below-median-box
        stroke: none
        fill: rgb(205, 232, 254)
        shape-rendering: crispEdges
      .fjs-above-median-box
        stroke: none
        fill: rgb(180, 221, 253)
        shape-rendering: crispEdges
</style>


<!--CSS for dynamically created components-->
<style lang="sass">
  @import './src/assets/svgtooltip.sass'

  .fjs-bplt-axis
    shape-rendering: crispEdges
    stroke-width: 2px
    .tick
      shape-rendering: crispEdges
      text
        font-size: 18px
    line
      stroke: #999
  .fjs-x-axis
    .tick
      text
        text-anchor: start
</style>