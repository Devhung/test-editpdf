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
    let pagesDimensions = [];
    let allObjects = [];
    let currentFont = "Times-Roman";
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
      addImage: false,
      addText: true,
      addDrawing: true,
      addDate: {
        enabled: true,
        formats: null, // If null, will use defaultDateTimeFormats
        timezone: 0, // Default timezone offset
        defaultFormat: null, // If null, will use first format from formats list
      },
      savePDF: true,
      cancel: true,
      patient: {
        showInfo: true,
        allowCreate: true,
      },
      allowDropFile: true,
    };

    // Add patient info states
    let showPatientDropdown = false;
    let patientInfo = {
      dateOfBirth: "",
      fullName: "",
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
        window.parent.postMessage(
          {
            type: "PATIENT_CREATE",
          },
          "*"
        );
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
      return showTools.addDate.formats || defaultDateTimeFormats;
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

            // Set PDF file if provided
            if (data.pdfFile instanceof Blob) {
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
        pagesScale = Array(numPages).fill(1);

        // Load pages and store dimensions
        pages = await Promise.all(
          Array(numPages)
            .fill()
            .map(async (_, i) => {
              const page = await pdf.getPage(i + 1);
              const viewport = page.getViewport({ scale: 1 });
              pagesDimensions[i] = {
                width: viewport.width,
                height: viewport.height,
              };
              return page;
            })
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
        size: 12,
        width: 0, // recalculate after editing
        lineHeight: 1.2,
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
          : objects
      );

      // Add to new page with updated y position
      const updatedObject = { ...object, y };
      allObjects = allObjects.map((objects, pIndex) =>
        pIndex === toPageIndex ? [...objects, updatedObject] : objects
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

        const object = {
          id,
          text: targetDate.toISOString(), // Store as ISO string to preserve timezone info
          type: "text",
          size: 12,
          width: 0,
          lineHeight: 1.2,
          fontFamily: currentFont,
          x: 0,
          y: 0,
          isDateField: true,
          timezone: timezone,
          rawValue: targetDate.toISOString(), // Store original value with timezone
        };
        allObjects = allObjects.map((objects, pIndex) =>
          pIndex === selectedPageIndex ? [...objects, object] : objects
        );
      }
    }

    // Add this function to check if there are any editable objects
    $: hasEditableObjects = () => {
      return allObjects.some(pageObjects => pageObjects.length > 0);
    }
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
            class="flex items-center justify-center h-full w-8 hover:bg-gray-500 focus:outline-none
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
            class="flex items-center justify-center h-full w-8 hover:bg-gray-500 focus:outline-none
            cursor-pointer"
            class:cursor-not-allowed={selectedPageIndex < 0}
            class:bg-gray-500={selectedPageIndex < 0}
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
            class:cursor-not-allowed={selectedPageIndex < 0}
            class:bg-gray-500={selectedPageIndex < 0}
          >
            <img src="signature.png" alt="An icon for adding drawing" />
          </button>
        {/if}
        {#if showTools.addDate.enabled}
          <button
            class="flex items-center justify-center h-full w-8 hover:bg-gray-500 focus:outline-none
            cursor-pointer"
            on:click={onAddDateField}
            class:cursor-not-allowed={selectedPageIndex < 0}
            class:bg-gray-500={selectedPageIndex < 0}
          >
            <img src="calendar.png" alt="An icon for adding date" />
          </button>
        {/if}
        {#if showTools.patient.showInfo}
          <div class="relative">
            <button
              class="flex items-center justify-center h-full w-8 hover:bg-gray-500 focus:outline-none
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
              <img src="person.png" alt="Patient info" />
            </button>

            {#if showPatientDropdown}
              <div
                class="patient-dropdown absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20"
              >
                {#if patientInfo}
                  <div class="px-1 py-1">
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
            window.parent.postMessage({ type: "EDITOR_CANCEL" }, "*");
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
          class="w-20 bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3
          md:px-4 mr-3 md:mr-4 rounded focus:outline-none"
          class:opacity-50={!hasEditableObjects()}
          class:cursor-not-allowed={!hasEditableObjects()}
          disabled={!hasEditableObjects()}
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
