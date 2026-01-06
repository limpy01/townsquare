<template>
  <div>
    <ul :style="indentStyle">
      <li v-if="node.id">
        <a :href="'#' + node.id">{{ node.name || node.id }}</a>
      </li>
    </ul>
    <div v-if="Array.isArray(node.content)">
      <NavigationNode
        v-for="(child, index) in node.content"
        :key="child.id || index"
        :node="child"
        :depth="depth + 1"
      />
    </div>
  </div>
</template>

<script>
export default {
  name: 'NavigationNode',
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
    }
  }
};
</script>

<style scoped>
ul {
  list-style: none;
  padding: 0;
  margin: 0 0 5px 0;
}
a {
  color: #3498db;
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
}
</style>
