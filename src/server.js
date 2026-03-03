const WebSocket = require("ws"); // CHANGED: use consistent capitalisation (WebSocket)
const wss = new WebSocket.Server({ port: 8080 });

const clientList = new Map(); // MAP TO STORE THE CLIENTS CONNECTED TO THE SERVER
let attendanceCounter = 0; // COUNTER TO KEEP TRACK OF THE NUMBER OF ATTENDANCE CLIENTS CONNECTED

// NEW: Store the current opening and closing timestamps (as Date objects or null)
let openingTime = null;
let closingTime = null;

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (data) => {
    try {
      const messageData = JSON.parse(data);
      eventMessageHandler(ws, messageData); // CHANGED: pass ws to handler
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  function eventMessageHandler(ws, event) {
    switch (event.type) {
      case "admin":
        if (clientList.has("admin")) {
          console.log(
            "Admin already connected. Rejecting new admin connection.",
          );
          ws.terminate();
          return;
        }
        clientList.set("admin", ws);
        console.log("Admin connected");
        break;
      case "attendance":
        attendanceCounter++;
        const attendanceId = `attendance_${attendanceCounter}`;
        clientList.set(attendanceId, ws);
        console.log(`Attendance client ${attendanceId} connected`);

        // NEW: Immediately send the current opening/closing times to this new client
        if (openingTime || closingTime) {
          ws.send(
            JSON.stringify({
              type: "time_update",
              openAt: openingTime ? openingTime.getTime() : null,
              closeAt: closingTime ? closingTime.getTime() : null,
            }),
          );
        }
        break;
      case "message":
        if (event.from === "admin") {
          // NEW: Extract and store opening/closing times
          const { openAt, closeAt } = event.message;
          if (openAt && closeAt) {
            // Convert time strings to timestamps for today's date
            const now = new Date();
            const [openHour, openMin] = openAt.split(":").map(Number);
            const [closeHour, closeMin] = closeAt.split(":").map(Number);

            openingTime = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              openHour,
              openMin,
            );
            closingTime = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              closeHour,
              closeMin,
            );

            // If closing time is earlier than opening time, assume it's on the next day?
            // For simplicity, we assume same day and if closing < opening, treat as next day?
            // We'll just log a warning.
            if (closingTime < openingTime) {
              console.warn(
                "Closing time is earlier than opening time – assuming same day, may cause issues.",
              );
            }

            console.log(
              `Opening time set to ${openingTime}, closing time set to ${closingTime}`,
            );
          }

          // Broadcast the updated times to all attendance clients
          const clientSockets = broadcastMessage();
          clientSockets.forEach((socketKeys) => {
            const socket = clientList.get(socketKeys);
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send(
                JSON.stringify({
                  type: "time_update",
                  openAt: openingTime ? openingTime.getTime() : null,
                  closeAt: closingTime ? closingTime.getTime() : null,
                }),
              );
            }
          });
        } else if (event.from === "attendance") {
          // NEW: Server-side time window enforcement
          const now = new Date();
          if (openingTime && closingTime) {
            if (now < openingTime) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Attendance has not yet opened.",
                }),
              );
              return; // Do not forward to admin
            }
            if (now > closingTime) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Attendance is already closed.",
                }),
              );
              return; // Do not forward
            }
          }

          // If within window, forward to admin
          const adminSocket = clientList.get("admin");
          if (adminSocket && adminSocket.readyState === WebSocket.OPEN) {
            adminSocket.send(
              JSON.stringify({
                message: event.message,
              }),
            );
          }
        }
        break;
    }
  }

  function broadcastMessage() {
    const clientSockets = [];
    for (const key of clientList.keys()) {
      if (key.startsWith("attendance_")) {
        clientSockets.push(key);
      }
    }
    return clientSockets;
  }

  ws.on("close", () => {
    console.log("Client disconnected");
    // Remove the disconnected client from the client list
    for (const [key, socket] of clientList.entries()) {
      if (socket === ws) {
        clientList.delete(key);
        if (key.startsWith("attendance_")) {
          attendanceCounter--; // DECREMENT ONLY FOR ATTENDANCE CLIENTS
        }
        console.log(`Client ${key} removed from client list`);
        break;
      }
    }
  });
});
