// RealTimeTrajectory.js
import { useEffect, useState } from "react";
import * as Cesium from "cesium";

export function RealTimeTrajectory({ viewerRef, models, setModels }) {
    const [socket, setSocket] = useState(null);
    const [isRealTime, setIsRealTime] = useState(false);

    // WebSocket连接函数
    const connectWebSocket = () => {
        if (socket) {
            socket.close();
            setIsRealTime(false);
            return;
        }

        const ws = new WebSocket("ws://localhost:8080");

        ws.onopen = () => {
            console.log("WebSocket connected");
            setSocket(ws);
            setIsRealTime(true);
        };

        ws.onmessage = event => {
            const data = JSON.parse(event.data);
            const dataPanel = document.getElementById("dataPanel");

            // Update data panel
            dataPanel.innerHTML = `
                <strong>6DOF Data:</strong><br>
                Yaw: ${data.yaw.toFixed(2)}°<br>
                Pitch: ${data.pitch.toFixed(2)}°<br>
                Roll: ${data.roll.toFixed(2)}°<br>
                Latitude: ${data.latitude.toFixed(6)}<br>
                Longitude: ${data.longitude.toFixed(6)}<br>
                Altitude: ${data.altitude.toFixed(2)}m
            `;
            updateModelFromServer(data);
        };

        ws.onerror = error => {
            console.error("WebSocket error:", error);
        };

        ws.onclose = () => {
            console.log("WebSocket disconnected");
            setSocket(null);
            setIsRealTime(false);
        };
    };

    // 根据服务器数据更新模型
    const updateModelFromServer = data => {
        if (!viewerRef.current || !models.target) return;

        const position = Cesium.Cartesian3.fromDegrees(
            data.longitude,
            data.latitude,
            data.altitude
        );

        const hpr = new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(data.yaw),
            Cesium.Math.toRadians(data.pitch),
            Cesium.Math.toRadians(data.roll)
        );

        models.target.modelMatrix =
            Cesium.Matrix4.fromTranslationQuaternionRotationScale(
                position,
                Cesium.Quaternion.fromHeadingPitchRoll(hpr),
                new Cesium.Cartesian3(1.0, 1.0, 1.0)
            );
    };

    // 清理函数
    useEffect(() => {
        return () => {
            if (socket) {
                socket.close();
            }
        };
    }, [socket]);

    return {
        isRealTime,
        connectWebSocket,
    };
}
