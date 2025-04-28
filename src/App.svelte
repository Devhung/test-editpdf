<script>
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import Tailwind from "./Tailwind.svelte";
  import PDFPage from "./PDFPage.svelte";
  import Image from "./Image.svelte";
  import Text from "./Text.svelte";
  import Drawing from "./Drawing.svelte";
  import DrawingCanvas from "./DrawingCanvas.svelte";
  import Loading from "./components/Loading.svelte";
  import prepareAssets, { fetchFont } from "./utils/prepareAssets.js";
  import { DEFAULT_SCALE } from "./config/constants.js";
  import {
    readAsArrayBuffer,
    readAsImage,
    readAsPDF,
    readAsDataURL,
  } from "./utils/asyncReader.js";
  import { ggID, sendMessageToApp, checkEnvironment, formatDate  } from "./utils/helper.js";
  import { save } from "./utils/PDF.js";
  import { _, changeLanguage } from "./i18n";
  const genID = ggID();
  let pdfFile;
  let pdfName = "";
  let pages = [];
  let pagesScale = [];
  let pagesDimensions = [];
  let allObjects = [];
  let currentFont = "Calibri";
  let focusId = null;
  let selectedPageIndex = -1;
  let saving = false;
  let addingDrawing = false;
  let activeObjectId = null;
  let loading = false;
  // Custom date formats (can be overridden from parent)
  let defaultDateTimeFormats = [
    { label: "YYYY-MM-DD HH:mm", value: "YYYY-MM-DD HH:mm" }, // 24-hour
    { label: "YYYY/MM/DD hh:mm A", value: "YYYY/MM/DD hh:mm A" }, // 12-hour
    { label: "DD/MM/YYYY HH:mm", value: "DD/MM/YYYY HH:mm" }, // European 24-hour
    { label: "MM/DD/YYYY hh:mm A", value: "MM/DD/YYYY hh:mm A" }, // US 12-hour
    { label: "YYYY-MM-DD", value: "YYYY-MM-DD" }, // Date only
    { label: "DD-MM-YYYY", value: "DD-MM-YYYY" }, // European date
    { label: "MM/DD/YYYY", value: "MM/DD/YYYY" }, // US date
    { label: "HH:mm", value: "HH:mm" }, // Time only 24-hour
  ];

  // Tool visibility control
  let showTools = {
    choosePDF: false,
    addImage: true,
    addText: true,
    addDrawing: true,
    addDate: {
      enabled: true,
      formats: null, // If null, will use defaultDateTimeFormats
      timezone: 0, // Default timezone offset
      defaultFormat: null, // If null, will use first format from formats list
    },
    savePDF: true,
    cancel: false,
    patient: {
      showInfo: false,
      allowCreate: false,
    },
    allowDropFile: false,
  };

  // Add patient info states
  let showPatientDropdown = false;
  let patientInfo = {
    emrId: "",
    fullName: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    email: "",
    address: "",
  };

  // Function to safely get patient info value
  function getPatientValue(key) {
    return patientInfo && patientInfo[key] ? patientInfo[key] : "";
  }

  // Function to handle patient text field addition
  function addPatientTextField(key) {
    if (selectedPageIndex >= 0) {
      const value = getPatientValue(key);
      addTextField(value);
      showPatientDropdown = false;
    }
  }

  // Function to toggle patient dropdown
  function togglePatientDropdown() {
    if (!patientInfo) return;
    if (selectedPageIndex < 0) return;
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
      sendMessageToApp({
        type: "PATIENT_CREATE",
      });
    }
    showPatientDropdown = false;
  }

  // Function to handle page selection
  function selectPage(index) {
    if (typeof index === "number") {
      selectedPageIndex = index;
    }
  }

  // Function to get active date formats
  function getActiveDateFormats() {
    let formats = [];
    if(showTools.addDate.defaultFormat) {
      formats = [...formats, {
        label: showTools.addDate.defaultFormat,
        value: showTools.addDate.defaultFormat,
      }];
    }
    if (showTools.addDate.formats) {
      formats = [...formats, ...showTools.addDate.formats];
    }else{
      formats = [...formats, ...defaultDateTimeFormats];
    }

    // Combine both arrays and remove duplicates based on value
    const uniqueFormats = formats.filter((format, index, self) =>
      index === self.findIndex((f) => f.value === format.value)
    );

    return uniqueFormats;
  }

  // Handle incoming messages from parent window/WebView
  function handleMessage(event) {
    if (!event.data) return;

    const { type, data } = event.data;

    switch (type) {
      case "INIT_DATA":
        // Handle initialization data
        if (data) {
          // Set title/filename if provided
          pdfName = data.title || "";

          // Support pdf file blob or base64 string
          if (data.pdfFile) {
            addPDF(data.pdfFile);
          }

          // Update tool visibility if provided
          if (data.tools) {
            showTools = { ...showTools, ...data.tools };
            // Handle date formats if provided
            if (data.tools.addDate && data.tools.addDate.formats) {
              showTools.addDate.formats = data.tools.addDate.formats;
            }
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
          if (checkEnvironment() === "react-native-webview") {
            const pdfBase64 = await save(
              pdfFile,
              allObjects,
              pdfName,
              pagesScale,
            );
            sendMessageToApp({
              type: "PDF_SAVED",
              data: pdfBase64,
            });
          } else {
            const pdfBlob = await save(
              pdfFile,
              allObjects,
              pdfName,
              pagesScale,
            );
            sendMessageToApp({
              type: "PDF_SAVED",
              data: pdfBlob,
            });
          }
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
    sendMessageToApp({
      type: "EDITOR_READY",
      data: {
        showTools,
        patientInfo,
        language: $_("currentLanguage"),
      },
    });

    // Add click outside listener
    document.addEventListener("click", handleClickOutside);

    return () => {
      window.removeEventListener("message", handleMessage);
      document.removeEventListener("click", handleClickOutside);
    };
  });

  async function onUploadPDF(e) {
    const files = e.target.files || (e.dataTransfer && e.dataTransfer.files);
    if (!files || !files.length) return;

    const file = files[0];
    if (!file || file.type !== "application/pdf") return;

    selectPage(-1); // Reset page selection
    try {
      await addPDF(file);
    } catch (e) {
      console.error("Error uploading PDF:", e);
    }
  }

  async function addPDF(file) {
    if (!file) return;

    loading = true;
    try {
      const pdf = await readAsPDF(file);
      if (!pdf) throw new Error("Invalid PDF file");

      pdfFile = file;
      pdfName = file.name ? file.name : "";
      const numPages = pdf.numPages;

      // Initialize arrays
      pagesDimensions = [];
      allObjects = Array(numPages)
        .fill()
        .map(() => []);
      pagesScale = Array(numPages).fill(DEFAULT_SCALE);

      // Load pages and store dimensions
      pages = await Promise.all(
        Array(numPages)
          .fill()
          .map(async (_, i) => {
            const page = await pdf.getPage(i + 1);
            const viewport = page.getViewport({ scale: DEFAULT_SCALE });
            pagesDimensions[i] = {
              width: viewport.width,
              height: viewport.height,
            };
            return page;
          }),
      );

      selectPage(0);
    } catch (e) {
      console.error("Failed to add pdf:", e);
      throw e;
    } finally {
      loading = false;
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

      // Scale down large images
      let scale = 1;
      const limit = 500;
      if (width > limit) {
        scale = limit / width;
      }
      if (height > limit) {
        scale = Math.min(scale, limit / height);
      }

      const scaledWidth = width * scale;
      const scaledHeight = height * scale;

      const object = {
        id,
        type: "image",
        width: scaledWidth,
        height: scaledHeight,
        x: pagesDimensions[selectedPageIndex].width / 2 - scaledWidth / 2, // Center horizontally
        y: pagesDimensions[selectedPageIndex].height / 2 - scaledHeight / 2, // Center vertically
        payload: img,
        file,
      };
      allObjects = allObjects.map((objects, pIndex) =>
        pIndex === selectedPageIndex ? [...objects, object] : objects,
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
    // Create a temporary canvas to measure text width
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const fontSize = 10 * DEFAULT_SCALE;
    const lineHeight = 1.2;

    ctx.font = `${fontSize}px ${currentFont}`; // match the font size and family
    const textWidth = ctx.measureText(text).width;
    const textHeight = fontSize * lineHeight; // fontSize * lineHeight

    const object = {
      id,
      text,
      type: "text",
      size: fontSize,
      width: textWidth,
      lineHeight: lineHeight,
      lines: [text],
      fontFamily: currentFont,
      x: pagesDimensions[selectedPageIndex].width / 2 - textWidth / 2, // Center horizontally
      y: pagesDimensions[selectedPageIndex].height / 2 - textHeight / 2, // Center vertically
    };

    allObjects = allObjects.map((objects, pIndex) =>
      pIndex === selectedPageIndex ? [...objects, object] : objects,
    );

    // Activate the text field immediately
    activeObjectId = id;
  }

  function onAddDrawing() {
    if (selectedPageIndex >= 0) {
      addingDrawing = true;
    }
  }

  function addDrawing(originWidth, originHeight, path, scale = 1) {
    const id = genID();
    const pageWidth = pagesDimensions[selectedPageIndex].width;
    const pageHeight = pagesDimensions[selectedPageIndex].height;
    const scaledWidth = originWidth * scale;
    const scaledHeight = originHeight * scale;

    const object = {
      id,
      path,
      type: "drawing",
      x: pageWidth / 2 - scaledWidth / 2, // Center horizontally
      y: pageHeight / 2 - scaledHeight / 2, // Center vertically
      originWidth,
      originHeight,
      width: scaledWidth,
      scale,
    };
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex === selectedPageIndex ? [...objects, object] : objects,
    );
    activeObjectId = id;
  }

  function selectFontFamily(event) {
    const name = event.detail.name;
    fetchFont(name);
    currentFont = name;
  }

  function moveObjectToPage(objectId, fromPageIndex, toPageIndex, y = 0) {
    const object = allObjects[fromPageIndex].find((obj) => obj.id === objectId);
    if (!object) return;

    // Remove from old page
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex === fromPageIndex
        ? objects.filter((obj) => obj.id !== objectId)
        : objects,
    );

    // Add to new page with updated y position
    const updatedObject = { ...object, y };
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex === toPageIndex ? [...objects, updatedObject] : objects,
    );

    // Update selected page
    selectedPageIndex = toPageIndex;
  }

  function updateObject(objectId, payload) {
    const currentPage = selectedPageIndex;
    const object = allObjects[currentPage].find((obj) => obj.id === objectId);
    if (!object) return;

    // Tính toán chiều cao mới của object
    const newHeight = payload.width
      ? payload.width / (object.originWidth / object.originHeight)
      : object.height ||
        object.lineHeight * object.size ||
        object.width / (object.originWidth / object.originHeight) ||
        0;

    // Tính toán vị trí Y mới
    const newY = payload.y !== undefined ? payload.y : object.y;

    // Chỉ kiểm tra nhảy trang khi đang di chuyển (không phải đang scale)
    if (payload.y !== undefined && !payload.width) {
      // Nếu kéo lên trên trang hiện tại
      if (newY < 0 && currentPage > 0) {
        const newY = pagesDimensions[currentPage - 1].height - newHeight;
        moveObjectToPage(objectId, currentPage, currentPage - 1, newY);
        return;
      }

      // Nếu kéo xuống dưới trang hiện tại
      if (
        newY + newHeight > pagesDimensions[currentPage].height &&
        currentPage < pages.length - 1
      ) {
        moveObjectToPage(objectId, currentPage, currentPage + 1, 0);
        return;
      }
    }

    // Cập nhật bình thường trong trang
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex === currentPage
        ? objects.map((object) =>
            object.id === objectId ? { ...object, ...payload } : object,
          )
        : objects,
    );
  }

  function deleteObject(objectId) {
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex == selectedPageIndex
        ? objects.filter((object) => object.id !== objectId)
        : objects,
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
    if (!patientInfo) return;
    if (selectedPageIndex < 0) return;
    // Check if the new focus target is inside the dropdown
    const relatedTarget = event.relatedTarget;
    const dropdown = document.querySelector(".patient-dropdown");

    // Only close if not clicking inside dropdown
    if (!dropdown.contains(relatedTarget)) {
      showPatientDropdown = false;
    }
  }

  // Function to add date field
  function onAddDateField() {
    if (selectedPageIndex >= 0 && showTools.addDate.enabled) {
      const id = genID();
      fetchFont(currentFont);

      // Create date with timezone
      const now = new Date();
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
      const timezone = showTools.addDate.timezone || 0;
      const targetTime = utcTime + timezone * 3600000; // Convert hours to milliseconds
      const targetDate = new Date(targetTime);
      const dateText = targetDate.toISOString();

      // Create a temporary canvas to measure text width - same as addTextField
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const fontSize = 10 * DEFAULT_SCALE;
      const lineHeight = 1.2;

      ctx.font = `${fontSize}px ${currentFont}`; // match the font size and family
      const textWidth = ctx.measureText(dateText).width; // Scale the width
      const textHeight = fontSize * lineHeight; // fontSize * lineHeight

      const defaultFormat = getActiveDateFormats()[0].value ||'yyyy-MM-dd HH:mm';
      const object = {
        id,
        text: dateText,
        type: "text",
        size: fontSize,
        width: textWidth,
        lineHeight: lineHeight,
        lines: [formatDate(dateText,defaultFormat)],
        fontFamily: currentFont,
        x: pagesDimensions[selectedPageIndex].width / 2 - textWidth / 2, // Center horizontally
        y: pagesDimensions[selectedPageIndex].height / 2 - textHeight / 2, // Center vertically
        isDateField: true,
        timezone: timezone,
        rawValue: targetDate.toISOString(), // Store original value with timezone
      };

      allObjects = allObjects.map((objects, pIndex) =>
        pIndex === selectedPageIndex ? [...objects, object] : objects,
      );

      // Activate the date field immediately
      activeObjectId = id;
    }
  }

  // Add this function to check if there are any editable objects
  $: hasEditableObjects = () => {
    return allObjects.some((pageObjects) => pageObjects.length > 0);
  };
