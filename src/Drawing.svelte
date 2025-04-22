<script>
  import { onMount, createEventDispatcher } from "svelte";
  import { pannable } from "./utils/pannable.js";
  import { readAsArrayBuffer } from "./utils/asyncReader.js";
  export let originWidth;
  export let originHeight;
  export let width;
  export let x;
  export let y;
  export let pageScale = 1;
  export let path;
  export let isActive = false;
  export let pageWidth = 0;
  export let pageHeight = 0;
  export let isLastPage = false;
  export let isFirstPage = false;
  const dispatch = createEventDispatcher();
  let startX;
  let startY;
  let svg;
  let operation = "";
  let dx = 0;
  let dy = 0;
  let dw = 0;
  let direction = "";
  const ratio = originWidth / originHeight;
  let lastMoveTime = 0;
  const THROTTLE_MS = 16; // Approximately 60fps

  async function render() {
    svg.setAttribute("viewBox", `0 0 ${originWidth} ${originHeight}`);
  }

  function isWithinBounds(newX, newY, elementWidth, elementHeight) {
    return (
      newX >= 0 && 
      (newX + elementWidth) <= pageWidth && 
      newY >= 0 && 
      (newY + elementHeight) <= pageHeight
    );
  }

  function isWithinHorizontalBounds(newX, elementWidth) {
    return newX >= 0 && (newX + elementWidth) <= pageWidth;
  }

  function handlePanMove(event) {
    const currentTime = Date.now();
    if (currentTime - lastMoveTime < THROTTLE_MS) return;
    lastMoveTime = currentTime;

    const _dx = (event.detail.x - startX) / pageScale;
    const _dy = (event.detail.y - startY) / pageScale;
    
    if (operation === "move") {
      // Allow movement but store the delta
      dx = _dx;
      dy = _dy;
    } else if (operation === "scale") {
      if (direction === "left-top") {
        let d = Math.min(_dx, _dy * ratio);
        // Allow scaling but store the delta
        dx = d;
        dw = -d;
        dy = d / ratio;
      }
      if (direction === "right-bottom") {
        let d = Math.max(_dx, _dy * ratio);
        // Allow scaling but store the delta
        dw = d;
      }
    }
  }

  function handlePanEnd(event) {
    if (operation === "move") {
      const newX = x + dx;
      const newY = y + dy;
      const elementWidth = width + dw;
      const elementHeight = (width + dw) / ratio;

      // Check horizontal bounds and vertical bounds for first/last page
      if (isWithinHorizontalBounds(newX, elementWidth)) {
        let clampedY = newY;
        
        // On first page, prevent dragging above page top
        if (isFirstPage) {
          clampedY = Math.max(0, newY);
        }
        
        // On last page, prevent dragging below page bottom
        if (isLastPage) {
          clampedY = Math.min(newY, pageHeight - elementHeight);
        }

        dispatch("update", {
          x: newX,
          y: clampedY
        });
      } else {
        // If outside horizontal bounds, clamp x position and check vertical bounds
        const clampedX = Math.max(0, Math.min(newX, pageWidth - elementWidth));
        let clampedY = newY;
        
        // On first page, prevent dragging above page top
        if (isFirstPage) {
          clampedY = Math.max(0, newY);
        }
        
        // On last page, prevent dragging below page bottom
        if (isLastPage) {
          clampedY = Math.min(newY, pageHeight - elementHeight);
        }

        dispatch("update", {
          x: clampedX,
          y: clampedY
        });
      }
    } else if (operation === "scale") {
      const newWidth = width + dw;
      const newHeight = newWidth / ratio;
      const newX = x + dx;
      const newY = y + dy;

      // For scaling, check bounds
      if (isWithinHorizontalBounds(newX, newWidth)) {
        let clampedY = newY;
        
        // On first page, prevent scaling above page top
        if (isFirstPage) {
          clampedY = Math.max(0, newY);
        }
        
        // On last page, prevent scaling below page bottom
        if (isLastPage) {
          clampedY = Math.min(newY, pageHeight - newHeight);
        }

        dispatch("update", {
          x: newX,
          y: clampedY,
          width: newWidth,
          scale: newWidth / originWidth
        });
      } else {
        // If scaling would exceed horizontal bounds, clamp width and position
        const clampedX = Math.max(0, Math.min(newX, pageWidth - newWidth));
        const clampedWidth = Math.min(newWidth, pageWidth);
        let clampedY = newY;
        
        // On first page, prevent scaling above page top
        if (isFirstPage) {
          clampedY = Math.max(0, newY);
        }
        
        // On last page, prevent scaling below page bottom
        if (isLastPage) {
          clampedY = Math.min(newY, pageHeight - (clampedWidth / ratio));
        }

        dispatch("update", {
          x: clampedX,
          y: clampedY,
          width: clampedWidth,
          scale: clampedWidth / originWidth
        });
      }
    }

    dx = 0;
    dy = 0;
    dw = 0;
    direction = "";
    operation = "";
  }

  function handlePanStart(event) {
    dispatch('activate');
    
    startX = event.detail.x;
    startY = event.detail.y;
    if (event.detail.target === event.currentTarget) {
      return (operation = "move");
    }
    operation = "scale";
    direction = event.detail.target.dataset.direction;
  }

  function onDelete() {
    dispatch("delete");
  }

  onMount(render);
</script>

<style>
  .operation {
    background-color: rgba(0, 0, 0, 0.1);
  }
</style>

<svelte:options immutable={true} />
<div
  class="absolute left-0 top-0 select-none"
  style="width: {width + dw}px; height: {(width + dw) / ratio}px; transform:
  translate({x + dx}px, {y + dy}px);">
  <div
    use:pannable
    on:panstart={handlePanStart}
    on:panmove={handlePanMove}
    on:panend={handlePanEnd}
    class="absolute w-full h-full"
    class:border={isActive}
    class:border-gray-400={isActive}
    class:border-dashed={isActive}
    class:cursor-grabbing={operation === 'move'}
    class:operation={isActive}>
    {#if isActive}
      <div
        data-direction="left-top"
        class="absolute left-0 top-0 w-4 h-4 md:w-10 md:h-10 bg-blue-300 rounded-full
        cursor-nwse-resize transform -translate-x-1/2 -translate-y-1/2 md:scale-25" />
      <div
        data-direction="right-bottom"
        class="absolute right-0 bottom-0 w-4 h-4 md:w-10 md:h-10 bg-blue-300 rounded-full
        cursor-nwse-resize transform translate-x-1/2 translate-y-1/2 md:scale-25" />
    {/if}
  </div>
  {#if isActive}
    <div
      on:click={onDelete}
      class="absolute left-0 top-0 right-0 w-5 h-5 md:w-12 md:h-12 m-auto rounded-full bg-white
      cursor-pointer transform -translate-y-1/2 md:scale-25">
      <img class="w-full h-full" src="/delete.svg" alt="delete object" />
    </div>
  {/if}
  <svg bind:this={svg} width="100%" height="100%">
    <path
      stroke-width="5"
      stroke-linejoin="round"
      stroke-linecap="round"
      stroke="black"
      fill="none"
      d={path} />
  </svg>
</div>
