<svelte:options immutable={true} />

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
  let isScaleMode = false;
  let lastTap = 0;
  const DOUBLE_TAP_DELAY = 300; // milliseconds

  // Function to render SVG with correct viewBox
  async function render() {
    svg.setAttribute("viewBox", `0 0 ${originWidth} ${originHeight}`);
  }

  // Check if element is within horizontal page bounds
  function isWithinHorizontalBounds(newX, elementWidth) {
    return newX >= 0 && newX + elementWidth <= pageWidth;
  }

  // Constants for pan operations
  const PAN_OPERATIONS = {
    MOVE: "move",
    SCALE: "scale",
  };

  // Helper function to clamp Y position based on page constraints
  function clampYPosition(y, elementHeight) {
    if (isFirstPage) {
      return Math.max(0, y);
    }
    if (isLastPage) {
      return Math.min(y, pageHeight - elementHeight);
    }
    return y;
  }

  // Handle movement operation in pan end
  function handleMoveOperation() {
    const elementWidth = width + dw;
    const elementHeight = elementWidth / ratio;
    const newX = x + dx;
    const newY = y + dy;

    // If within horizontal bounds, only clamp Y
    if (isWithinHorizontalBounds(newX, elementWidth)) {
      const clampedY = clampYPosition(newY, elementHeight);
      return { x: newX, y: clampedY };
    }

    // If outside horizontal bounds, clamp both X and Y
    const clampedX = Math.max(0, Math.min(newX, pageWidth - elementWidth));
    const clampedY = clampYPosition(newY, elementHeight);
    return { x: clampedX, y: clampedY };
  }

  // Handle scale operation in pan end
  function handleScaleOperation() {
    const newWidth = width + dw;
    const newHeight = newWidth / ratio;
    const newX = x + dx;
    const newY = y + dy;

    // If within horizontal bounds, only clamp Y
    if (isWithinHorizontalBounds(newX, newWidth)) {
      const clampedY = clampYPosition(newY, newHeight);
      return {
        x: newX,
        y: clampedY,
        width: newWidth,
        scale: newWidth / originWidth,
      };
    }

    // If scaling would exceed bounds, clamp width and position
    const clampedWidth = Math.min(newWidth, pageWidth);
    const clampedX = Math.max(0, Math.min(newX, pageWidth - clampedWidth));
    const clampedY = clampYPosition(newY, clampedWidth / ratio);
    return {
      x: clampedX,
      y: clampedY,
      width: clampedWidth,
      scale: clampedWidth / originWidth,
    };
  }

  function handlePanMove(event) {
    const currentTime = Date.now();
    if (currentTime - lastMoveTime < THROTTLE_MS) return;
    lastMoveTime = currentTime;

    const _dx = (event.detail.x - startX) / pageScale;
    const _dy = (event.detail.y - startY) / pageScale;

    if (operation === PAN_OPERATIONS.MOVE) {
      dx = _dx;
      dy = _dy;
    } else if (operation === PAN_OPERATIONS.SCALE) {
      if (direction === "left-top") {
        // Keep aspect ratio while scaling from left-top
        let d = Math.min(_dx, _dy * ratio);
        dx = d;
        dw = -d;
        dy = d / ratio;
      }
      if (direction === "right-bottom") {
        // Keep aspect ratio while scaling from right-bottom
        let d = Math.max(_dx, _dy * ratio);
        dw = d;
      }
      if (direction === "right-top") {
        // Keep aspect ratio while scaling from right-top
        let d = Math.max(_dx, -_dy * ratio);
        dw = d;
        dy = -d / ratio;
      }
      if (direction === "left-bottom") {
        // Keep aspect ratio while scaling from left-bottom
        let d = Math.min(_dx, -_dy * ratio);
        dx = d;
        dw = -d;
        // dy không đổi vì kéo xuống dưới
      }
    }
  }

  function handlePanEnd(event) {
    let updates;

    if (operation === PAN_OPERATIONS.MOVE) {
      updates = handleMoveOperation();
    } else if (operation === PAN_OPERATIONS.SCALE) {
      updates = handleScaleOperation();
    }

    // Reset pan state
    dx = 0;
    dy = 0;
    dw = 0;
    direction = "";
    operation = "";

    if (updates) {
      dispatch("update", updates);
    }
  }

  function handlePanStart(event) {
    dispatch("activate");
    startX = event.detail.x;
    startY = event.detail.y;

    // Nếu đang ở mode scale và chạm vào nút góc
    if (isScaleMode && event.detail.target.dataset.direction) {
      operation = PAN_OPERATIONS.SCALE;
      direction = event.detail.target.dataset.direction;
      return;
    }

    // Còn lại là move
    operation = PAN_OPERATIONS.MOVE;
  }

  function onDelete() {
    dispatch("delete");
  }

  function handleTap(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;

    if (tapLength < DOUBLE_TAP_DELAY && tapLength > 0) {
      isScaleMode = true;
      event.preventDefault();
    } else {
      isScaleMode = false;
    }
    lastTap = currentTime;
  }

  onMount(render);
