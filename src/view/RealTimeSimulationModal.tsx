// src/view/RealTimeSimulationModal.jsx
import React, { useState, useRef } from "react";
import "./RealTimeSimulationModal.css";
import * as Cesium from "cesium";

const RealTimeSimulationModal = ({
    isOpen,
    onClose,
    onStartSimulation,
    viewerRef,
}) => {
    const [models, setModels] = useState({
        model1: null,
        model2: null,
    });

    const [modelEntities, setModelEntities] = useState({
        model1: null,
        model2: null,
    });

    const [isConnected, setIsConnected] = useState(false);
    const websocketRef = useRef(null);
    const wsUrlRef = useRef("ws://localhost:8080");

    // 选择模型文件
    const handleModelSelect = modelId => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".glb,.gltf";
        input.onchange = e => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                setModels(prev => ({
                    ...prev,
                    [modelId]: file,
                }));
            }
        };
        input.click();
    };

    // 移除选中的模型
    const removeModel = (modelId, e) => {
        e.stopPropagation();
        setModels(prev => ({
            ...prev,
            [modelId]: null,
        }));
    };

    // WebSocket服务器地址变更
    const handleWsUrlChange = e => {
        wsUrlRef.current = e.target.value;
    };

    // 连接WebSocket服务器
    const connectToServer = () => {
        try {
            // 创建WebSocket连接
            const ws = new WebSocket(wsUrlRef.current);

            ws.onopen = () => {
                console.log("WebSocket连接成功");
                setIsConnected(true);
            };

            ws.onclose = () => {
                console.log("WebSocket连接已关闭");
                setIsConnected(false);
            };

            ws.onerror = error => {
                console.error("WebSocket连接错误:", error);
                alert("服务器连接失败，请检查服务器状态和地址");
                setIsConnected(false);
            };

            websocketRef.current = ws;
        } catch (error) {
            console.error("创建WebSocket连接时出错:", error);
            alert("无法创建WebSocket连接");
        }
    };

    // 断开WebSocket连接
    const disconnectFromServer = () => {
        if (websocketRef.current) {
            websocketRef.current.close();
            websocketRef.current = null;
            setIsConnected(false);
        }
    };

    // 加载模型到Cesium场景
    const loadModelsToScene = async () => {
        if (!viewerRef.current || !viewerRef.current.cesiumElement) {
            alert("Cesium场景未初始化");
            return false;
        }

        const cesiumViewer = viewerRef.current.cesiumElement;
        const loadedEntities = { model1: null, model2: null };

        try {
            // 加载第一个模型
            if (models.model1) {
                const model1URL = URL.createObjectURL(models.model1);
                // 北京位置
                const position1 = Cesium.Cartesian3.fromDegrees(
                    116.4,
                    39.9,
                    500
                );

                const model1 = await Cesium.Model.fromGltfAsync({
                    url: model1URL,
                    modelMatrix:
                        Cesium.Transforms.eastNorthUpToFixedFrame(position1),
                    scale: 10.0,
                });

                model1.silhouetteColor = Cesium.Color.YELLOW;
                model1.silhouetteSize = 1.0;
                model1.colorBlendMode = Cesium.ColorBlendMode.HIGHLIGHT;
                model1.minimumPixelSize = 42;

                cesiumViewer.scene.primitives.add(model1);
                loadedEntities.model1 = model1;

                URL.revokeObjectURL(model1URL);
            }

            // 加载第二个模型
            if (models.model2) {
                const model2URL = URL.createObjectURL(models.model2);
                // 北京位置，纬度相差0.1
                const position2 = Cesium.Cartesian3.fromDegrees(
                    116.4,
                    40.0,
                    500
                );

                const model2 = await Cesium.Model.fromGltfAsync({
                    url: model2URL,
                    modelMatrix:
                        Cesium.Transforms.eastNorthUpToFixedFrame(position2),
                    scale: 10.0,
                });

                model2.silhouetteColor = Cesium.Color.RED;
                model2.silhouetteSize = 1.0;
                model2.colorBlendMode = Cesium.ColorBlendMode.HIGHLIGHT;
                model2.minimumPixelSize = 42;

                cesiumViewer.scene.primitives.add(model2);
                loadedEntities.model2 = model2;

                URL.revokeObjectURL(model2URL);
            }

            setModelEntities(loadedEntities);
            return true;
        } catch (error) {
            console.error("加载模型时出错:", error);
            alert(`加载模型失败: ${error.message}`);

            // 清理已加载的模型
            Object.values(loadedEntities).forEach(entity => {
                if (entity) {
                    cesiumViewer.scene.primitives.remove(entity);
                }
            });

            return false;
        }
    };

    // 开始实时仿真
    const startRealTimeSimulation = async () => {
        if (!isConnected) {
            alert("请先连接到服务器");
            return;
        }

        if (!models.model1 && !models.model2) {
            alert("请至少选择一个模型");
            return;
        }

        // 加载模型到场景
        const loadSuccess = await loadModelsToScene();
        if (!loadSuccess) return;

        // 设置WebSocket消息处理函数
        if (websocketRef.current) {
            websocketRef.current.onmessage = event => {
                try {
                    const data = JSON.parse(event.data);
                    updateModelsPosition(data);
                } catch (error) {
                    console.error("解析WebSocket消息时出错:", error);
                }
            };
        }

        // 调用父组件的开始仿真方法
        onStartSimulation(modelEntities);

        // 关闭弹窗
        onClose();
    };

    // 更新模型位置和姿态
    const updateModelsPosition = data => {
        if (!viewerRef.current?.cesiumElement) return;

        // 更新模型1
        if (modelEntities.model1 && data.model1) {
            const position = Cesium.Cartesian3.fromDegrees(
                data.model1.longitude || 116.4,
                data.model1.latitude || 39.9,
                data.model1.altitude || 500
            );

            // 创建姿态四元数
            const hpr = new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(data.model1.yaw || 0),
                Cesium.Math.toRadians(data.model1.pitch || 0),
                Cesium.Math.toRadians(data.model1.roll || 0)
            );

            const orientation = Cesium.Quaternion.fromHeadingPitchRoll(hpr);

            // 更新模型矩阵
            modelEntities.model1.modelMatrix =
                Cesium.Matrix4.fromTranslationQuaternionRotationScale(
                    position,
                    orientation,
                    new Cesium.Cartesian3(1.0, 1.0, 1.0)
                );
        }

        // 更新模型2
        if (modelEntities.model2 && data.model2) {
            const position = Cesium.Cartesian3.fromDegrees(
                data.model2.longitude || 116.4,
                data.model2.latitude || 40.0,
                data.model2.altitude || 500
            );

            // 创建姿态四元数
            const hpr = new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(data.model2.yaw || 0),
                Cesium.Math.toRadians(data.model2.pitch || 0),
                Cesium.Math.toRadians(data.model2.roll || 0)
            );

            const orientation = Cesium.Quaternion.fromHeadingPitchRoll(hpr);

            // 更新模型矩阵
            modelEntities.model2.modelMatrix =
                Cesium.Matrix4.fromTranslationQuaternionRotationScale(
                    position,
                    orientation,
                    new Cesium.Cartesian3(1.0, 1.0, 1.0)
                );
        }
    };

    // 如果弹窗未打开，不渲染任何内容
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="realtime-modal">
                <div className="modal-header">
                    <h3>实时仿真设置</h3>
                    <button className="close-btn" onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className="modal-body">
                    <div className="model-selection">
                        <h4>选择模型 (最多两个)</h4>

                        <div className="model-grid">
                            <div className="model-slot">
                                <div
                                    className="model-box"
                                    onClick={() => handleModelSelect("model1")}
                                >
                                    {models.model1 ? (
                                        <div className="model-preview">
                                            <div className="model-filename">
                                                {models.model1.name}
                                            </div>
                                            <button
                                                className="remove-model"
                                                onClick={e =>
                                                    removeModel("model1", e)
                                                }
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="model-placeholder">
                                            <div className="add-icon">+</div>
                                            <div>点击选择模型</div>
                                        </div>
                                    )}
                                </div>
                                <div className="model-label">模型 1</div>
                            </div>

                            <div className="model-slot">
                                <div
                                    className="model-box"
                                    onClick={() => handleModelSelect("model2")}
                                >
                                    {models.model2 ? (
                                        <div className="model-preview">
                                            <div className="model-filename">
                                                {models.model2.name}
                                            </div>
                                            <button
                                                className="remove-model"
                                                onClick={e =>
                                                    removeModel("model2", e)
                                                }
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="model-placeholder">
                                            <div className="add-icon">+</div>
                                            <div>点击选择模型</div>
                                        </div>
                                    )}
                                </div>
                                <div className="model-label">模型 2</div>
                            </div>
                        </div>
                    </div>

                    <div className="server-connection">
                        <h4>WebSocket服务器连接</h4>
                        <div className="server-input">
                            <input
                                type="text"
                                defaultValue={wsUrlRef.current}
                                onChange={handleWsUrlChange}
                                placeholder="ws://localhost:8080"
                                disabled={isConnected}
                            />
                        </div>
                        <button
                            className={`connect-btn ${
                                isConnected ? "connected" : ""
                            }`}
                            onClick={
                                isConnected
                                    ? disconnectFromServer
                                    : connectToServer
                            }
                        >
                            {isConnected ? "断开连接" : "连接服务器"}
                        </button>
                        <div className="connection-status">
                            状态:{" "}
                            <span
                                className={
                                    isConnected
                                        ? "connected-text"
                                        : "disconnected-text"
                                }
                            >
                                {isConnected ? "已连接" : "未连接"}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="cancel-btn" onClick={onClose}>
                        取消
                    </button>
                    <button
                        className="start-btn"
                        onClick={startRealTimeSimulation}
                        disabled={
                            !isConnected || (!models.model1 && !models.model2)
                        }
                    >
                        开始实时仿真
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RealTimeSimulationModal;
