<script>
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import Tailwind from "./Tailwind.svelte";
  import PDFPage from "./PDFPage.svelte";
  import Image from "./Image.svelte";
  import Text from "./Text.svelte";
  import Drawing from "./Drawing.svelte";
  import DrawingCanvas from "./DrawingCanvas.svelte";
  import prepareAssets, { fetchFont } from "./utils/prepareAssets.js";
  import {
    readAsArrayBuffer,
    readAsImage,
    readAsPDF,
    readAsDataURL,
  } from "./utils/asyncReader.js";
  import { ggID } from "./utils/helper.js";
  import { save } from "./utils/PDF.js";
  import { _, changeLanguage } from "./i18n";
  const genID = ggID();
  let pdfFile;
  let pdfName = "";
  let pages = [];
  let pagesScale = [];
  let allObjects = [];
  let currentFont = "Times-Roman";
  let focusId = null;
  let selectedPageIndex = -1;
  let saving = false;
  let addingDrawing = false;
  let activeObjectId = null;

  // Tool visibility control
  let showTools = {
    choosePDF: true,
    addImage: true,
    addText: true,
    addDrawing: true,
    savePDF: true,
    patient: {
      showInfo: true, // Controls whether to show patient info section
      allowCreate: true, // Controls whether to allow creating new patients
    },
  };

  // Add patient info states
  let showPatientDropdown = false;
  let patientInfo = {
    dateOfBirth: "1990-01-01",
    fullName: "John Doe",
  }; // This will store patient data when available

  // Function to toggle patient dropdown
  function togglePatientDropdown() {
    showPatientDropdown = !showPatientDropdown;
  }

  // Handle click outside to close dropdown
  function handleClickOutside(event) {
    const dropdown = document.querySelector(".patient-dropdown");
    const button = document.querySelector(".patient-button");

    if (showPatientDropdown && dropdown && button) {
      if (!dropdown.contains(event.target) && !button.contains(event.target)) {
        showPatientDropdown = false;
      }
    }
  }

  // Function to handle patient selection or creation
  function handlePatientAction(action) {
    if (action === "create") {
      // Handle create new patient
      window.parent.postMessage(
        {
          type: "PATIENT_CREATE",
        },
        "*"
      );
    }
    showPatientDropdown = false;
  }

  // Handle incoming messages from parent window/WebView
  function handleMessage(event) {
    // Verify origin for security if needed
    // if (event.origin !== "YOUR_ALLOWED_ORIGIN") return;

    const { type, data } = event.data;

    switch (type) {
      case "INIT_DATA":
        // Handle initialization data
        if (data) {
          // Set title/filename if provided
          if (data.title) {
            pdfName = data.title;
          }

          // Set PDF file if provided
          if (data.pdfFile instanceof Blob) {
            addPDF(data.pdfFile);
          }

          // Update tool visibility if provided
          if (data.tools) {
            showTools = { ...showTools, ...data.tools };
          }

          // Update patient info if provided
          if (data.patientInfo) {
            patientInfo = { ...patientInfo, ...data.patientInfo };
          }

          // Set language if provided
          if (data.language) {
            changeLanguage(data.language);
          }
        }
        break;

      case "PDF_LOAD":
        if (data instanceof Blob) {
          addPDF(data);
        }
        break;
      case "PDF_SAVE":
        savePDF().then(async () => {
          // Convert saved PDF to blob and send back to parent
          const pdfBlob = await save(pdfFile, allObjects, pdfName, pagesScale);
          window.parent.postMessage(
            {
              type: "PDF_SAVED",
              data: pdfBlob,
            },
            "*"
          );
        });
        break;
      case "IMAGE_ADD":
        if (data instanceof Blob) {
          addImage(data);
        }
        break;
      case "TOOLS_VISIBILITY_UPDATE":
        if (data && typeof data === "object") {
          showTools = { ...showTools, ...data };
        }
        break;
      case "PATIENT_INFO_UPDATE":
        if (data && typeof data === "object") {
          patientInfo = data;
        }
        break;
      case "LANGUAGE_CHANGE":
        if (data && typeof data === "string") {
          changeLanguage(data);
        }
        break;
    }
  }

  onMount(() => {
    // Listen for messages from parent window/WebView
    window.addEventListener("message", handleMessage);

    // Notify parent that the editor is ready and request init data
    window.parent.postMessage(
      {
        type: "EDITOR_READY",
        data: {
          showTools,
          patientInfo,
          language: $_("currentLanguage"),
        },
      },
      "*"
    );

    // Add click outside listener
    document.addEventListener("click", handleClickOutside);

    return () => {
      window.removeEventListener("message", handleMessage);
      document.removeEventListener("click", handleClickOutside);
    };
  });

  async function onUploadPDF(e) {
    const files = e.target.files || (e.dataTransfer && e.dataTransfer.files);
    const file = files[0];
    if (!file || file.type !== "application/pdf") return;
    selectedPageIndex = -1;
    try {
      await addPDF(file);
      selectedPageIndex = 0;
    } catch (e) {
      console.log(e);
    }
  }
  async function addPDF(file) {
    try {
      const pdf = await readAsPDF(file);
      pdfName = file.name;
      pdfFile = file;
      const numPages = pdf.numPages;
      pages = Array(numPages)
        .fill()
        .map((_, i) => pdf.getPage(i + 1));
      allObjects = pages.map(() => []);
      pagesScale = Array(numPages).fill(1);
    } catch (e) {
      console.log("Failed to add pdf.");
      throw e;
    }
  }
  async function onUploadImage(e) {
    const file = e.target.files[0];
    if (file && selectedPageIndex >= 0) {
      addImage(file);
    }
    e.target.value = null;
  }
  async function addImage(file) {
    try {
      // get dataURL to prevent canvas from tainted
      const url = await readAsDataURL(file);
      const img = await readAsImage(url);
      const id = genID();
      const { width, height } = img;
      const object = {
        id,
        type: "image",
        width,
        height,
        x: 0,
        y: 0,
        payload: img,
        file,
      };
      allObjects = allObjects.map((objects, pIndex) =>
        pIndex === selectedPageIndex ? [...objects, object] : objects
      );
    } catch (e) {
      console.log(`Fail to add image.`, e);
    }
  }
  function onAddTextField() {
    if (selectedPageIndex >= 0) {
      addTextField();
    }
  }
  function addTextField(text = "New Text Field") {
    const id = genID();
    fetchFont(currentFont);
    const object = {
      id,
      text,
      type: "text",
      size: 16,
      width: 0, // recalculate after editing
      lineHeight: 1.4,
      fontFamily: currentFont,
      x: 0,
      y: 0,
    };
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex === selectedPageIndex ? [...objects, object] : objects
    );
  }
  function addPatientInfoField(info) {
    const text = `Patient: ${info.fullName}\nDOB: ${info.dateOfBirth}`;
    addTextField(text);
  }
  function handleDrop(e) {
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (selectedPageIndex >= 0) {
        if (data.type === "patient-info") {
          addPatientInfoField(data.data);
        } else if (data.type === "patient-field") {
          const text =
            data.field === "fullname"
              ? `Patient: ${data.value}`
              : `DOB: ${data.value}`;
          addTextField(text);
        }
      }
    } catch (err) {
      console.log("Invalid drop data");
    }
  }
  function onAddDrawing() {
    if (selectedPageIndex >= 0) {
      addingDrawing = true;
    }
  }
  function addDrawing(originWidth, originHeight, path, scale = 1) {
    const id = genID();
    const object = {
      id,
      path,
      type: "drawing",
      x: 0,
      y: 0,
      originWidth,
      originHeight,
      width: originWidth * scale,
      scale,
    };
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex === selectedPageIndex ? [...objects, object] : objects
    );
  }
  function selectFontFamily(event) {
    const name = event.detail.name;
    fetchFont(name);
    currentFont = name;
  }
  function selectPage(index) {
    selectedPageIndex = index;
  }
  function updateObject(objectId, payload) {
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex == selectedPageIndex
        ? objects.map((object) =>
            object.id === objectId ? { ...object, ...payload } : object
          )
        : objects
    );
  }
  function deleteObject(objectId) {
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex == selectedPageIndex
        ? objects.filter((object) => object.id !== objectId)
        : objects
    );
  }
  function handleObjectActivation(id) {
    activeObjectId = id;
  }
  function handleBackgroundClick(e) {
    if (e.target.nodeName === "CANVAS") activeObjectId = null;
  }
  function onMeasure(scale, i) {
    pagesScale[i] = scale;
  }
  // FIXME: Should wait all objects finish their async work
  async function savePDF() {
    if (!pdfFile || saving || !pages.length) return;
    saving = true;
    try {
      await save(pdfFile, allObjects, pdfName, pagesScale);
    } catch (e) {
      console.log(e);
    } finally {
      saving = false;
    }
  }

  function handlePatientButtonBlur(event) {
    // Check if the new focus target is inside the dropdown
    const relatedTarget = event.relatedTarget;
    const dropdown = document.querySelector(".patient-dropdown");

    // Only close if not clicking inside dropdown
    if (!dropdown.contains(relatedTarget)) {
      showPatientDropdown = false;
    }
  }