</script>

<div
  class="absolute left-0 top-0 select-none"
  style="width: {width + dw}px; height: {(width + dw) / ratio}px; transform:
  translate({x + dx}px, {y + dy}px);"
  on:click={() => (isScaleMode = true)}
  on:touchend={handleTap}
>
  <div
    use:pannable
    on:panstart={handlePanStart}
    on:panmove={handlePanMove}
    on:panend={handlePanEnd}
    class="absolute w-full h-full"
    class:border={isActive}
    class:border-gray-400={isActive}
    class:border-dashed={isActive}
    class:cursor-grabbing={operation === "move"}
    class:operation={isActive}
  >
    {#if isActive && isScaleMode}
      <div
        data-direction="left-top"
        class="absolute left-0 top-0 w-12 h-12 bg-blue-300 rounded-full p-2
        cursor-nwse-resize transform -translate-x-1/2 -translate-y-1/2 md:scale-25"
      />
      <div
        data-direction="right-top"
        class="absolute right-0 top-0 w-12 h-12 bg-blue-300 rounded-full p-2
        cursor-nesw-resize transform translate-x-1/2 -translate-y-1/2 md:scale-25"
      />
      <div
        data-direction="left-bottom"
        class="absolute left-0 bottom-0 w-12 h-12 bg-blue-300 rounded-full p-2
        cursor-nesw-resize transform -translate-x-1/2 translate-y-1/2 md:scale-25"
      />
      <div
        data-direction="right-bottom"
        class="absolute right-0 bottom-0 w-12 h-12 bg-blue-300 rounded-full p-2
        cursor-nwse-resize transform translate-x-1/2 translate-y-1/2 md:scale-25"
      />
    {/if}
  </div>
  {#if isActive && isScaleMode}
    <div
      on:click|stopPropagation|preventDefault={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onDelete();
      }}
      on:touchend|stopPropagation|preventDefault={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onDelete();
      }}
      class="btn-delete absolute left-0 right-0 w-10 h-10 m-auto rounded-full bg-white
      cursor-pointer transform -translate-y-1/2 md:scale-25"
    >
      <img
        class="w-full h-full pointer-events-none"
        src="/delete.svg"
        alt="delete object"
      />
    </div>
  {/if}
  <svg bind:this={svg} width="100%" height="100%">
    <path
      stroke-width="5"
      stroke-linejoin="round"
      stroke-linecap="round"
      stroke="black"
      fill="none"
      d={path}
    />
  </svg>
</div>

<style>
  .operation {
    background-color: rgba(0, 0, 0, 0.1);
  }
  .btn-delete {
    top: -2rem;
  }
  @media (min-width: 768px) {
    .btn-delete {
      top: -1rem;
    }
  }
</style>
