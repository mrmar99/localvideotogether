import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

let state = {};
let clientQty = 0;
let chatMessages = [];

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    clientQty++;
    console.log(state);

    if (!Object.keys(state).length) {
      state = {
        currentTime: 0,
        isPlaying: false
      };
    }

    socket.on("state", () => {
      socket.emit("state", state);
    });

    socket.on("chat message", (message) => {
      chatMessages.push(message);
      io.emit("chat messages", chatMessages);
    });

    socket.on("video play", () => {
      console.log("[server] play");
      state.isPlaying = true;
      socket.broadcast.emit("state", state);
    });

    socket.on("video pause", () => {
      console.log("[server] pause");
      state.isPlaying = false;
      socket.broadcast.emit("state", state);
    });

    socket.on("video seek", (seconds) => {
      console.log("[server] seek", seconds);
      state.currentTime = seconds;
      socket.broadcast.emit("state", state);
    });

    socket.on("disconnect", () => {
      clientQty--;

      if (clientQty === 0) {
        chatMessages = [];
        state = {
          currentTime: 0,
          isPlaying: false,
        };
      }
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
