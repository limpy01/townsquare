<template>
  <div
    id="app"
    :style="{
      backgroundImage: `url('assets/background.png')`
    }"
  >
    <div @click="expanded = false">
      <h1>参考说明</h1>
      <div v-if="manualData.length">
        <ManualNode
          v-for="item in manualData"
          :key="item.id"
          :node="item"
          :depth="1"
        />
      </div>
      <div v-else>
        <p>正在加载...</p>
      </div>
    </div>
    <div class="sidebar" @mouseenter="expanded = true" @mouseleave="expanded = false" @click="expanded = true">
      <em v-if="!expanded">
        <font-awesome-icon icon="arrow-left" />
      </em>
      <div v-if="expanded" class="sidebar-content">
        <Navigation
          v-for="item in manualData"
          :key="item.id"
          :node="item"
          :depth="1"
        />
      </div>
    </div>
  </div>
</template>

<script>
import manualData from './scripts/manual.json'; // Relative path updated
import Navigation from './components/Navigation.vue';

export default {
  name: 'Manual',
  data() {
    return {
      manualData,
      expanded: false
    };
  },
  components: {
    Navigation,
    ManualNode: {
      name: 'ManualNode',
      props: {
        node: Object,
        depth: {
          type: Number,
          default: 1
        }
      },
      computed: {
        indentStyle() {
          return {
            marginLeft: `${(this.depth - 1) * 20}px`
          };
        },
        extraIndentStyle() {
          return {
            marginLeft: `${this.depth * 20}px` // one level deeper
          };
        }
      },
      render(h) {
        const elements = [];

        if (this.node.name) {
          const headingTag = `h${Math.min(this.depth + 1, 6)}`;
          elements.push(h(headingTag, { attrs: { id: this.node.id }, style: this.indentStyle }, this.node.name));
        }

        if (Array.isArray(this.node.method) && this.node.method.length > 0) {
          elements.push(
            h(
              'ul',
              { style: this.indentStyle },
              this.node.method.map((step, i) => h('li', { key: i }, step))
            )
          );
        }

        if (Array.isArray(this.node.note) && this.node.note.length > 0) {
          elements.push(h('h4', { style: this.extraIndentStyle }, '备注：'));
          elements.push(
            h(
              'ul',
              { style: this.extraIndentStyle },
              this.node.note.map((n, i) => h('li', { key: i }, n))
            )
          );
        }

        if (Array.isArray(this.node.content)) {
          this.node.content.forEach((childNode, index) => {
            elements.push(
              h('ManualNode', {
                props: {
                  node: childNode,
                  depth: this.depth + 1
                },
                key: childNode.id || index
              })
            );
          });
        }

        return h('div', elements);
      }
    }

  }
};
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow-x: auto;
}

body {
  font-size: 1.2em;
  line-height: 1.4;
  background: url("assets/background.png") center center;
  background-size: cover;
  height: 100%;
  font-family: "Roboto Condensed", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  padding: 0;
  margin: 0;
}

#app > div:first-child { /* Target the direct child of #app that holds your main content */
  position: relative; /* Essential to layer it above the fixed background */
  z-index: 1; /* Ensures content is on top of the fixed background */
  background-color: rgba(255, 255, 255, 0.5); /*Semi-transparent white for readability*/
  padding: 20px; /* Add some padding around your content */
  min-height: 100vh; /* Ensure the content area also covers at least the viewport height */
  box-sizing: border-box; /* Include padding in element's total width and height */
}

::-webkit-scrollbar {
  width: 10px;
}
::-webkit-scrollbar-thumb {
  background: rgb(54, 54, 54); 
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgb(97, 97, 97); 
}
::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.5); /* This makes the scrollbar background semi-transparent white */
  border-radius: 10px; /* Optional: adds rounded corners to the track */
}
</style>

<style scoped>
ul {
  padding-left: 20px;
  margin-bottom: 10px;
}
h2, h3, h4, h5, h6 {
  font-weight: bold;
  color: #2c3e50;
  margin: 10px 0;
}

.sidebar {
  position: fixed;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  width: 40px;
  height: auto;
  max-height: 500px;
  overflow-x: hidden;
  overflow-y: auto;
  background: #ffd3d3;
  border-right: 1px solid #ccc;
  transition: width 0.3s ease;
  z-index: 1000;
}

.sidebar:hover {
  width: 220px; /* expands on hover */
}

.sidebar-content {
  padding: 15px;
}

</style>
