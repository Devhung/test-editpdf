<svelte:options immutable={true} />

<script>
  import { onMount, createEventDispatcher } from "svelte";
  import Toolbar from "./Toolbar.svelte";
  import { pannable } from "./utils/pannable.js";
  import { tapout } from "./utils/tapout.js";
  import { timeout, formatDate } from "./utils/helper.js";
  import { Fonts } from "./utils/prepareAssets.js";
  export let size;
  export let text;
  export let lineHeight;
  export let x;
  export let y;
  export let fontFamily;
  export let pageScale = 1;
  export let isActive = false;
  export let pageWidth = 0;
  export let pageHeight = 0;
  export let isDateField = false;
  export let dateFormats = [];
  export let isLastPage = false;
  export let isFirstPage = false;
  export let isBold = false;
  export let isItalic = false;
  export let isUnderline = false;
  export let isReadOnly = false;
  export let defaultOperation = "edit";
  const Families = Object.entries(Fonts)
    .filter(([_, font]) => font.isDisplay === true)
    .map(([name]) => name);
  const dispatch = createEventDispatcher();
  let startX;
  let startY;
  let editable;
  let _size = size;
  let _lineHeight = lineHeight;
  let _fontFamily = fontFamily;
  let dx = 0;
  let dy = 0;
  let operation = "";
  let lastMoveTime = 0;
  let clickTimeout = null;
  const THROTTLE_MS = 16;
  const DOUBLE_CLICK_DELAY = 300; // 300ms for double click detection
  let isScaleMode = false;
  let direction = "";

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

  function handlePanMove(event) {
    // if (operation === "edit") return; // Prevent moving when editing
    if (operation !== "move" && operation !== "scale") return;

    const currentTime = Date.now();
    if (currentTime - lastMoveTime < THROTTLE_MS) return;
    lastMoveTime = currentTime;

    const _dx = (event.detail.x - startX) / pageScale;
    const _dy = (event.detail.y - startY) / pageScale;

    if (operation === "move") {
      dx = _dx;
      dy = _dy;
    } else if (operation === "scale") {
      // Calculate scale factor based on direction
      if (direction === "right-top") {
        const scaleFactor = Math.max(_dx, -_dy);
        _size = Math.max(12, size + scaleFactor / 2);
      } else if (direction === "right-bottom") {
        const scaleFactor = Math.max(_dx, _dy);
        _size = Math.max(12, size + scaleFactor / 2);
      }
    }
  }

  function handlePanEnd(event) {
    // if (operation === "edit") return; // Prevent pan end when editing

    if (operation === "move") {
      const newX = x + dx;
      const newY = y + dy;
      const elementWidth = editable.clientWidth;
      const elementHeight = editable.clientHeight;

      if (isWithinHorizontalBounds(newX, elementWidth)) {
        const clampedY = clampYPosition(newY, elementHeight);
        dispatch("update", {
          x: newX,
          y: clampedY,
        });
      } else {
        const clampedX = Math.max(0, Math.min(newX, pageWidth - elementWidth));
        const clampedY = clampYPosition(newY, elementHeight);
        dispatch("update", {
          x: clampedX,
          y: clampedY,
        });
      }
    } else if (operation === "scale") {
      dispatch("update", {
        size: _size
      });
    }

    dx = 0;
    dy = 0;
    direction = "";
    operation = operation === "edit" ? "edit" : "";
  }

  function handlePanStart(event) {
    // if (operation === "edit") return; // Prevent starting pan when editing

    dispatch("activate");

    startX = event.detail.x;
    startY = event.detail.y;

    // Check if clicking on a scale handle
    if (event.detail.target.dataset.direction) {
      operation = "scale";
      direction = event.detail.target.dataset.direction;
      return;
    }

    operation = "move";
  }

  function onFocus() {
    dispatch("activate");
  }

  function onClick(event) {
    //if (operation === "edit") return; // Ignore clicks when editing

    if (clickTimeout) {
      // Double click detected
      clearTimeout(clickTimeout);
      clickTimeout = null;
      onDoubleClick(event);
    } else {
      // First click - wait for potential second click
      clickTimeout = setTimeout(() => {
        clickTimeout = null;
        onSingleClick(event);
      }, DOUBLE_CLICK_DELAY);
    }
  }

  function onSingleClick(event) {
    if (!isActive) {
      dispatch("activate");
    }
    // Single click only activates for moving
    operation = "move";
  }

  function onDoubleClick(event) {
    if (!isActive) {
      dispatch("activate");
    }
    // Only enter edit mode if not readonly
    if (!isReadOnly) {
      operation = "edit";
      editable.focus();
    }
  }

  async function onBlur() {
    if (operation !== "edit" || operation === "tool") return;
    editable.blur();
    window.getSelection().removeAllRanges();

    const lines = extractLines();
    const hasContent = lines.some(line => line.trim().length > 0);

    if (!hasContent) {
      dispatch("delete");
      return;
    }

    const updatedText = lines.join('\n');

    dispatch("update", {
      text: updatedText,
      lines: lines,
      width: editable.clientWidth,
      isBold,
      isItalic,
      isUnderline
    });
    operation = "";
  }

  async function onPaste(e) {
    // get text only
    const pastedText = e.clipboardData.getData("text");
    document.execCommand("insertHTML", false, pastedText);
    // await tick() is not enough
    await timeout();
    sanitize();
  }

  function onKeydown(e) {
    // Handle text formatting shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch(e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          isBold = !isBold;
          updateTextStyle();
          break;
        case 'i':
          e.preventDefault();
          isItalic = !isItalic;
          updateTextStyle();
          break;
        case 'u':
          e.preventDefault();
          isUnderline = !isUnderline;
          updateTextStyle();
          break;
      }
    }

    // Existing enter key handling
    if (e.key === 'Enter') {
      e.preventDefault();
      const selection = window.getSelection();
      const focusNode = selection.focusNode;
      const focusOffset = selection.focusOffset;
      const childNodes = Array.from(editable.childNodes);

      if (focusNode === editable) {
        editable.insertBefore(
          document.createElement("br"),
          childNodes[focusOffset]
        );
      } else if (focusNode instanceof HTMLBRElement) {
        editable.insertBefore(document.createElement("br"), focusNode);
      } else if (focusNode.textContent.length !== focusOffset) {
        document.execCommand("insertHTML", false, "<br>");
      } else {
        let br = focusNode.nextSibling;
        if (br) {
          editable.insertBefore(document.createElement("br"), br);
        } else {
          br = editable.appendChild(document.createElement("br"));
          br = editable.appendChild(document.createElement("br"));
        }
        selection.collapse(br, 0);
      }
    }
  }

  function onFocusTool() {
    operation = "tool";
  }

  async function onBlurTool() {
    if (operation !== "tool" || operation === "edit") return;
    dispatch("update", {
      lines: extractLines(),
      lineHeight: _lineHeight,
      size: _size,
      fontFamily: _fontFamily,
    });
    operation = "";
  }

  function sanitize() {
    let weirdNode;
    while (
      (weirdNode = Array.from(editable.childNodes).find(
        (node) => !["#text", "BR"].includes(node.nodeName)
      ))
    ) {
      editable.removeChild(weirdNode);
    }
  }

  function onChangeFont() {
    dispatch("selectFont", {
      name: _fontFamily,
    });
  }

  function render() {
    if (isDateField && text) {
      const defaultFormat = dateFormats && dateFormats.length > 0
        ? dateFormats[0].value
        : 'yyyy-MM-dd HH:mm';
      editable.innerHTML = formatDate(text, defaultFormat);
    } else {
      editable.innerHTML = text ? text.replace(/\n/g, '<br>') : '';
    }

    // Apply text styles
    editable.style.fontWeight = isBold ? 'bold' : 'normal';
    editable.style.fontStyle = isItalic ? 'italic' : 'normal';
    editable.style.textDecoration = isUnderline ? 'underline' : 'none';

    // Auto start editing if this is a new text field
    startEditing();
  }

  function startEditing() {
    if (!isActive) {
      dispatch("activate");
    }
    // Set operation based on defaultOperation
    operation = defaultOperation;

    // Only focus and select text if in edit mode
    if (operation === "edit") {
      editable.focus();
      // Select all text for easy replacement
      const range = document.createRange();
      range.selectNodeContents(editable);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function extractLines() {
    const nodes = editable.childNodes;
    const lines = [];
    let lineText = "";
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index];
      if (node.nodeName === "BR") {
        lines.push(lineText);
        lineText = "";
      } else {
        lineText += node.textContent;
      }
    }
    if (lineText) {
      lines.push(lineText);
    }
    return lines.map(line => line.trim()).filter(line => line.length > 0);
  }

  function onDelete() {
    dispatch("delete");
  }


  function updateDateFormat(event) {
    const newFormat = event.target.value;
    const formattedDate = formatDate(text, newFormat);

    // Only update display text, keep original ISO string in text prop
    editable.innerHTML = formattedDate;

    // Dispatch update to parent
    dispatch("update", {
      width: editable.clientWidth,
      displayText: formattedDate,
      format: newFormat
    });
  }

  function updateTextStyle() {
    // Update text style and dispatch changes
    dispatch("update", {
      isBold,
      isItalic,
      isUnderline,
      lines: extractLines(),
      width: editable.clientWidth,
    });

    // Update visual style
    editable.style.fontWeight = isBold ? 'bold' : 'normal';
    editable.style.fontStyle = isItalic ? 'italic' : 'normal';
    editable.style.textDecoration = isUnderline ? 'underline' : 'none';
  }

  onMount(() => {
    render();
    // Add input event listener for real-time updates
    editable.addEventListener('input', handleInput);

    // Set initial operation
    operation = defaultOperation;

    return () => {
      editable.removeEventListener('input', handleInput);
    };
  });

  function handleInput(event) {
    const lines = extractLines();
    const updatedText = lines.join('\n');

    dispatch("update", {
      text: updatedText,
      lines: lines,
      width: editable.clientWidth,
      isBold,
      isItalic,
      isUnderline
    });
  }
