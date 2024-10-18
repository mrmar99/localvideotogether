"use client";

import dynamic from "next/dynamic";
import ReactPlayer from "react-player";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { socket } from "../socket";
import { Button, Popconfirm, Input } from "antd";
import {
  SendOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { generateUsername } from "unique-username-generator";
import styles from "./page.module.css";
import React from "react";
import { isMobile } from "react-device-detect";
import Avatar from "boring-avatars";
import randomColor from "randomcolor";

const ColorPicker = dynamic(() => import("antd/lib/color-picker"), {
  ssr: false,
});

const { TextArea } = Input;

export type TChatMessage = {
  username: string;
  message: string;
  timestamp: number;
  color: string;
};

const formatLocalTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

export default function Home() {
  const randomColors = useMemo(() => {
    return [
      randomColor({ hue: "red" }),
      randomColor({ hue: "green" }),
      randomColor({ hue: "blue" }),
      randomColor({ hue: "pink" }),
      randomColor({ hue: "yellow" }),
    ];
  }, []);

  let usernameInStorage: string = "";
  if (typeof window !== "undefined") {
    usernameInStorage =
      window.localStorage.getItem("togethervideo.username") || "";
  }
  let colorInStorage: string = "";
  if (typeof window !== "undefined") {
    colorInStorage = window.localStorage.getItem("togethervideo.color") || "";
  }

  const [myUsername, setMyUsername] = useState(() => {
    return usernameInStorage || generateUsername("", 0, 10);
  });
  const [userColor, setUserColor] = useState(() => {
    return colorInStorage || "#fff";
  });
  const [isConnected, setIsConnected] = useState(false);
  const [transport, setTransport] = useState("N/A");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [chatMessages, setChatMessages] = useState<Array<TChatMessage>>([]);
  const [messageInput, setMessageInput] = useState("");
  const [clientsQty, setClientsQty] = useState(1);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<ReactPlayer>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messageAreaRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((acceptedFiles: any) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const scrollToBottom = () => {
    chatContainerRef.current?.scroll({
      top: chatContainerRef.current?.scrollHeight,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  useEffect(() => {
    if (socket.connected) {
      onConnect();
    }

    function onConnect() {
      setIsConnected(true);
      setTransport(socket.io.engine.transport.name);

      socket.io.engine.on("upgrade", (transport) => {
        setTransport(transport.name);
      });
    }

    function onDisconnect() {
      setIsConnected(false);
      setTransport("N/A");
    }

    const onState = (state: any) => {
      const { isPlaying, currentTime, clientsQty } = state;
      console.log(
        "got state from server",
        currentTime,
        videoUrl,
        videoRef,
        isSeeking,
        clientsQty
      );
      setClientsQty(clientsQty);
      setIsPlaying(isPlaying);
      if (!isSeeking) {
        setCurrentTime(currentTime);
      } else {
        setIsSeeking(false);
      }
    };

    const onMessages = (data: Array<TChatMessage>) => {
      console.log(data);
      setChatMessages(data);
    };

    const onGetVideoTimes = () => {
      socket.emit("send video time", videoRef.current?.getCurrentTime());
    };

    const onBeforeUnload = () => {
      socket.emit("disconnect");
    };

    window.addEventListener("beforeunload", onBeforeUnload);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("state", onState);
    socket.on("chat messages", onMessages);
    socket.on("get video times", onGetVideoTimes);

    socket.emit("state");

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("state", onState);
      socket.off("chat messages", onMessages);
      socket.off("get video times", onGetVideoTimes);
    };
  }, []);

  useEffect(() => {
    if (!isSeeking) {
      videoRef.current?.seekTo(currentTime);
    }
  }, [currentTime]);

  const handlePlay = () => {
    console.log("[client] play");
    if (!videoUrl) return;
    if (isConnected) {
      socket.emit("video play");
    }
  };

  const handlePause = () => {
    console.log("[client] pause");
    if (!videoUrl) return;
    if (isConnected) {
      socket.emit("video pause");
      setIsPlaying(false);
    }
  };

  const handleSeek = (seconds: number) => {
    if (!videoUrl) return;
    if (isConnected && !isSeeking) {
      console.log("[client] seek", seconds);
      setIsSeeking(true);
      socket.emit("video seek", seconds);
      setTimeout(() => {
        setIsSeeking(false);
      }, 75);
    }
  };

  const handleRemoveVideo = () => {
    setVideoUrl(null);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
  };

  const handleSendMessage = () => {
    const msg = messageInput.trim();
    if (msg !== "") {
      const newMessage: TChatMessage = {
        username: myUsername,
        message: msg,
        timestamp: Date.now(),
        color: userColor,
      };
      setChatMessages([...chatMessages, newMessage]);
      setMessageInput("");

      socket.emit("chat message", newMessage);
    }
  };

  const handleMyUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value.length <= 20) {
      setMyUsername(e.target.value);
      if (typeof window !== "undefined") {
        localStorage.setItem("togethervideo.username", e.target.value);
      }
    }
  };

  const handleChangeUserColor = (e: any) => {
    const color = e.toHexString();
    setUserColor(color);
    if (typeof window !== "undefined") {
      localStorage.setItem("togethervideo.color", color);
    }
    socket.emit("user color", { username: myUsername, color });
  };

  const handleSync = () => {
    socket.emit("video sync");
  };

  const handleButtonSeek = (seekTime: number) => {
    if (videoRef.current) {
      const newTime = videoRef.current.getCurrentTime() + seekTime;
      setCurrentTime(newTime);
      socket.emit("video seek", newTime);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isMobile && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <React.Fragment>
      <div className={styles.container}>
        <div className={styles.leftTopWrapper}>
          <div className={styles.statusBar}>
            <div className={styles.userSettings}>
              <ColorPicker
                onChangeComplete={handleChangeUserColor}
                size="small"
                value={userColor}
              />
              <Input
                placeholder="Имя пользователя"
                value={myUsername}
                onChange={handleMyUsernameChange}
                color="white"
                className={styles.myUsernameInput}
                size="middle"
                prefix={<UserOutlined />}
                variant="borderless"
              />
            </div>
            <div className={styles.statusBarInfo}>
              <div className={styles.statusBarConnectingState}>
                {!isConnected && "Connecting..."}
              </div>
              <div className={styles.statusBarInfoClientsQty}>
                <TeamOutlined />
                {clientsQty}
              </div>
            </div>
          </div>
          {videoUrl ? (
            <div className={styles.videoContainer}>
              <ReactPlayer
                className={styles.video}
                ref={videoRef}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                playing={isPlaying}
                width="100%"
                height=""
                url={videoUrl}
                controls
                pip
              />
              <div className={styles.videoControls}>
                <div className={styles.videoControlsRow}>
                  <Button onClick={handleSync} type="primary" size="small">
                    Синхронизировать
                  </Button>
                  <Popconfirm
                    title="Удалить видео"
                    description="Точно удалить?"
                    okText="Удалить"
                    cancelText="Нет"
                    onConfirm={handleRemoveVideo}
                  >
                    <Button danger size="small">
                      Удалить видео
                    </Button>
                  </Popconfirm>
                </div>
                <div className={styles.videoControlsRow}>
                  <Button onClick={() => handleButtonSeek(-30)} size="small">
                    {"◀30"}
                  </Button>
                  <Button onClick={() => handleButtonSeek(-10)} size="small">
                    {"◀10"}
                  </Button>
                  <Button onClick={() => handleButtonSeek(-5)} size="small">
                    {"◀5"}
                  </Button>
                  <Button onClick={() => handleButtonSeek(5)} size="small">
                    {"5▶"}
                  </Button>
                  <Button onClick={() => handleButtonSeek(10)} size="small">
                    {"10▶"}
                  </Button>
                  <Button onClick={() => handleButtonSeek(30)} size="small">
                    {"30▶"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.fileInput} {...getRootProps()}>
              <input {...getInputProps()} />
              {isDragActive ? (
                <p>Drop the files here ...</p>
              ) : (
                <p>
                  Drag &apos;n&apos; drop some files here, or click to select
                  files
                </p>
              )}
            </div>
          )}
        </div>
        <div className={styles.chat}>
          <div
            ref={chatContainerRef}
            className={styles.chatMessages}
          >
            {chatMessages.map(
              ({ username, message, timestamp, color }, index) => {
                return username === myUsername ? (
                  <div
                    key={index}
                    className={`${styles.chatMessageBlock} ${styles.chatMessageBlockRight}`}
                  >
                    <div
                      className={`${styles.chatMessage} ${styles.chatMessageRight}`}
                    >
                      <span
                        style={{ color }}
                        className={styles.chatMessageUsername}
                      >
                        {username}
                      </span>
                      <div className={styles.chatMessageRow}>
                        <span className={styles.chatMessageMessage}>
                          {message}
                        </span>
                        <span
                          style={{ marginRight: 0 }}
                          className={styles.chatMessageTimestamp}
                        >
                          {formatLocalTime(timestamp)}
                        </span>
                      </div>
                    </div>
                    <div className={styles.avatar}>
                      <Avatar
                        colors={[color, ...randomColors, color]}
                        name={username}
                        size={30}
                        variant="beam"
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    key={index}
                    className={`${styles.chatMessageBlock} ${styles.chatMessageBlockLeft}`}
                  >
                    <div className={styles.avatar}>
                      <Avatar
                        colors={[color, ...randomColors, color]}
                        name={username}
                        size={30}
                        variant="beam"
                      />
                    </div>
                    <div
                      className={`${styles.chatMessage} ${styles.chatMessageLeft}`}
                    >
                      <span
                        style={{ color }}
                        className={styles.chatMessageUsername}
                      >
                        {username}
                      </span>
                      <div className={styles.chatMessageRow}>
                        <span className={styles.chatMessageMessage}>
                          {message}
                        </span>
                        <span className={styles.chatMessageTimestamp}>
                          {formatLocalTime(timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
          <div className={styles.chatTextAreaContainer}>
            <TextArea
              placeholder="Сообщение"
              autoSize={{
                minRows: 1.6,
              }}
              value={messageInput}
              onChange={handleMessageChange}
              ref={messageAreaRef}
              variant="borderless"
              onKeyDown={handleKeyDown}
            />
            <SendOutlined
              className={styles.sendButton}
              onClick={handleSendMessage}
            />
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}
