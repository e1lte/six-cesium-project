import { useRef, useState, useEffect } from "react";
import "./FirstPage.css";
import { Viewer } from "resium";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { ak, BEIJING_POSITION, SHANGHAI_POSITION } from "../config/data.js";
import * as XLSX from "xlsx";
import { RealTimeTrajectory } from "./RealTimeTrajectory.jsx";
import SimulationConfigModal from "./SimulationConfigModal.tsx";
import { ModelSelectionModal } from "./ModelSelectionModal.js";
import { ModelTypeModal } from "./ModelType.js";

function FirstPage() {
    Cesium.Ion.defaultAccessToken = ak;
    // 在FirstPage组件中修改状态
    const [models, setModels] = useState({
        model1: null,
        model2: null,
        model3: null,
        model4: null,
        model5: null,
        model6: null,
        model7: null,
        model8: null,
    });

    const [modelFiles, setModelFiles] = useState({
        model1: null,
        model2: null,
        model3: null,
        model4: null,
        model5: null,
        model6: null,
        model7: null,
        model8: null,
    });

    const [offsets, setOffsets] = useState({
        model1: { yaw: 0, pitch: 0, roll: 0 },
        model2: { yaw: 0, pitch: 0, roll: 0 },
        model3: { yaw: 0, pitch: 0, roll: 0 },
        model4: { yaw: 0, pitch: 0, roll: 0 },
        model5: { yaw: 0, pitch: 0, roll: 0 },
        model6: { yaw: 0, pitch: 0, roll: 0 },
        model7: { yaw: 0, pitch: 0, roll: 0 },
        model8: { yaw: 0, pitch: 0, roll: 0 },
    });

    const modelPathPositionsRef = useRef({
        model1: [],
        model2: [],
        model3: [],
        model4: [],
        model5: [],
        model6: [],
        model7: [],
        model8: [],
    });
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [simulationConfigs, setSimulationConfigs] = useState([]);
    const [activeConfigIndex, setActiveConfigIndex] = useState(0);
    const [showModelTypeModal, setShowModelTypeModal] = useState(false);
    const position1 = BEIJING_POSITION;
    const position2 = SHANGHAI_POSITION;

    const [sixDofData, setSixDofData] = useState([]);
    const [speedMultiplier, setSpeedMultiplier] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const targetPathPositionsRef = useRef([]);
    const missilePathPositionsRef = useRef([]);
    const [showModelModal, setShowModelModal] = useState(false);
    const [currentModelType, setCurrentModelType] = useState(null);
    // Add to your state

    const viewerRef = useRef(null);

    const animationDataRef = useRef(null);
    const startTimeRef = useRef(null);
    const animationFrameIdRef = useRef(null);
    const pathEntityRef = useRef(null);

    const [activeModel, setActiveModel] = useState("target"); // 'target' or 'missile'

    // 使用实时轨迹组件
    const { isRealTime, connectWebSocket } = RealTimeTrajectory({
        viewerRef,
        models,
        setModels,
    });

    const loadModel = async (file, modelId = "model1") => {
        if (!viewerRef.current || !viewerRef.current.cesiumElement) {
            console.error("Viewer is not initialized!");
            return;
        }

        setModelFiles(prev => ({
            ...prev,
            [modelId]: file.name,
        }));

        const url = URL.createObjectURL(file);
        const cesiumViewer = viewerRef.current.cesiumElement;

        try {
            // Remove old model
            if (models[modelId]) {
                cesiumViewer.scene.primitives.remove(models[modelId]);
            }

            // 使用默认位置
            const initialPosition = Cesium.Cartesian3.fromDegrees(
                116.3 + Math.random() * 0.1, // 随机位置防止重叠
                39.9 + Math.random() * 0.1,
                500
            );

            const model = await Cesium.Model.fromGltfAsync({
                url: url,
                modelMatrix:
                    Cesium.Transforms.eastNorthUpToFixedFrame(initialPosition),
                scale: 10.0,
            });

            // 设置模型属性...
            model.silhouetteColor = Cesium.Color.GOLD;
            model.silhouetteSize = 1.0;
            model.colorBlendMode = Cesium.ColorBlendMode.MIX;
            model.depthTestAgainstTerrain = false;
            model.colorBlendMode = Cesium.ColorBlendMode.HIGHLIGHT;
            model.maximumScale = 200000;
            model.minimumPixelSize = 42;
            cesiumViewer.scene.primitives.add(model);

            // 更新模型引用
            setModels(prev => ({
                ...prev,
                [modelId]: model,
            }));

            // 准备动画路径
            if (
                animationDataRef.current &&
                animationDataRef.current.length > 0
            ) {
                prepareAnimation();
            }
        } catch (error) {
            console.error("An error occurred while loading the model:", error);
        } finally {
            URL.revokeObjectURL(url);
        }
    };

    // 添加创建默认模型的函数
    const createDefaultModel = async (modelType, position) => {
        if (!viewerRef.current || !viewerRef.current.cesiumElement) return;

        const cesiumViewer = viewerRef.current.cesiumElement;
        const initialPosition = Cesium.Cartesian3.fromDegrees(
            position.x,
            position.y,
            position.z
        );

        try {
            // 使用Cesium内置的模型作为默认模型
            const model = await Cesium.Model.fromGltfAsync({
                url: Cesium.IonResource.fromAssetId(3878), // Cesium内置的飞机模型
                modelMatrix:
                    Cesium.Transforms.eastNorthUpToFixedFrame(initialPosition),
                scale: 10.0,
            });

            model.silhouetteColor =
                modelType === "target" ? Cesium.Color.YELLOW : Cesium.Color.RED;
            model.silhouetteSize = 1.0;
            model.colorBlendMode = Cesium.ColorBlendMode.MIX;
            model.depthTestAgainstTerrain = false;
            model.maximumScale = 200000;
            model.minimumPixelSize = 42;

            cesiumViewer.scene.primitives.add(model);

            // 更新模型引用
            setModels(prev => ({
                ...prev,
                [modelType]: model,
            }));
        } catch (error) {
            console.error("Error creating default model:", error);
        }
        const initialOrientation = { yaw: 0, pitch: 0, roll: 0 };
        updateModel(model, position, initialOrientation, modelType);
    };

    const prepareAnimation = () => {
        if (!viewerRef.current || !animationDataRef.current) return;

        const cesiumViewer = viewerRef.current.cesiumElement;

        // 清除之前的路径
        if (pathEntityRef.current) {
            pathEntityRef.current.forEach(entity =>
                cesiumViewer.entities.remove(entity)
            );
        }

        // 为每个模型创建路径实体
        pathEntityRef.current = [];
        const colors = [
            Cesium.Color.YELLOW,
            Cesium.Color.RED,
            Cesium.Color.BLUE,
            Cesium.Color.GREEN,
            Cesium.Color.PURPLE,
            Cesium.Color.ORANGE,
            Cesium.Color.CYAN,
            Cesium.Color.PINK,
        ];

        for (let i = 1; i <= 8; i++) {
            const modelId = `model${i}`;
            pathEntityRef.current.push(
                cesiumViewer.entities.add({
                    name: `${modelId} Path`,
                    polyline: {
                        positions: new Cesium.CallbackProperty(() => {
                            return modelPathPositionsRef.current[modelId] || [];
                        }, false),
                        width: 2,
                        material: new Cesium.PolylineGlowMaterialProperty({
                            glowPower: 0.2,
                            color: colors[i - 1],
                        }),
                    },
                })
            );
        }

        // 初始化路径点数组
        for (let i = 1; i <= 8; i++) {
            modelPathPositionsRef.current[`model${i}`] = [];
        }
    };

    const startAnimation = () => {
        if (!viewerRef.current || !animationDataRef.current) return;

        const data = animationDataRef.current;
        if (data.length === 0) return;

        // 初始化所有模型位置
        for (let i = 1; i <= 8; i++) {
            const modelId = `model${i}`;
            if (models[modelId] && data[0]?.positions[modelId]) {
                const initialPos = data[0].positions[modelId];
                const initialOri = data[0].orientations[modelId];
                updateModel(models[modelId], initialPos, initialOri, modelId);

                modelPathPositionsRef.current[modelId] = [
                    Cesium.Cartesian3.fromDegrees(
                        initialPos.x,
                        initialPos.y,
                        initialPos.z
                    ),
                ];
            }
        }

        setIsPlaying(true);
        startTimeRef.current = performance.now();

        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
        }

        const animate = () => {
            const elapsed =
                (performance.now() - startTimeRef.current) * speedMultiplier;
            const totalDuration = data[data.length - 1].time;

            if (elapsed >= totalDuration) {
                stopAnimation();
                return;
            }

            let currentTime = elapsed;
            let currentIndex = 0;
            for (let i = 0; i < data.length; i++) {
                if (data[i].time > currentTime) break;
                currentIndex = i;
            }

            const nextIndex = Math.min(currentIndex + 1, data.length - 1);
            const prevData = data[currentIndex];
            const nextData = data[nextIndex];
            const timeRange = nextData.time - prevData.time;
            const ratio =
                timeRange > 0 ? (currentTime - prevData.time) / timeRange : 0;

            // 更新所有模型
            for (let i = 1; i <= 8; i++) {
                const modelId = `model${i}`;
                if (
                    models[modelId] &&
                    prevData.positions[modelId] &&
                    nextData.positions[modelId]
                ) {
                    const modelPos = interpolatePosition(
                        prevData.positions[modelId],
                        nextData.positions[modelId],
                        ratio
                    );
                    const modelOri = interpolateOrientation(
                        prevData.orientations[modelId],
                        nextData.orientations[modelId],
                        ratio
                    );
                    updateModel(models[modelId], modelPos, modelOri, modelId);

                    // 添加到路径
                    const newPos = Cesium.Cartesian3.fromDegrees(
                        modelPos.x,
                        modelPos.y,
                        modelPos.z
                    );
                    const currentPath = modelPathPositionsRef.current[modelId];
                    if (
                        !currentPath.length ||
                        !Cesium.Cartesian3.equals(
                            newPos,
                            currentPath[currentPath.length - 1]
                        )
                    ) {
                        modelPathPositionsRef.current[modelId] = [
                            ...currentPath,
                            newPos,
                        ];
                    }
                }
            }

            animationFrameIdRef.current = requestAnimationFrame(animate);
        };

        animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    // 停止动画
    const stopAnimation = () => {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        setIsPlaying(false);
    };

    // 处理速度变化
    useEffect(() => {
        // 如果动画正在播放，重新开始以应用新的速度
        if (isPlaying) {
            stopAnimation();
            startAnimation();
        }
    }, [speedMultiplier]);

    // 组件卸载时清理
    useEffect(() => {
        return () => {
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
            }
        };
    }, []);

    // 调整速度
    const adjustSpeed = multiplier => {
        setSpeedMultiplier(multiplier);
    };

    // Helper functions
    const interpolatePosition = (prevPos, nextPos, ratio) => {
        return {
            x: Cesium.Math.lerp(prevPos.x, nextPos.x, ratio),
            y: Cesium.Math.lerp(prevPos.y, nextPos.y, ratio),
            z: Cesium.Math.lerp(prevPos.z, nextPos.z, ratio),
        };
    };

    const interpolateOrientation = (prevOri, nextOri, ratio) => {
        return {
            roll: Cesium.Math.lerp(prevOri.roll, nextOri.roll, ratio),
            pitch: Cesium.Math.lerp(prevOri.pitch, nextOri.pitch, ratio),
            yaw: Cesium.Math.lerp(prevOri.yaw, nextOri.yaw, ratio),
        };
    };

    const updateModel = (model, position, orientation, modelType) => {
        if (!model) return;

        const cartesianPos = Cesium.Cartesian3.fromDegrees(
            position.x,
            position.y,
            position.z
        );

        // 获取当前模型的偏移量
        const currentOffsets = offsets[modelType] || {
            yaw: 0,
            pitch: 0,
            roll: 0,
        };

        // 应用偏移量到方向
        const hpr = new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(orientation.yaw + currentOffsets.yaw),
            Cesium.Math.toRadians(orientation.pitch + currentOffsets.pitch),
            Cesium.Math.toRadians(orientation.roll + currentOffsets.roll)
        );

        const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(hpr);

        model.modelMatrix =
            Cesium.Matrix4.fromTranslationQuaternionRotationScale(
                cartesianPos,
                quaternion,
                new Cesium.Cartesian3(1.0, 1.0, 1.0)
            );
    };

    const handleSelectExistingModel = () => {
        setShowModelModal(false);
        setShowModelTypeModal(true);
    };

    const handleSelectModelType = async modelType => {
        setShowModelTypeModal(false);

        if (!currentModelType || !viewerRef.current) return;

        try {
            // 方法1：使用绝对路径（推荐）
            const modelUrl = `${window.location.origin}/localModel/${modelType}.glb`;
            console.log("尝试加载模型:", modelUrl); // 调试用

            // 直接使用URL加载，不转换为File对象
            await loadModelFromUrl(modelUrl, currentModelType);
        } catch (error) {
            console.error("模型加载失败:", error);
            // 回退到Cesium默认模型
            const position =
                currentModelType === "target" ? position1 : position2;
            createDefaultModel(currentModelType, {
                x: position.longitude,
                y: position.latitude,
                z: currentModelType === "target" ? 500 : 1000,
            });
            alert(`模型加载失败，已使用默认模型代替\n错误: ${error.message}`);
        }
    };

    // 新增的URL加载方法
    const loadModelFromUrl = async (url, modelType) => {
        if (!viewerRef.current?.cesiumElement) {
            throw new Error("Cesium viewer未初始化");
        }

        const cesiumViewer = viewerRef.current.cesiumElement;

        // 移除旧模型
        if (models[modelType]) {
            cesiumViewer.scene.primitives.remove(models[modelType]);
        }

        // 使用Cesium的fromGltfAsync直接加载URL
        const model = await Cesium.Model.fromGltfAsync({
            url: url,
            modelMatrix: Cesium.Matrix4.IDENTITY,
            scale: 10.0,
        });

        // 设置模型属性
        model.silhouetteColor =
            modelType === "target" ? Cesium.Color.YELLOW : Cesium.Color.RED;
        model.silhouetteSize = 1.0;
        model.minimumPixelSize = 64;

        cesiumViewer.scene.primitives.add(model);

        // 更新模型引用
        setModels(prev => ({
            ...prev,
            [modelType]: model,
        }));

        // 初始化位置
        const initialPos =
            animationDataRef.current?.[0]?.[`${modelType}Position`] ||
            (modelType === "target" ? position1 : position2);

        const cartesianPos = Cesium.Cartesian3.fromDegrees(
            initialPos.x || initialPos.longitude,
            initialPos.y || initialPos.latitude,
            initialPos.z || (modelType === "target" ? 500 : 1000)
        );

        model.modelMatrix = Cesium.Matrix4.fromTranslation(cartesianPos);
    };
    const adjustYaw = degrees => {
        setOffsets(prev => ({
            ...prev,
            [activeModel]: {
                ...prev[activeModel],
                yaw: (prev[activeModel]?.yaw || 0) + degrees,
            },
        }));
    };

    const adjustPitch = degrees => {
        setOffsets(prev => ({
            ...prev,
            [activeModel]: {
                ...prev[activeModel],
                pitch: (prev[activeModel]?.pitch || 0) + degrees,
            },
        }));
    };

    const adjustRoll = degrees => {
        setOffsets(prev => ({
            ...prev,
            [activeModel]: {
                ...prev[activeModel],
                roll: (prev[activeModel]?.roll || 0) + degrees,
            },
        }));
    };

    const resetOrientation = () => {
        // 直接重置偏移量，不检查模型是否存在
        setOffsets(prev => ({
            ...prev,
            [activeModel]: { yaw: 0, pitch: 0, roll: 0 },
        }));

        // 如果模型存在，应用重置
        if (models[activeModel]) {
            const model = models[activeModel];
            const position = Cesium.Matrix4.getTranslation(
                model.modelMatrix,
                new Cesium.Cartesian3()
            );

            const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(
                new Cesium.HeadingPitchRoll(0, 0, 0)
            );

            model.modelMatrix =
                Cesium.Matrix4.fromTranslationQuaternionRotationScale(
                    position,
                    quaternion,
                    new Cesium.Cartesian3(1.0, 1.0, 1.0)
                );
        }
    };

    const hoverModel = () => {
        let container = document.querySelector(".model-list-container");
        if (!container) {
            container = document.createElement("div");
            container.className = "model-list-container";
            document.body.appendChild(container);

            document.addEventListener("click", e => {
                if (
                    !container.contains(e.target) &&
                    e.target.className !== "tool-btn"
                ) {
                    container.style.display = "none";
                }
            });
        }

        container.style.display =
            container.style.display === "none" ? "block" : "none";

        container.innerHTML = `
            <h3 class="model-list-title">已加载模型</h3>
            <ul class="model-list">
                ${Object.entries(modelFiles)
                    .filter(([_, name]) => name)
                    .map(([id, name]) => `<li>${id}: ${name}</li>`)
                    .join("")}
            </ul>
        `;
    };
    const parseTrajectoryFile = async file => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: "array" });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    let startTime = null;
                    const parsedData = jsonData.map((row, index) => {
                        const timestamp = row.time * 1000 || index * 100;
                        if (index === 0) startTime = timestamp;

                        return {
                            time: timestamp - startTime,
                            positions: {
                                model1: {
                                    x: row.P_Target_L || row.longitude || 0,
                                    y: row.P_Target_B || row.latitude || 0,
                                    z: row.P_Target_H || row.height || 0,
                                },
                                model2: {
                                    x: row.P_Missile_L || row.longitude2 || 0,
                                    y: row.P_Missile_B || row.latitude2 || 0,
                                    z: row.P_Missile_H || row.height2 || 0,
                                },
                            },
                            orientations: {
                                model1: {
                                    roll: row.roll || 0,
                                    pitch: row.pitch || 0,
                                    yaw: row.yaw || 0,
                                },
                                model2: {
                                    roll: row.Roll || 0,
                                    pitch: row.Pitch || 0,
                                    yaw: row.Yaw || 0,
                                },
                            },
                        };
                    });

                    resolve(parsedData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };
    const combineTrajectoryData = trajectories => {
        if (trajectories.length === 1) return trajectories[0];

        // 找到最长的轨迹作为基准
        const maxLength = Math.max(...trajectories.map(t => t.length));
        const combinedData = [];

        for (let i = 0; i < maxLength; i++) {
            const combinedFrame = {
                time: i * 100, // 假设每帧100ms
                positions: {},
                orientations: {},
            };

            // 合并所有轨迹的当前帧
            trajectories.forEach((trajectory, idx) => {
                const frame = trajectory[Math.min(i, trajectory.length - 1)];

                // 为每个模型组分配不同的模型ID
                const model1Id = `model${idx * 2 + 1}`;
                const model2Id = `model${idx * 2 + 2}`;

                // 使用轨迹中的模型数据
                combinedFrame.positions[model1Id] = frame.positions.model1 || {
                    x: 0,
                    y: 0,
                    z: 0,
                };
                combinedFrame.orientations[model1Id] = frame.orientations
                    .model1 || { roll: 0, pitch: 0, yaw: 0 };

                combinedFrame.positions[model2Id] = frame.positions.model2 || {
                    x: 0,
                    y: 0,
                    z: 0,
                };
                combinedFrame.orientations[model2Id] = frame.orientations
                    .model2 || { roll: 0, pitch: 0, yaw: 0 };
            });

            combinedData.push(combinedFrame);
        }

        return combinedData;
    };
    const loadConfiguration = async configs => {
        try {
            // 加载所有模型
            for (let i = 0; i < configs.length; i++) {
                const config = configs[i];
                const model1Id = `model${i * 2 + 1}`;
                const model2Id = `model${i * 2 + 2}`;

                if (config.targetModelFile) {
                    await loadModel(config.targetModelFile, model1Id);
                }
                if (config.missileModelFile) {
                    await loadModel(config.missileModelFile, model2Id);
                }
            }
            console.log("configs1", configs, typeof configs);
            // 加载所有轨迹数据
            const allTrajectoryData = await Promise.all(
                configs
                    .filter(config => config.trajectoryFile)
                    .map(config => parseTrajectoryFile(config.trajectoryFile))
            );

            if (allTrajectoryData.length > 0) {
                // 合并所有轨迹数据
                const combinedData = combineTrajectoryData(allTrajectoryData);
                setSixDofData(combinedData);
                animationDataRef.current = combinedData;
                prepareAnimation();
            }
        } catch (error) {
            console.error("Error loading configuration:", error);
        }
    };
    const toggleAnimation = () => {
        if (isPlaying) {
            stopAnimation();
        } else {
            // 重置所有路径
            for (let i = 1; i <= 8; i++) {
                modelPathPositionsRef.current[`model${i}`] = [];
            }

            startAnimation();
        }
    };
    return (
        <div className="container">
            <header>
                <h1>飞行器可视化仿真软件</h1>
            </header>
            {showModelTypeModal && (
                <ModelTypeModal
                    onClose={() => setShowModelTypeModal(false)}
                    onSelectModelType={handleSelectModelType}
                />
            )}
            {showModelModal && (
                <ModelSelectionModal
                    onClose={() => setShowModelModal(false)}
                    onSelectLocal={handleSelectLocalModel}
                    onSelectExisting={handleSelectExistingModel}
                />
            )}
            <div className="content">
                <nav>
                    <div className="nav-div">
                        <a href="#" onClick={toggleAnimation}>
                            {isPlaying ? "停止仿真" : "开始仿真"}
                        </a>
                    </div>
                    <div className="nav-div">
                        <a href="#" onClick={() => setShowConfigModal(true)}>
                            仿真配置
                        </a>
                    </div>

                    {showConfigModal && (
                        <SimulationConfigModal
                            onClose={() => setShowConfigModal(false)}
                            onConfirm={configs => {
                                console.log("configs:", configs);
                                setSimulationConfigs(configs);

                                if (configs.length > 0) {
                                    loadConfiguration(configs);
                                }
                            }}
                        />
                    )}

                    <div className="nav-div">
                        <a
                            href="#"
                            onClick={() => {
                                connectWebSocket();
                            }}
                        >
                            {isRealTime ? "停止实时" : "实时仿真"}
                        </a>
                    </div>
                </nav>

                <main>
                    <Viewer ref={viewerRef} />
                </main>
            </div>
            <div className="tool-line">
                <button className="tool-btn" onClick={hoverModel}>
                    Model
                </button>

                <select
                    className="tool-btn"
                    value={activeModel}
                    onChange={e => setActiveModel(e.target.value)}
                >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <option key={`model${i}`} value={`model${i}`}>
                            模型 {i}
                        </option>
                    ))}
                </select>

                <button className="tool-btn" onClick={() => adjustYaw(10)}>
                    +Yaw
                </button>
                <button className="tool-btn" onClick={() => adjustYaw(-10)}>
                    -Yaw
                </button>
                <button className="tool-btn" onClick={() => adjustPitch(5)}>
                    +Pitch
                </button>
                <button className="tool-btn" onClick={() => adjustPitch(-5)}>
                    -Pitch
                </button>
                <button className="tool-btn" onClick={() => adjustRoll(5)}>
                    +Roll
                </button>
                <button className="tool-btn" onClick={() => adjustRoll(-5)}>
                    -Roll
                </button>

                <select
                    className="tool-btn"
                    value={speedMultiplier}
                    onChange={e => setSpeedMultiplier(Number(e.target.value))}
                >
                    {[1, 2, 4, 8, 16, 32].map(multiplier => (
                        <option key={`speed-${multiplier}`} value={multiplier}>
                            {multiplier}X
                        </option>
                    ))}
                </select>

                <button className="tool-btn" onClick={resetOrientation}>
                    复位
                </button>
            </div>
            <div id="dataPanel">Waiting for data...</div>
        </div>
    );
}

export default FirstPage;