</script>

<svelte:window
  on:dragenter|preventDefault
  on:dragover|preventDefault
  on:drop|preventDefault={(e) => {
    const files = e.dataTransfer.files;
    if (!showTools.allowDropFile) {
      return;
    }
    if (files.length > 0) {
      onUploadPDF(e);
    }
  }}
/>
<Tailwind />
<main
  class="flex flex-col items-center py-16 bg-gray-100 min-h-screen relative"
>
  {#if saving}
    <div
      style="background-color: rgba(255, 255, 255, 0.7);"
      class="fixed inset-0 bg-white/30 backdrop-blur-[2px] z-50 flex items-center justify-center"
    >
      <div class=" px-8 py-4 flex flex-col items-center">
        <Loading size="default" text={$_("lblSaving")} />
      </div>
    </div>
  {/if}

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
        style="background-color: #1677ff;"
        class="whitespace-no-wrap hover:bg-blue-700 text-white
          font-normal py-1 px-3 md:px-4 rounded mr-3 cursor-pointer md:mr-4"
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
          class="flex items-center justify-center h-full w-8 hover:bg-gray-500 focus:outline-none
            cursor-pointer"
          class:cursor-not-allowed={selectedPageIndex < 0 || saving}
          class:bg-gray-500={selectedPageIndex < 0 || saving}
          disabled={selectedPageIndex < 0 || saving}
          on:click={() => document.getElementById("image").click()}
        >
          <img src="image.svg" alt="An icon for adding images" />
          <input
            type="file"
            id="image"
            name="image"
            class="hidden"
            on:change={onUploadImage}
            disabled={saving}
          />
        </button>
      {/if}
      {#if showTools.addText}
        <button
          class="flex items-center justify-center h-full w-8 hover:bg-gray-500 focus:outline-none
            cursor-pointer"
          class:cursor-not-allowed={selectedPageIndex < 0 || saving}
          class:bg-gray-500={selectedPageIndex < 0 || saving}
          disabled={selectedPageIndex < 0 || saving}
          on:click={onAddTextField}
        >
          <img src="T.png" alt="An icon for adding text" />
        </button>
      {/if}
      {#if showTools.addDrawing}
        <button
          class="flex items-center justify-center h-full w-8 hover:bg-gray-500 focus:outline-none
            cursor-pointer"
          on:click={onAddDrawing}
          class:cursor-not-allowed={selectedPageIndex < 0 || saving}
          class:bg-gray-500={selectedPageIndex < 0 || saving}
          disabled={selectedPageIndex < 0 || saving}
        >
          <img src="signature.png" alt="An icon for adding drawing" />
        </button>
      {/if}
      {#if showTools.addDate.enabled}
        <button
          class="flex items-center justify-center h-full w-8 hover:bg-gray-500 focus:outline-none
            cursor-pointer"
          on:click={onAddDateField}
          class:cursor-not-allowed={selectedPageIndex < 0 || saving}
          class:bg-gray-500={selectedPageIndex < 0 || saving}
          disabled={selectedPageIndex < 0 || saving}
        >
          <img src="calendar.png" alt="An icon for adding date" />
        </button>
      {/if}
      {#if showTools.patient.showInfo}
        <div class="relative">
          <button
            class="flex items-center justify-center h-full w-8 hover:bg-gray-500 focus:outline-none
              cursor-pointer"
            class:cursor-not-allowed={selectedPageIndex < 0 || saving}
            class:bg-gray-500={selectedPageIndex < 0 || saving}
            disabled={selectedPageIndex < 0 || saving}
            draggable="true"
            on:dragstart={(e) => {
              e.dataTransfer.setData(
                "text/plain",
                JSON.stringify({
                  type: "patient-info",
                  data: patientInfo,
                }),
              );
            }}
            on:click={togglePatientDropdown}
            on:blur={handlePatientButtonBlur}
          >
            <img src="person.png" alt="Patient info" />
          </button>

          {#if showPatientDropdown}
            <div
              class="patient-dropdown absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20"
            >
              {#if patientInfo}
                <div class="px-1 py-1">
                  {#if patientInfo.emrId}
                    <button
                      class="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded mb-1 focus:outline-none"
                      draggable="true"
                      on:click={() => addPatientTextField("emrId")}
                    >
                      <div class="text-xs text-gray-500">
                        {$_("lblEMRId")}
                      </div>
                      <div class="font-medium">
                        {getPatientValue("emrId")}
                      </div>
                    </button>
                  {/if}
                  {#if patientInfo.fullName}
                    <button
                      class="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded mb-1 focus:outline-none"
                      draggable="true"
                      on:click={() => addPatientTextField("fullName")}
                    >
                      <div class="text-xs text-gray-500">
                        {$_("lblFullName")}
                      </div>
                      <div class="font-medium">
                        {getPatientValue("fullName")}
                      </div>
                    </button>
                  {/if}
                  {#if patientInfo.dateOfBirth}
                    <button
                      class="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded focus:outline-none"
                      draggable="true"
                      on:click={() => addPatientTextField("dateOfBirth")}
                    >
                      <div class="text-xs text-gray-500">
                        {$_("lblDateOfBirth")}
                      </div>
                      <div class="font-medium">
                        {getPatientValue("dateOfBirth")}
                      </div>
                    </button>
                  {/if}
                  {#if patientInfo.gender}
                    <button
                      class="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded mb-1 focus:outline-none"
                      draggable="true"
                      on:click={() => addPatientTextField("gender")}
                    >
                      <div class="text-xs text-gray-500">
                        {$_("lblGender")}
                      </div>
                      <div class="font-medium">
                        {getPatientValue("gender")}
                      </div>
                    </button>
                  {/if}
                  {#if patientInfo.phone}
                    <button
                      class="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded mb-1 focus:outline-none"
                      draggable="true"
                      on:click={() => addPatientTextField("phone")}
                    >
                      <div class="text-xs text-gray-500">
                        {$_("lblPhone")}
                      </div>
                      <div class="font-medium">
                        {getPatientValue("phone")}
                      </div>
                    </button>
                  {/if}
                  {#if patientInfo.email}
                    <button
                      class="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded mb-1 focus:outline-none"
                      draggable="true"
                      on:click={() => addPatientTextField("email")}
                    >
                      <div class="text-xs text-gray-500">
                        {$_("lblEmail")}
                      </div>
                      <div class="font-medium">
                        {getPatientValue("email")}
                      </div>
                    </button>
                  {/if}
                  {#if patientInfo.address}
                    <button
                      class="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded mb-1 focus:outline-none"
                      draggable="true"
                      on:click={() => addPatientTextField("address")}
                    >
                      <div class="text-xs text-gray-500">
                        {$_("lblAddress")}
                      </div>
                      <div class="font-medium">
                        {getPatientValue("address")}
                      </div>
                    </button>
                  {/if}
                </div>
              {/if}
              {#if showTools.patient.allowCreate}
                <div class="px-1 py-1">
                  <button
                    class="block w-full text-left px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded focus:outline-none"
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
        class="flex-grow bg-transparent text-center"
        bind:value={pdfName}
      />
    </div>
    {#if showTools.cancel}
      <button
        on:click={() => {
          sendMessageToApp({ type: "EDITOR_CANCEL" });
        }}
        class=" w-20 bg-red-500 hover:bg-red-700 text-white py-1
        rounded mr-2 focus:outline-none"
      >
        {$_("btnCancel")}
      </button>
    {/if}
    {#if showTools.savePDF}
      <button
        on:click={savePDF}
        style="background-color: rgb(22, 119, 255)"
        class="w-20 text-white font-normal py-1 px-3
          md:px-4 mr-3 md:mr-4 rounded focus:outline-none flex items-center justify-center"
        class:opacity-50={!hasEditableObjects() || saving}
        class:cursor-not-allowed={!hasEditableObjects() || saving}
        disabled={!hasEditableObjects() || saving}
      >
        {$_("btnSave")}
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
                    pageWidth={pagesDimensions[pIndex].width || 0}
                    pageHeight={pagesDimensions[pIndex].height || 0}
                    isActive={activeObjectId === object.id}
                    on:activate={() => handleObjectActivation(object.id)}
                    isLastPage={pIndex === pages.length - 1}
                    isFirstPage={pIndex === 0}
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
                    pageWidth={pagesDimensions[pIndex].width || 0}
                    pageHeight={pagesDimensions[pIndex].height || 0}
                    isActive={activeObjectId === object.id}
                    on:activate={() => handleObjectActivation(object.id)}
                    isDateField={object.isDateField}
                    dateFormats={getActiveDateFormats()}
                    isLastPage={pIndex === pages.length - 1}
                    isFirstPage={pIndex === 0}
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
                    pageWidth={pagesDimensions[pIndex].width || 0}
                    pageHeight={pagesDimensions[pIndex].height || 0}
                    isLastPage={pIndex === pages.length - 1}
                    isFirstPage={pIndex === 0}
                  />
                {/if}
              {/each}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="w-full flex-grow flex flex-col justify-center items-center">
      {#if !showTools.allowDropFile || loading}
        <Loading text={$_("lblLoading")} />
      {:else}
        <span class="font-bold text-3xl text-gray-500">
          {$_("lblDragHere")}
        </span>
      {/if}
    </div>
  {/if}
</main>
