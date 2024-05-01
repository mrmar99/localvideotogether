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
let chatMessages = [];
let clientTimes = [];
const clientsSet = new Set();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer, {
    pingTimeout: 2000,
    pingInterval: 2000,
  });

  if (!Object.keys(state).length) {
    state = {
      currentTime: 0,
      isPlaying: false,
      clientsQty: 0,
    };
  }

  io.on("connection", (socket) => {
    const clientId = socket.client.id;
    console.log(socket.client.id);
    clientsSet.add(clientId);

    state.clientsQty = clientsSet.size;
    io.emit("state", state);
    console.log(clientsSet);

    console.log(state);

    socket.on("state", () => {
      io.emit("state", state);
    });

    socket.on("video sync", () => {
      io.emit("get video times");
    });

    socket.on("send video time", (currentTime) => {
      console.log(clientId, currentTime);
      clientTimes.push(currentTime); // Добавляем время от клиента в массив
      const maxTime = Math.max(...clientTimes); // Выбираем минимальное значение из всех времен
      if (maxTime && maxTime > 1) {
        state.currentTime = maxTime;
        io.emit("state", state); // Устанавливаем минимальное время всем клиентам
        clientTimes = []; // Очищаем массив для следующего запроса
      }
    });

    socket.on("chat message", (message) => {
      chatMessages.push(message);
      io.emit("chat messages", chatMessages);
    });

    socket.on("user color", (data) => {
      const { username, color } = data;

      for (const message of chatMessages) {
        if (message.username === username) {
          message.color = color;
        }
      }

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
      clientsSet.delete(clientId);
      state.clientsQty = clientsSet.size;

      if (state.clientsQty === 0) {
        chatMessages = [];
        state = {
          currentTime: 0,
          isPlaying: false,
          clientsQty: 0,
        };
      } else {
        io.emit("state", state);
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
