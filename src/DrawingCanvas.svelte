<script>
  import { createEventDispatcher } from "svelte";
  import { pannable } from "./utils/pannable.js";
  const dispatch = createEventDispatcher();
  import { _, changeLanguage } from "./i18n";

  let canvas;
  let x = 0;
  let y = 0;
  let path = "";
  let minX = Infinity;
  let maxX = 0;
  let minY = Infinity;
  let maxY = 0;
  let paths = [];
  let drawing = false;

  $: hasDrawing = paths.length > 0;

  function handlePanStart(event) {
    if (event.detail.target !== canvas) {
      return (drawing = false);
    }
    drawing = true;
    x = event.detail.x;
    y = event.detail.y;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    paths = [...paths, ["M", x, y]];
    path = path + `M${x},${y}`;
  }

  function handlePanMove(event) {
    if (!drawing) return;
    x = event.detail.x;
    y = event.detail.y;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    paths = [...paths, ["L", x, y]];
    path = path + `L${x},${y}`;
  }

  function handlePanEnd() {
    drawing = false;
  }

  function finish() {
    if (!paths.length) return;
    const dx = -(minX - 10);
    const dy = -(minY - 10);
    const width = maxX - minX + 20;
    const height = maxY - minY + 20;
    dispatch("finish", {
      originWidth: width,
      originHeight: height,
      path: paths.reduce((acc, cur) => {
        return acc + cur[0] + (cur[1] + dx) + "," + (cur[2] + dy);
      }, "")
    });
  }

  function cancel() {
    dispatch("cancel");
  }

  function clearDrawing() {
    paths = [];
    path = "";
    x = 0;
    y = 0;
    minX = Infinity;
    maxX = 0;
    minY = Infinity;
    maxY = 0;
    drawing = false;
  }
</script>

<div
  bind:this={canvas}
  use:pannable
  on:panstart={handlePanStart}
  on:panmove={handlePanMove}
  on:panend={handlePanEnd}
  class="relative w-full h-full select-none">
  <div class="absolute right-0 bottom-0 mr-4 mb-4 flex">
    <button
      on:click={cancel}
      class="w-[4rem] bg-red-500 hover:bg-red-700 text-white font-normal py-1 px-4
      rounded mr-2 focus:outline-none">
      {$_("btnCancel")}
    </button>
    <button
      on:click={clearDrawing}
      class="w-[4rem] bg-white text-gray-800 font-normal py-1 px-4
      rounded mr-2 focus:outline-none border border-gray-600 border-dashed"
      class:opacity-50={!hasDrawing}
      class:cursor-not-allowed={!hasDrawing}
      disabled={!hasDrawing}>
      {$_("btnClear")}
    </button>
    <button
      on:click={finish}
      style="background-color: #1677ff;"
      class="w-[4rem] text-white font-normal py-1 px-4 rounded focus:outline-none
      hover:bg-blue-600 transition-colors duration-200"
      class:opacity-50={!hasDrawing}
      class:cursor-not-allowed={!hasDrawing}
      disabled={!hasDrawing}>
      {$_("btnDone")}
    </button>
  </div>
  <svg class="w-full h-full pointer-events-none">
    <path
      stroke-width="5"
      stroke-linejoin="round"
      stroke-linecap="round"
      d={path}
      stroke="black"
      fill="none" />
  </svg>
</div>
