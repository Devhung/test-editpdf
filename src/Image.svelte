<svelte:options immutable={true} />

<script>
  import { onMount, createEventDispatcher } from "svelte";
  import { pannable } from "./utils/pannable.js";
  import { readAsArrayBuffer } from "./utils/asyncReader.js";
  export let payload;
  export let file;
  export let width;
  export let height;
  export let x;
  export let y;
  export let pageScale = 1;
  export let isActive = false;
  export let pageWidth = 0;
  export let pageHeight = 0;
  export let isLastPage = false;
  export let isFirstPage = false;
  const dispatch = createEventDispatcher();
  let startX;
  let startY;
  let canvas;
  let operation = "";
  let direction = "";
  let dx = 0;
  let dy = 0;
  let dw = 0;
  let dh = 0;
  let ratio = null;
  let lastMoveTime = 0;
  const THROTTLE_MS = 16;
  let isScaleMode = false;
  let lastTap = 0;
  const DOUBLE_TAP_DELAY = 300; // milliseconds

  function isWithinBounds(newX, newY, elementWidth, elementHeight) {
    return (
      newX >= 0 &&
      newX + elementWidth <= pageWidth &&
      newY >= 0 &&
      newY + elementHeight <= pageHeight
    );
  }

  function isWithinHorizontalBounds(newX, elementWidth) {
    return newX >= 0 && newX + elementWidth <= pageWidth;
  }

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

  async function render() {
    // use canvas to prevent img tag's auto resize
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(payload, 0, 0);
    let scale = 1;
    const limit = 500;
    if (width > limit) {
      scale = limit / width;
    }
    if (height > limit) {
      scale = Math.min(scale, limit / height);
    }
    dispatch("update", {
      width: width * scale,
      height: height * scale,
    });
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      canvas.toBlob((blob) => {
        dispatch("update", {
          file: blob,
        });
      });
    }
  }

  function handlePanMove(event) {
    const currentTime = Date.now();
    if (currentTime - lastMoveTime < THROTTLE_MS) return;
    lastMoveTime = currentTime;

    const _dx = (event.detail.x - startX) / pageScale;
    const _dy = (event.detail.y - startY) / pageScale;

    if (operation === "move") {
      dx = _dx;
      dy = _dy;
      return;
    }

    if (operation === "scale") {
      if (direction === "left") {
        dw = -_dx;
        if (ratio !== null) {
          [dw, dh] = calculateDimensionWithRatio(dw, -Infinity);
        }
        dx = -dw;
      } else if (direction === "left-top") {
        dw = -_dx;
        dh = -_dy;
        if (ratio !== null) {
          [dw, dh] = calculateDimensionWithRatio(dw, dh);
        }
        dy = -dh;
        dx = -dw;
      } else if (direction === "top") {
        dh = -_dy;
        if (ratio !== null) {
          [dw, dh] = calculateDimensionWithRatio(-Infinity, dh);
        }
        dy = -dh;
      } else if (direction === "right-top") {
        dw = _dx;
        dh = -_dy;
        if (ratio !== null) {
          [dw, dh] = calculateDimensionWithRatio(dw, dh);
        }
        dy = -dh;
      } else if (direction === "right") {
        dw = _dx;
        if (ratio !== null) {
          [dw, dh] = calculateDimensionWithRatio(dw, -Infinity);
        }
      } else if (direction === "right-bottom") {
        dw = _dx;
        dh = _dy;
        if (ratio !== null) {
          [dw, dh] = calculateDimensionWithRatio(dw, dh);
        }
      } else if (direction === "bottom") {
        dh = _dy;
        if (ratio !== null) {
          [dw, dh] = calculateDimensionWithRatio(-Infinity, dh);
        }
        dy = -dh;
      } else if (direction === "left-bottom") {
        dw = -_dx;
        dh = _dy;
        if (ratio !== null) {
          [dw, dh] = calculateDimensionWithRatio(dw, dh);
        }
        dx = -dw;
      }
    }
  }

  function handlePanEnd(event) {
    if (operation === "move") {
      const newX = x + dx;
      const newY = y + dy;

      // Check horizontal bounds and vertical bounds for first/last page
      if (isWithinHorizontalBounds(newX, width)) {
        const clampedY = clampYPosition(newY, height);
        dispatch("update", {
          x: newX,
          y: clampedY,
        });
      } else {
        // If outside horizontal bounds, clamp x position and check vertical bounds
        const clampedX = Math.max(0, Math.min(newX, pageWidth - width));
        const clampedY = clampYPosition(newY, height);
        dispatch("update", {
          x: clampedX,
          y: clampedY,
        });
      }
    } else if (operation === "scale") {
      const newWidth = width + dw;
      const newHeight = height + dh;
      const newX = x + dx;
      const newY = y + dy;

      // For scaling, check bounds
      if (isWithinHorizontalBounds(newX, newWidth)) {
        const clampedY = clampYPosition(newY, newHeight);
        dispatch("update", {
          x: newX,
          y: clampedY,
          width: newWidth,
          height: newHeight,
        });
      } else {
        // If scaling would exceed horizontal bounds, clamp width and position
        const clampedX = Math.max(0, Math.min(newX, pageWidth - newWidth));
        const clampedY = clampYPosition(newY, newHeight);
        dispatch("update", {
          x: clampedX,
          y: clampedY,
          width: Math.min(newWidth, pageWidth),
          height: newHeight,
        });
      }
    }

    dx = 0;
    dy = 0;
    dw = 0;
    dh = 0;
    operation = "";
    direction = "";
  }
  function calculateDimensionWithRatio(dw, dh) {
    const dhFromDw = (width + dw) / ratio - height;
    if (dh > dhFromDw) {
      const dwFromDh = (height + dh) * ratio - width;
      return [dwFromDh, dh];
    }
    return [dw, dhFromDw];
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
  function handlePanStart(event) {
    dispatch("activate");

    startX = event.detail.x;
    startY = event.detail.y;

    // If in scale mode and touching corner button
    if (isScaleMode && event.detail.target.dataset.direction) {
      operation = "scale";
      direction = event.detail.target.dataset.direction;
      return;
    }

    // Otherwise move
    operation = "move";
  }
  function onDelete() {
    dispatch("delete");
  }
  onMount(render);
  onMount(() => {
    function isShiftKey(key) {
      return key === "Shift";
    }
    function onKeyDown(e) {
      if (isShiftKey(e.key)) {
        ratio = (width + dw) / (height + dh);
      }
    }
    function onKeyUp(e) {
      if (isShiftKey(e.key)) {
        ratio = null;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

</script>

<div
  class="absolute left-0 top-0 select-none"
  style="width: {width + dw}px; height: {height +
    dh}px; transform: translate({x + dx}px,
  {y + dy}px);"
  on:click={() => (isScaleMode = true)}
  on:touchend={handleTap}
>
  <div
    use:pannable
    on:panstart={handlePanStart}
    on:panmove={handlePanMove}
    on:panend={handlePanEnd}
    class="absolute w-full h-full"
    class:cursor-grabbing={operation === "move"}
    class:operation={isActive}
  >
    {#if isActive && isScaleMode}
      <div
        data-direction="left"
        class="resize-border h-full w-1 left-0 top-0 border-l cursor-ew-resize"
      />
      <div
        data-direction="top"
        class="resize-border w-full h-1 left-0 top-0 border-t cursor-ns-resize"
      />
      <div
        data-direction="bottom"
        class="resize-border w-full h-1 left-0 bottom-0 border-b cursor-ns-resize"
      />
      <div
        data-direction="right"
        class="resize-border h-full w-1 right-0 top-0 border-r cursor-ew-resize"
      />
      <div
        data-direction="left-top"
        class="resize-corner left-0 top-0 cursor-nwse-resize transform
        -translate-x-1/2 -translate-y-1/2 md:scale-25"
      />
      <div
        data-direction="right-top"
        class="resize-corner right-0 top-0 cursor-nesw-resize transform
        translate-x-1/2 -translate-y-1/2 md:scale-25"
      />
      <div
        data-direction="left-bottom"
        class="resize-corner left-0 bottom-0 cursor-nesw-resize transform
        -translate-x-1/2 translate-y-1/2 md:scale-25"
      />
      <div
        data-direction="right-bottom"
        class="resize-corner right-0 bottom-0 cursor-nwse-resize transform
        translate-x-1/2 translate-y-1/2 md:scale-25"
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
      class="btn-delete absolute left-0 right-0 m-auto rounded-full bg-white
      cursor-pointer transform -translate-y-1/2 md:scale-25"
    >
      <img class="w-full h-full pointer-events-none" src="/delete.svg" alt="delete object" />
    </div>
  {/if}
  <canvas class="w-full h-full" bind:this={canvas} />
</div>

<style>
  .operation {
    background-color: rgba(0, 0, 0, 0.3);
  }
  .resize-border {
    @apply absolute;
  }
  .resize-corner {
    @apply absolute w-12 h-12 bg-blue-300 rounded-full border-dashed border-gray-600 p-2;
  }
  .btn-delete {
    @apply w-10 h-10;
    top: -2rem;
  }
  @media (min-width: 768px) {
    .resize-corner {
      @apply w-12 h-12;
    }
    .btn-delete {
      @apply w-12 h-12;
      top: -1rem;
    }
  }
</style>
