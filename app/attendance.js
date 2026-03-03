const ws = new WebSocket("ws://localhost:8080");
const submitDataBtn = document.getElementById("submitBtn");
const studentName = document.getElementById("name");
const studentSection = document.getElementById("section");
const infoText = document.getElementById("infoText");

//Store timestamps and timeout/interval handles
let openTimestamp = null;
let closeTimestamp = null;
let checkInterval = null;
let openTimeout = null;
let closeTimeout = null;

ws.onopen = () => {
  console.log("WebSocket connection established");
  ws.send(
    JSON.stringify({
      type: "attendance",
    }),
  );

  submitDataBtn.addEventListener("click", () => {
    ruleBasedLogic();
  });
};

// NEW: Helper to update UI based on current time vs open/close
function updateFormState() {
  const mainContainer = document.getElementById("main_container");
  const closedContainer = document.getElementById("secondary_container");
  const now = Date.now();

  if (openTimestamp && closeTimestamp) {
    if (now < openTimestamp) {
      // Not yet open
      mainContainer.classList.replace("open_container", "closedState");
      closedContainer.classList.replace("closedState", "closed_container");
    } else if (now >= openTimestamp && now <= closeTimestamp) {
      // Open window
      mainContainer.classList.replace("closedState", "open_container");
      closedContainer.classList.replace("closed_container", "closedState");
    } else if (now > closeTimestamp) {
      // Closed
      mainContainer.classList.replace("open_container", "closedState");
      closedContainer.classList.replace("closedState", "closed_container");
    }
  }
}

//Schedule enabling/disabling based on timestamps
function scheduleTimeEvents() {
  // Clear any previous timers
  if (openTimeout) clearTimeout(openTimeout);
  if (closeTimeout) clearTimeout(closeTimeout);
  if (checkInterval) clearInterval(checkInterval);

  const now = Date.now();

  if (openTimestamp > now) {
    // Schedule opening
    openTimeout = setTimeout(() => {
      updateFormState();
    }, openTimestamp - now);
  }

  if (closeTimestamp > now) {
    // Schedule closing
    closeTimeout = setTimeout(() => {
      updateFormState();
    }, closeTimestamp - now);
  }

  // Also run periodic check every second to catch any clock adjustments
  checkInterval = setInterval(updateFormState, 1000);
}

ws.onmessage = (mes) => {
  try {
    const receivedData = JSON.parse(mes.data);
    console.log("Received:", receivedData);

    // Handle time updates from server
    if (receivedData.type === "time_update") {
      openTimestamp = receivedData.openAt;
      closeTimestamp = receivedData.closeAt;

      // Update UI and schedule timers
      updateFormState();
      scheduleTimeEvents();
    }

    //Handle error messages (e.g., submission rejected)
    if (receivedData.type === "error") {
      infoText.textContent = receivedData.message;
    }
  } catch (error) {
    console.log("Error parsing message:", error);
  }
};

ws.onclose = () => {
  console.log("WebSocket connection closed");
  // Clean up timers
  if (openTimeout) clearTimeout(openTimeout);
  if (closeTimeout) clearTimeout(closeTimeout);
  if (checkInterval) clearInterval(checkInterval);
};

function ruleBasedLogic() {
  if (!studentName.value && !studentSection.value) {
    infoText.textContent = "There is no data in the field.";
  } else if (!studentName.value || !studentSection.value) {
    infoText.textContent = "Fill Both Field.";
  } else {
    infoText.textContent =
      "Your Attendance Is Currently Being Processed, Please Wait...";
    setTimeout(() => {
      sendAttendanceData();
      infoText.textContent = "Your Attendance Has Been Sent To Your Teacher.";
    }, 3000);
  }
}

function sendAttendanceData() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const currentTime = h > 12 ? `${h - 12}:${m}PM ` : `${h}:${m}AM`;

  ws.send(
    JSON.stringify({
      type: "message",
      from: "attendance",
      message: {
        Name: studentName.value,
        Section: studentSection.value,
        Time: currentTime,
      },
    }),
  );
}