</script>

{#if operation && isActive}
  <div
    style="background-color: rgba(255, 255, 255, 0.7);"
    class="fixed inset-0 backdrop-blur-[2px] z-40"
  />
  <Toolbar>
    <div
      use:tapout
      on:tapout={onBlurTool}
      on:mousedown={onFocusTool}
      on:touchstart={onFocusTool}
      class="h-full flex justify-center items-center bg-gray-300 border-b
      border-gray-400 relative z-50 overflow-x-auto"
    >
      <div class="mr-2 flex items-center min-w-5">
        <img src="/line_height.svg" class="w-6 mr-2" alt="Line height" />
        <input
          type="number"
          min="1"
          max="10"
          step="0.1"
          class="h-6 w-12 text-center flex-shrink-0 rounded-sm"
          bind:value={_lineHeight}
        />
      </div>
      <div class="mr-2 flex items-center min-w-5">
        <img src="/text.svg" class="w-6 mr-2" alt="Font size" />
        <input
          type="number"
          min="12"
          max="120"
          step="1"
          class="h-6 w-12 text-center flex-shrink-0 rounded-sm"
          bind:value={_size}
        />
      </div>
      <div class="mr-2 flex items-center min-w-5 ">
        <img src="/text-family.svg" class="w-4 mr-2" alt="Font family" />
        <div class="relative w-32 md:w-40">
          <select
            bind:value={_fontFamily}
            on:change={onChangeFont}
            class="font-family"
          >
            {#each Families as family}
              <option value={family}>{family}</option>
            {/each}
          </select>
          <div
            class="pointer-events-none absolute inset-y-0 right-0 flex
            items-center px-2 text-gray-700"
          >
            <svg
              class="fill-current h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <path
                d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757
                6.586 4.343 8z"
              />
            </svg>
          </div>
        </div>
      </div>
      {#if isDateField}
        <div class="mr-2 flex items-center min-w-10">
          <img src="/calendar.png" class="w-4 mr-2" alt="Date format" />
          <div class="relative w-[10rem] md:w-48">
            <select
              on:change={updateDateFormat}
              class="font-family"
            >
              {#each dateFormats as format}
                <option value={format.value}>{format.label}</option>
              {/each}
            </select>
            <div
              class="pointer-events-none absolute inset-y-0 right-0 flex
              items-center px-2 text-gray-700"
            >
              <svg
                class="fill-current h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
              >
                <path
                  d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757
                  6.586 4.343 8z"
                />
              </svg>
            </div>
          </div>
        </div>
      {/if}
      <div
        on:click={onDelete}
        class="w-5 h-5 rounded-full bg-white cursor-pointer min-w-1"
      >
        <img class="w-full h-full" src="/delete.svg" alt="delete object" />
      </div>
    </div>
  </Toolbar>
{/if}
<div
  use:tapout
  on:tapout={onBlur}
  class="absolute left-0 top-0 select-none cursor-move"
  class:cursor-text={operation === "edit"}
  class:read-only={isReadOnly}
  class:operation={operation === "edit" || isActive}
  style="
    transform: translate({x + dx}px, {y + dy}px);
    font-family: {_fontFamily};
    font-size: {_size}px;
    line-height: {_lineHeight};
    {isBold ? 'font-weight: bold;' : ''}
    {isItalic ? 'font-style: italic;' : ''}
    {isUnderline ? 'text-decoration: underline;' : ''}
  "
  use:pannable
  on:panstart={handlePanStart}
  on:panmove={handlePanMove}
  on:panend={handlePanEnd}
  on:focus={onFocus}
  on:click={onClick}
>
  {#if isActive}
    <!-- Control buttons on the right -->
    <div class="absolute flex gap-1.5" style="top: -3rem; left: 50%; transform: translateX(-50%); gap: 0.5rem;">
      <!-- Increase size button -->
      <button
        on:click={() => {
          _size = Math.min(120, _size + 2);
          dispatch("update", { size: _size });
        }}
        class="w-10 h-10 md:w-8 md:h-8 rounded-full hover:bg-blue-700 active:bg-blue-700
        flex items-center justify-center cursor-pointer shadow-md focus:outline-none"
        style="background-color: rgb(22, 119, 255)"
        title="Tăng kích thước"
      >
        <span class="text-white text-sm font-bold">+</span>
      </button>

      <!-- Decrease size button -->
      <button
        on:click={() => {
          _size = Math.max(12, _size - 2);
          dispatch("update", { size: _size });
        }}
        class="w-10 h-10 md:w-8 md:h-8 rounded-full hover:bg-blue-700 active:bg-blue-700
        flex items-center justify-center cursor-pointer shadow-md focus:outline-none"
        style="background-color: rgb(22, 119, 255)"
        title="Giảm kích thước"
      >
        <span class="text-white text-sm font-bold">−</span>
      </button>

      <!-- Delete button -->
      <button
        on:click={onDelete}
        class="w-10 h-10 md:w-8 md:h-8 rounded-full bg-red-500 hover:bg-red-700 active:bg-red-700
        flex items-center justify-center cursor-pointer shadow-md focus:outline-none"
        title="Xóa text"
      >
        <span class="text-white text-sm font-bold">x</span>
      </button>
    </div>

    <!-- Size indicator - only show when adjusting -->
    {#if operation === "scale"}
      <div
        class="absolute right-0 top-0 transform translate-x-full -translate-y-full
        bg-gray-800 text-white rounded px-2 py-1 text-xs opacity-80"
      >
        {Math.round(_size)}px
      </div>
    {/if}
  {/if}
  <div
    bind:this={editable}
    on:focus={onFocus}
    on:click={onClick}
    on:keydown={onKeydown}
    on:paste|preventDefault={onPaste}
    contenteditable="true"
    spellcheck="false"
    class="outline-none whitespace-no-wrap relative"
    class:pointer-events-auto={operation === "edit"}
  />
</div>

<style>
  .operation {
    background-color: rgb(169 201 236);
    border: 2px solid rgba(22, 119, 255, 0.2);
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(22, 119, 255, 0.1);
  }
  .operation-edit {
    background-color: rgba(37, 99, 235, 0.1);
    border: 1px solid rgba(37, 99, 235, 0.2);
    border-radius: 4px;
    padding: 4px 8px;
  }
  .font-family {
    @apply block appearance-none h-6 w-full bg-white pl-2 pr-8 rounded-sm leading-tight;
  }
  .cursor-text {
    cursor: text !important;
  }
  .read-only {
    opacity: 0.8;
    cursor: move !important;
    user-select: none;
  }
  .read-only:hover {
    opacity: 1;
  }
  button {
    transition: all 0.15s ease;
    outline: none !important;
  }
  button:active {
    transform: scale(0.9);
  }
  button:focus {
    outline: none !important;
  }
</style>
