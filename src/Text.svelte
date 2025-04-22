<svelte:options immutable={true} />

<script>
  import { onMount, createEventDispatcher } from "svelte";
  import Toolbar from "./Toolbar.svelte";
  import { pannable } from "./utils/pannable.js";
  import { tapout } from "./utils/tapout.js";
  import { timeout } from "./utils/helper.js";
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
  const Families = Object.keys(Fonts);
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
  const THROTTLE_MS = 16;

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
    const currentTime = Date.now();
    if (currentTime - lastMoveTime < THROTTLE_MS) return;
    lastMoveTime = currentTime;

    dx = (event.detail.x - startX) / pageScale;
    dy = (event.detail.y - startY) / pageScale;
  }

  function handlePanEnd(event) {
    if (operation !== "move") return;
    const newX = x + dx;
    const newY = y + dy;
    const elementWidth = editable.clientWidth;

    // Only check horizontal bounds
    if (isWithinHorizontalBounds(newX, elementWidth)) {
      dispatch("update", {
        x: newX,
        y: newY,
      });
    } else {
      // If outside horizontal bounds, clamp only the x position
      const clampedX = Math.max(0, Math.min(newX, pageWidth - elementWidth));
      dispatch("update", {
        x: clampedX,
        y: newY,
      });
    }

    dx = 0;
    dy = 0;
    operation = "";
  }
  function handlePanStart(event) {
    dispatch("activate");

    startX = event.detail.x;
    startY = event.detail.y;
    operation = "move";
  }
  function onFocus() {
    dispatch("activate");
    operation = "edit";
  }
  function onClick(event) {
    if (!isActive) {
      dispatch("activate");
    }
    operation = "edit";
  }
  async function onBlur() {
    if (operation !== "edit" || operation === "tool") return;
    editable.blur();
    sanitize();
    dispatch("update", {
      lines: extractLines(),
      width: editable.clientWidth,
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
    const childNodes = Array.from(editable.childNodes);
    if (e.keyCode === 13) {
      // prevent default adding div behavior
      e.preventDefault();
      const selection = window.getSelection();
      const focusNode = selection.focusNode;
      const focusOffset = selection.focusOffset;
      // the caret is at an empty line
      if (focusNode === editable) {
        editable.insertBefore(
          document.createElement("br"),
          childNodes[focusOffset]
        );
      } else if (focusNode instanceof HTMLBRElement) {
        editable.insertBefore(document.createElement("br"), focusNode);
      }
      // the caret is at a text line but not end
      else if (focusNode.textContent.length !== focusOffset) {
        document.execCommand("insertHTML", false, "<br>");
        // the carat is at the end of a text line
      } else {
        let br = focusNode.nextSibling;
        if (br) {
          editable.insertBefore(document.createElement("br"), br);
        } else {
          br = editable.appendChild(document.createElement("br"));
          br = editable.appendChild(document.createElement("br"));
        }
        // set selection to new line
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
      // For date fields, format the display but keep original value
      const defaultFormat = dateFormats && dateFormats.length > 0 
        ? dateFormats[0].value 
        : 'yyyy-MM-dd HH:mm';
      editable.innerHTML = formatDate(defaultFormat);
    } else {
      editable.innerHTML = text;
    }
    editable.focus();
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
    lines.push(lineText);
    return lines;
  }
  function onDelete() {
    dispatch("delete");
  }
  function formatDate(format) {
    try {
      // Parse the stored ISO date string
      const targetDate = new Date(text);
      
      if (isNaN(targetDate.getTime())) {
        throw new Error('Invalid date');
      }

      const pad = (num) => String(num).padStart(2, '0');
      
      // Get date components in the correct timezone
      const year = targetDate.getFullYear();
      const month = pad(targetDate.getMonth() + 1);
      const day = pad(targetDate.getDate());
      const hours24 = targetDate.getHours();
      const hours12 = hours24 % 12 || 12;
      const minutes = pad(targetDate.getMinutes());
      const ampm = hours24 >= 12 ? 'PM' : 'AM';

      // Format the date according to the pattern
      const formatDateTime = (pattern) => {
        let result = pattern
          .replace('YYYY', year)
          .replace('yyyy', year)
          .replace('MM', month)
          .replace('dd', day)
          .replace('DD', day)
          .replace('HH', pad(hours24))
          .replace('hh', pad(hours12))
          .replace('mm', minutes)
          .replace('a', ampm)
          .replace('A', ampm);
        
        console.log("Format pattern:", pattern);
        console.log("Formatted result:", result);
        return result;
      };

      return formatDateTime(format);
    } catch (error) {
      console.error('Date formatting error:', error);
      return text; // Return original text if formatting fails
    }
  }
  function updateDateFormat(event) {
    const newFormat = event.target.value;
    console.log("Selected new format:", newFormat);
    
    const formattedDate = formatDate(newFormat);
    console.log("Formatted date result:", formattedDate);
    
    // Only update display text, keep original ISO string in text prop
    editable.innerHTML = formattedDate;
    
    // Dispatch update to parent
    dispatch("update", {
      width: editable.clientWidth,
      displayText: formattedDate,
      format: newFormat
    });
  }
  onMount(render);
</script>

{#if operation && isActive}
  <Toolbar>
    <div
      use:tapout
      on:tapout={onBlurTool}
      on:mousedown={onFocusTool}
      on:touchstart={onFocusTool}
      class="h-full flex justify-center items-center bg-gray-300 border-b
      border-gray-400"
    >
      <div class="mr-2 flex items-center">
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
      <div class="mr-2 flex items-center">
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
      <div class="mr-2 flex items-center">
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
        <div class="mr-2 flex items-center">
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
        class="w-5 h-5 rounded-full bg-white cursor-pointer"
      >
        <img class="w-full h-full" src="/delete.svg" alt="delete object" />
      </div>
    </div>
  </Toolbar>
{/if}
<div
  use:tapout
  on:tapout={onBlur}
  class="absolute left-0 top-0 select-none"
  style="transform: translate({x + dx}px, {y + dy}px);"
>
  <div
    use:pannable
    on:panstart={handlePanStart}
    on:panmove={handlePanMove}
    on:panend={handlePanEnd}
    on:click={onClick}
    class="absolute w-full h-full border border-dotted
    border-gray-500"
    class:cursor-grab={!operation}
    class:cursor-grabbing={operation === "move"}
    class:editing={isActive && ["edit", "tool"].includes(operation)}
  />
  <div
    bind:this={editable}
    on:focus={onFocus}
    on:click={onClick}
    on:keydown={onKeydown}
    on:paste|preventDefault={onPaste}
    contenteditable="true"
    spellcheck="false"
    class="outline-none whitespace-no-wrap"
    style="font-size: {_size}px; font-family: '{_fontFamily}', serif;
    line-height: {_lineHeight}; -webkit-user-select: text;"
  />
</div>

<style>
  .editing {
    @apply pointer-events-none border-gray-800 border-dashed;
  }
  .font-family {
    @apply block appearance-none h-6 w-full bg-white pl-2 pr-8 rounded-sm leading-tight;
  }
</style>
