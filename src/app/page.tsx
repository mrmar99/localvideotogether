"use client";

import ReactPlayer from "react-player";
import { useState, useEffect, useRef, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { socket } from "../socket";
import { Button, Popconfirm, Input } from "antd";
import { SendOutlined, UserOutlined } from "@ant-design/icons";
import { generateUsername } from "unique-username-generator";
import styles from "./page.module.css";
import React from "react";

const { TextArea } = Input;

export type TChatMessage = {
  username: string;
  message: string;
  timestamp: number;
};

const formatLocalTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

export default function Home() {
  const [myUsername, setMyUsername] = useState(() => {
    let usernameInStorage;
    if (typeof window !== "undefined") {
      usernameInStorage = window.localStorage.getItem(
        "togethervideo.username"
      );
    }
    return usernameInStorage || generateUsername("", 0, 10);
  });
  const [isConnected, setIsConnected] = useState(false);
  const [transport, setTransport] = useState("N/A");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [chatMessages, setChatMessages] = useState<Array<TChatMessage>>([]);
  const [messageInput, setMessageInput] = useState("");
  const videoRef = useRef<ReactPlayer>(null);

  const onDrop = useCallback((acceptedFiles: any) => {
    console.log(acceptedFiles);
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

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
      const { isPlaying, currentTime } = state;
      console.log(
        "got state from server",
        currentTime,
        videoUrl,
        videoRef,
        isSeeking
      );
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

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("state", onState);
    socket.on("chat messages", onMessages);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("state", onState);
      socket.off("chat messages", onMessages);
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

  const sendMessage = () => {
    if (messageInput.trim() !== "") {
      const newMessage: TChatMessage = {
        username: myUsername,
        message: messageInput,
        timestamp: Date.now(),
      };
      setChatMessages([...chatMessages, newMessage]);
      setMessageInput("");

      socket.emit("chat message", newMessage);
    }
  };

  const handleMyUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMyUsername(e.target.value);
    if (typeof window !== "undefined") {
      localStorage.setItem("togethervideo.username", e.target.value);
    }
  };

  return (
    <React.Fragment>
      <div className={styles.container}>
        <Input
          placeholder="Имя пользователя"
          value={myUsername}
          onChange={handleMyUsernameChange}
          className={styles.myUsernameInput}
          size="middle"
          prefix={<UserOutlined />}
        />
        {videoUrl ? (
          <div className={styles.video}>
            <ReactPlayer
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
              <Button type="primary">Синхронизировать</Button>
              <Popconfirm
                title="Удалить видео"
                description="Точно удалить?"
                okText="Удалить"
                cancelText="Нет"
                onConfirm={handleRemoveVideo}
              >
                <Button danger>Удалить видео</Button>
              </Popconfirm>
            </div>
          </div>
        ) : (
          <div className={styles.fileInput} {...getRootProps()}>
            <input {...getInputProps()} />
            {isDragActive ? (
              <p>Drop the files here ...</p>
            ) : (
              <p>Drag 'n' drop some files here, or click to select files</p>
            )}
          </div>
        )}
        <div className={styles.chat}>
          <div className={styles.chatMessages}>
            {chatMessages.map(({ username, message, timestamp }, index) => {
              return username === myUsername ? (
                <div
                  className={styles.chatMessage}
                  style={{
                    alignSelf: "flex-end",
                    textAlign: "right",
                    paddingLeft: "24px",
                    paddingRight: "12px",
                  }}
                  key={index}
                >
                  <span className={styles.chatMessageUsername}>{username}</span>
                  {message}
                  <span style={{
                    marginLeft: "-12px",
                    textAlign: "left"
                  }} className={styles.chatMessageTimestamp}>{formatLocalTime(timestamp)}</span>
                </div>
              ) : (
                <div className={styles.chatMessage} key={index}>
                  <span className={styles.chatMessageUsername}>{username}</span>
                  {message}
                  <span className={styles.chatMessageTimestamp}>{formatLocalTime(timestamp)}</span>
                </div>
              );
            })}
          </div>
          <div className={styles.chatTextAreaContainer}>
            <TextArea
              placeholder="Сообщение"
              autoSize={{
                minRows: 1.6,
              }}
              value={messageInput}
              onChange={handleMessageChange}
            />
            <SendOutlined className={styles.sendButton} onClick={sendMessage} />
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}