</script>

<svelte:window
  on:dragenter|preventDefault
  on:dragover|preventDefault
  on:drop|preventDefault={(e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onUploadPDF(e);
    } else {
      handleDrop(e);
    }
  }}
/>
<Tailwind />
<main class="flex flex-col items-center py-16 bg-gray-100 min-h-screen">
  <div
    class="fixed z-10 top-0 left-0 right-0 h-12 flex justify-center items-center
    bg-gray-200 border-b border-gray-300"
  >
    {#if showTools.choosePDF}
      <input
        type="file"
        name="pdf"
        id="pdf"
        on:change={onUploadPDF}
        class="hidden"
      />
      <label
        class="whitespace-no-wrap bg-blue-500 hover:bg-blue-700 text-white
        font-bold py-1 px-3 md:px-4 rounded mr-3 cursor-pointer md:mr-4"
        for="pdf"
      >
        {$_("btnChoosePDF")}
      </label>
    {/if}

    <div
      class="relative mr-3 flex h-8 bg-gray-400 rounded-sm
      md:mr-4"
    >
      {#if showTools.addImage}
        <button
          class="flex items-center justify-center h-full w-8 hover:bg-gray-500
          cursor-pointer"
          class:cursor-not-allowed={selectedPageIndex < 0}
          class:bg-gray-500={selectedPageIndex < 0}
          on:click={() => document.getElementById("image").click()}
        >
          <img src="image.svg" alt="An icon for adding images" />
          <input
            type="file"
            id="image"
            name="image"
            class="hidden"
            on:change={onUploadImage}
          />
        </button>
      {/if}
      {#if showTools.addText}
        <button
          class="flex items-center justify-center h-full w-8 hover:bg-gray-500
          cursor-pointer border-b-2 border-gray-600"
          class:cursor-not-allowed={selectedPageIndex < 0}
          class:bg-gray-500={selectedPageIndex < 0}
          on:click={onAddTextField}
        >
          <img src="notes.svg" alt="An icon for adding text" />
        </button>
      {/if}
      {#if showTools.addDrawing}
        <button
          class="flex items-center justify-center h-full w-8 hover:bg-gray-500
          cursor-pointer"
          on:click={onAddDrawing}
          class:cursor-not-allowed={selectedPageIndex < 0}
          class:bg-gray-500={selectedPageIndex < 0}
        >
          <img src="gesture.svg" alt="An icon for adding drawing" />
        </button>
      {/if}
      {#if showTools.patient.showInfo}
        <div class="relative">
          <button
            class="flex items-center justify-center h-full w-8 hover:bg-gray-500
            cursor-pointer"
            class:cursor-not-allowed={selectedPageIndex < 0}
            class:bg-gray-500={selectedPageIndex < 0}
            draggable="true"
            on:dragstart={(e) => {
              e.dataTransfer.setData(
                "text/plain",
                JSON.stringify({
                  type: "patient-info",
                  data: patientInfo,
                })
              );
            }}
            on:click={togglePatientDropdown}
            on:blur={handlePatientButtonBlur}
          >
            <img src="person.svg" alt="Patient info" />
          </button>

          {#if showPatientDropdown}
            <div
              class="patient-dropdown absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20"
            >
              {#if patientInfo}
                <div class="px-1 py-1">
                  <button
                    class="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded mb-1"
                    draggable="true"
                    on:click={() => {
                      if (selectedPageIndex >= 0) {
                        addTextField(`${patientInfo.fullName}`);
                        showPatientDropdown = false;
                      }
                    }}
                  >
                    <div class="text-xs text-gray-500">{$_("lblFullName")}</div>
                    <div class="font-medium">{patientInfo.fullName}</div>
                  </button>

                  <button
                    class="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    draggable="true"
                    on:click={() => {
                      if (selectedPageIndex >= 0) {
                        addTextField(`${patientInfo.dateOfBirth}`);
                        showPatientDropdown = false;
                      }
                    }}
                  >
                    <div class="text-xs text-gray-500">
                      {$_("lblDateOfBirth")}
                    </div>
                    <div class="font-medium">{patientInfo.dateOfBirth}</div>
                  </button>
                </div>
              {/if}
              {#if showTools.patient.allowCreate}
                <div class="px-1 py-1">
                  <button
                    class="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    on:click={() => handlePatientAction("create")}
                  >
                    <div class="text-xs text-gray-500">
                      {$_("txtCreateNew")}
                    </div>
                    <div class="font-medium">{$_("btnCreateNewPatient")}</div>
                  </button>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <div class="justify-center mr-3 md:mr-4 w-full max-w-xs hidden md:flex">
      <input
        type="text"
        disabled
        class="flex-grow bg-transparent"
        bind:value={pdfName}
      />
    </div>
    {#if showTools.savePDF}
      <button
        on:click={savePDF}
        class="w-20 bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3
        md:px-4 mr-3 md:mr-4 rounded"
        class:cursor-not-allowed={pages.length === 0 || saving || !pdfFile}
        class:bg-blue-700={pages.length === 0 || saving || !pdfFile}
      >
        {saving ? $_("btnSaving") : $_("btnSave")}
      </button>
    {/if}
  </div>
  {#if addingDrawing}
    <div
      transition:fly={{ y: -200, duration: 500 }}
      class="fixed z-10 top-0 left-0 right-0 border-b border-gray-300 bg-white
      shadow-lg"
      style="height: 50%;"
    >
      <DrawingCanvas
        on:finish={(e) => {
          const { originWidth, originHeight, path } = e.detail;
          let scale = 1;
          if (originWidth > 500) {
            scale = 500 / originWidth;
          }
          addDrawing(originWidth, originHeight, path, scale);
          addingDrawing = false;
        }}
        on:cancel={() => (addingDrawing = false)}
      />
    </div>
  {/if}
  {#if pages.length}
    <div class="flex justify-center px-5 w-full md:hidden">
      <input
        type="text"
        disabled
        class="flex-grow bg-transparent"
        bind:value={pdfName}
      />
    </div>
    <div class="w-full">
      {#each pages as page, pIndex (page)}
        <div
          class="p-5 w-full flex flex-col items-center overflow-hidden"
          on:mousedown={() => selectPage(pIndex)}
          on:touchstart={() => selectPage(pIndex)}
        >
          <div
            class="relative shadow-lg"
            class:shadow-outline={pIndex === selectedPageIndex}
            on:click={handleBackgroundClick}
          >
            <PDFPage
              on:measure={(e) => onMeasure(e.detail.scale, pIndex)}
              {page}
            />
            <div
              class="absolute top-0 left-0 transform origin-top-left"
              style="transform: scale({pagesScale[
                pIndex
              ]}); touch-action: none;"
            >
              {#each allObjects[pIndex] as object (object.id)}
                {#if object.type === "image"}
                  <Image
                    on:update={(e) => updateObject(object.id, e.detail)}
                    on:delete={() => deleteObject(object.id)}
                    file={object.file}
                    payload={object.payload}
                    x={object.x}
                    y={object.y}
                    width={object.width}
                    height={object.height}
                    pageScale={pagesScale[pIndex]}
                    isActive={activeObjectId === object.id}
                    on:activate={() => handleObjectActivation(object.id)}
                  />
                {:else if object.type === "text"}
                  <Text
                    on:update={(e) => updateObject(object.id, e.detail)}
                    on:delete={() => deleteObject(object.id)}
                    on:selectFont={selectFontFamily}
                    text={object.text}
                    x={object.x}
                    y={object.y}
                    size={object.size}
                    lineHeight={object.lineHeight}
                    fontFamily={object.fontFamily}
                    pageScale={pagesScale[pIndex]}
                    isActive={activeObjectId === object.id}
                    on:activate={() => handleObjectActivation(object.id)}
                  />
                {:else if object.type === "drawing"}
                  <Drawing
                    on:update={(e) => updateObject(object.id, e.detail)}
                    on:delete={() => deleteObject(object.id)}
                    path={object.path}
                    x={object.x}
                    y={object.y}
                    width={object.width}
                    originWidth={object.originWidth}
                    originHeight={object.originHeight}
                    pageScale={pagesScale[pIndex]}
                    isActive={activeObjectId === object.id}
                    on:activate={() => handleObjectActivation(object.id)}
                  />
                {/if}
              {/each}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="w-full flex-grow flex justify-center items-center">
      <span class="font-bold text-3xl text-gray-500">{$_("lblDragHere")}</span>
    </div>
  {/if}
</main>
