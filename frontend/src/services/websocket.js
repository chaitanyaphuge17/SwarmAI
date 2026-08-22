const BACKEND_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://127.0.0.1:8000";

const WS_URL =
  BACKEND_URL
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:");

let socket = null;
let reconnectTimer = null;

let manuallyClosed = false;
let connecting = false;
let connectionOptions = {};

const listeners = new Set();


// =========================================================
// CONNECT
// =========================================================

export function connectWebSocket(options = {}) {

  connectionOptions = {
    ...connectionOptions,
    ...options,
  };

  // Already connected

  if (
    socket &&
    socket.readyState === WebSocket.OPEN
  ) {

    console.log(
      "🟢 WebSocket already OPEN"
    );

    return socket;
  }


  // Already connecting

  if (
    socket &&
    socket.readyState === WebSocket.CONNECTING
  ) {

    console.log(
      "🟡 WebSocket already CONNECTING"
    );

    return socket;
  }


  if (connecting) {

    return socket;

  }


  manuallyClosed = false;

  connecting = true;


  // Clear old reconnect timer

  if (reconnectTimer) {

    clearTimeout(
      reconnectTimer
    );

    reconnectTimer = null;

  }


  const url =
    `${WS_URL}/ws/disaster`;

  console.log(
    "🔌 Connecting WebSocket:",
    url
  );


  const connection =
    new WebSocket(
      url
    );

  socket = connection;


  // =======================================================
  // OPEN
  // =======================================================

  connection.onopen =
    () => {

      connecting = false;

      connectionOptions.onOpen?.();

      console.log(
        "🟢 WebSocket CONNECTED"
      );

    };


  // =======================================================
  // MESSAGE
  // =======================================================

  connection.onmessage =
    (event) => {

      try {

        const message =
          JSON.parse(
            event.data
          );

        console.log(
          "📡 WebSocket DATA RECEIVED:",
          message
        );


        listeners.forEach(
          (listener) => {

            try {

              listener(
                message
              );

            } catch (
              error
            ) {

              console.error(
                "❌ WebSocket listener error:",
                error
              );

            }

          }
        );

        connectionOptions.onMessage?.(message);

      } catch (
        error
      ) {

        console.error(
          "❌ Invalid WebSocket JSON:",
          error
        );

      }

    };


  // =======================================================
  // ERROR
  // =======================================================

  connection.onerror =
    (error) => {

      connecting = false;

      connectionOptions.onError?.(error);

      console.error(
        "❌ WebSocket error:",
        error
      );

    };


  // =======================================================
  // CLOSE
  // =======================================================

  connection.onclose =
    (event) => {

      connecting = false;

      console.log(
        "🔴 WebSocket CLOSED"
      );

      console.log(
        "Code:",
        event.code
      );

      console.log(
        "Reason:",
        event.reason ||
        "No reason"
      );

      connectionOptions.onClose?.(event);


      if (socket === connection) {
        socket = null;
      }


      // Do not reconnect if explicitly closed

      if (
        manuallyClosed
      ) {

        console.log(
          "🛑 Manual WebSocket close"
        );

        return;

      }


      console.log(
        "🔄 Reconnecting WebSocket in 2 seconds..."
      );


      reconnectTimer =
        setTimeout(
          () => {

            connectWebSocket(connectionOptions);

          },
          2000
        );

    };


  return socket;

}


// =========================================================
// SUBSCRIBE
// =========================================================

export function subscribeWebSocket(
  callback
) {

  listeners.add(
    callback
  );


  // Ensure socket is connected

  connectWebSocket();


  // Return unsubscribe function

  return () => {

    listeners.delete(
      callback
    );

  };

}


// =========================================================
// SEND MESSAGE
// =========================================================

export function sendWebSocketMessage(
  message
) {

  if (
    !socket ||
    socket.readyState !== WebSocket.OPEN
  ) {

    console.warn(
      "⚠️ WebSocket not connected"
    );

    return false;

  }


  socket.send(
    JSON.stringify(
      message
    )
  );

  return true;

}


// =========================================================
// GET SOCKET
// =========================================================

export function getWebSocket() {

  return socket;

}


// =========================================================
// MANUAL DISCONNECT
// =========================================================

export function disconnectWebSocket() {

  console.log(
    "🛑 Manually closing WebSocket"
  );


  manuallyClosed = true;


  if (
    reconnectTimer
  ) {

    clearTimeout(
      reconnectTimer
    );

    reconnectTimer = null;

  }


  if (
    socket
  ) {

    socket.close(
      1000,
      "Application closed"
    );

    socket = null;

  }

}


// =========================================================
// CONNECTION STATUS
// =========================================================

export function isWebSocketConnected() {

  return Boolean(
    socket &&
    socket.readyState === WebSocket.OPEN
  );

}