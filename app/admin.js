// WEBSOCKET & JAVASCRIPT
const ws = new WebSocket("ws://localhost:8080"); // INITIATING THE SERVER (WEBSOCKET NODE.JS)
const closedTime = document.getElementById("attendance-expire_time");
const submitTimeExipryBtn = document.getElementById("open-attendance-btn");

ws.onopen = () => {
  console.log("WebSocket connection established");
  ws.send(
    JSON.stringify({
      type: "admin",
    }),
  );
};

submitTimeExipryBtn.addEventListener("click", () => {
  // Get current time (opening time) as a string like "14:30"
  const date = new Date();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const currentTimeStr = `${hours}:${minutes}`;

  // Get the selected closing time from the input
  const closingTimeStr = closedTime.value; // e.g., "15:00"

  //To clear the time field input
  closedTime.value = "";

  ws.send(
    JSON.stringify({
      type: "message",
      from: "admin",
      message: {
        openAt: currentTimeStr, //send opening time
        closeAt: closingTimeStr, //send closing time
      },
    }),
  );
});

ws.onmessage = (mess) => {
  const packedData = JSON.parse(mess.data);
  attendanceDataList(packedData.message);
};

function attendanceDataList(object) {
  const newStudent = `
        <p>Name: ${object.Name} - (${object.Section}) - ${object.Time}</p>
        <input type="button" value="Remove" class='removeBtn'>
        <input type="button" value="Approve" class='approveBtn'>`;
  const tempDiv = document.createElement("div");
  tempDiv.classList.add("authentication-item");
  tempDiv.innerHTML = newStudent;
  const appendFile = document.querySelector(".authentication-list");
  appendFile.appendChild(tempDiv);

  const approve = tempDiv.querySelector(".approveBtn");
  const remove = tempDiv.querySelector(".removeBtn");

  approve.addEventListener("click", () => {
    const newList = document.createElement("li");
    newList.innerHTML = `${object.Name} - (${object.Section}) - 08:00 AM`;
    document.getElementById("students-attendance_list").appendChild(newList);
    tempDiv.remove();
  });

  remove.addEventListener("click", () => {
    tempDiv.remove();
  });
}

ws.onclose = () => {
  console.log("WebSocket connection closed");
};
