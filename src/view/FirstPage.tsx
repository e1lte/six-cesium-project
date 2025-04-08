import React, { useRef, useState, useEffect } from "react";
import "./FirstPage.css";
import { Viewer, Entity } from "resium";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { ak, BEIJING_POSITION, SHANGHAI_POSITION } from "../config/data.js";
import { Form } from "./Form.js";
import * as XLSX from "xlsx";
import { RealTimeTrajectory } from "./RealTimeTrajectory";

function FirstPage() {
    Cesium.Ion.defaultAccessToken = ak;

    const [position1, setPosition1] = useState(BEIJING_POSITION);
    const [position2, setPosition2] = useState(SHANGHAI_POSITION);
    const [showForm, setShowForm] = useState(false);
    const [sixDofData, setSixDofData] = useState([]);
    const [speedMultiplier, setSpeedMultiplier] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const targetPathPositionsRef = useRef([]);
    const missilePathPositionsRef = useRef([]);
    const position = Cesium.Cartesian3.fromDegrees(
        position1.longitude,
        position1.latitude,
        500
    );

    const fileInputRef = useRef(null);
    const missileFileInputRef = useRef(null);
    const elsxRef = useRef(null);
    const viewerRef = useRef(null);

    const cylinderRef = useRef(null);
    const animationDataRef = useRef(null);
    const startTimeRef = useRef(null);
    const animationFrameIdRef = useRef(null);
    const pathEntityRef = useRef(null);

    // State for models
    const [models, setModels] = useState({
        target: null,
        missile: null,
    });

    const [activeModel, setActiveModel] = useState("target"); // 'target' or 'missile'
    const [offsets, setOffsets] = useState({
        target: { yaw: 0, pitch: 0, roll: 0 },
        missile: { yaw: 0, pitch: 0, roll: 0 },
    });
    // 使用实时轨迹组件
    const { isRealTime, connectWebSocket } = RealTimeTrajectory({
        viewerRef,
        models,
        setModels,
    });

    const loadModel = async (file, modelType = "target") => {
        if (!viewerRef.current || !viewerRef.current.cesiumElement) {
            console.error("Viewer is not initialized!");
            return;
        }

        const url = URL.createObjectURL(file);
        const cesiumViewer = viewerRef.current.cesiumElement;

        try {
            // Remove old model of this type
            if (models[modelType]) {
                cesiumViewer.scene.primitives.remove(models[modelType]);
            }

            // 如果有动画数据，使用第一帧的位置
            let initialPosition;
            if (
                animationDataRef.current &&
                animationDataRef.current.length > 0
            ) {
                const firstFrame =
                    modelType === "target"
                        ? animationDataRef.current[0].targetPosition
                        : animationDataRef.current[0].missilePosition;
                initialPosition = Cesium.Cartesian3.fromDegrees(
                    firstFrame.x,
                    firstFrame.y,
                    firstFrame.z
                );
            } else {
                // 否则使用默认位置
                initialPosition =
                    modelType === "target"
                        ? Cesium.Cartesian3.fromDegrees(
                              position1.longitude,
                              position1.latitude,
                              500
                          )
                        : Cesium.Cartesian3.fromDegrees(
                              position2.longitude,
                              position2.latitude,
                              1000
                          );
            }

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
            // model.color = Cesium.Color.WHITE.withAlpha(0.95);
            model.depthTestAgainstTerrain = false;
            model.colorBlendMode = Cesium.ColorBlendMode.HIGHLIGHT; // 增强模型可见性
            model.maximumScale = 200000;
            model.minimumPixelSize = 42;
            cesiumViewer.scene.primitives.add(model);

            // 更新模型引用
            setModels(prev => ({
                ...prev,
                [modelType]: model,
            }));

            // 准备动画路径
            if (
                animationDataRef.current &&
                animationDataRef.current.length > 0
            ) {
                prepareAnimation();
            }

            // 调整视角
            await cesiumViewer.camera.flyTo({
                destination: initialPosition,
                orientation: {
                    heading: Cesium.Math.toRadians(230.0),
                    pitch: Cesium.Math.toRadians(-20.0),
                    roll: 0.0,
                },
            });
        } catch (error) {
            console.error("An error occurred while loading the model:", error);
        } finally {
            URL.revokeObjectURL(url);
        }
    };

    // 处理Excel文件上传
    // 在handleXlsxUpload函数中添加视角移动逻辑
    const handleXlsxUpload = event => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
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
                    targetPosition: {
                        x: row.P_Target_L || row.longitude || 0,
                        y: row.P_Target_B || row.latitude || 0,
                        z: row.P_Target_H || row.height || 0,
                    },
                    missilePosition: {
                        x: row.P_Missile_L || row.longitude2 || 0,
                        y: row.P_Missile_B || row.latitude2 || 0,
                        z: row.P_Missile_H || row.height2 || 0,
                    },
                    targetOrientation: {
                        roll: row.roll || row.Roll || 0,
                        pitch: row.pitch || row.Pitch || 0,
                        yaw: row.yaw || row.Yaw || 0,
                    },
                    missileOrientation: {
                        roll: row.missile_roll || 0,
                        pitch: row.missile_pitch || 0,
                        yaw: row.missile_yaw || 0,
                    },
                };
            });

            setSixDofData(parsedData);
            animationDataRef.current = parsedData;

            if (parsedData.length > 0) {
                // 初始化目标模型位置
                if (models.target) {
                    const initialPos = parsedData[0].targetPosition;
                    const initialOri = parsedData[0].targetOrientation;
                    updateModel(models.target, initialPos, initialOri);
                } else {
                    // 如果目标模型未加载，创建默认模型
                    const initialPos = parsedData[0].targetPosition;
                    createDefaultModel("target", initialPos);
                }

                // 初始化导弹模型位置
                if (models.missile) {
                    const initialPos = parsedData[0].missilePosition;
                    const initialOri = parsedData[0].missileOrientation;
                    updateModel(models.missile, initialPos, initialOri);
                } else {
                    // 如果导弹模型未加载，创建默认模型
                    const initialPos = parsedData[0].missilePosition;
                    createDefaultModel("missile", initialPos);
                }

                // 准备动画路径
                prepareAnimation();

                // 调整视角
                if (viewerRef.current) {
                    const firstPos = parsedData[0].targetPosition;
                    viewerRef.current.cesiumElement.camera.flyTo({
                        destination: Cesium.Cartesian3.fromDegrees(
                            firstPos.x,
                            firstPos.y,
                            Math.max(
                                firstPos.z,
                                parsedData[0].missilePosition.z
                            ) + 500
                        ),
                        orientation: {
                            heading: Cesium.Math.toRadians(0),
                            pitch: Cesium.Math.toRadians(-30),
                            roll: 0.0,
                        },
                        duration: 2,
                    });
                }
            }
        };
        reader.readAsArrayBuffer(file);
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

    // 修改prepareAnimation函数，不再预先绘制完整路径
    const prepareAnimation = () => {
        if (!viewerRef.current || !animationDataRef.current) return;

        const cesiumViewer = viewerRef.current.cesiumElement;

        // 清除之前的路径
        if (pathEntityRef.current) {
            pathEntityRef.current.forEach(entity =>
                cesiumViewer.entities.remove(entity)
            );
        }

        // 创建空的路径实体
        pathEntityRef.current = [
            // 目标路径
            cesiumViewer.entities.add({
                name: "Target Path",
                polyline: {
                    positions: new Cesium.CallbackProperty(() => {
                        return targetPathPositionsRef.current || [];
                    }, false),
                    width: 2,
                    material: new Cesium.PolylineGlowMaterialProperty({
                        glowPower: 0.2,
                        color: Cesium.Color.YELLOW,
                    }),
                },
            }),
            // 导弹路径
            cesiumViewer.entities.add({
                name: "Missile Path",
                polyline: {
                    positions: new Cesium.CallbackProperty(() => {
                        return missilePathPositionsRef.current || [];
                    }, false),
                    width: 2,
                    material: new Cesium.PolylineGlowMaterialProperty({
                        glowPower: 0.2,
                        color: Cesium.Color.RED,
                    }),
                },
            }),
        ];

        // 初始化路径点数组
        targetPathPositionsRef.current = [];
        missilePathPositionsRef.current = [];
    };

    // 修改startAnimation函数，动态更新路径
    const startAnimation = () => {
        if (!viewerRef.current || !animationDataRef.current) {
            console.error("Viewer or animation data not ready!");
            return;
        }

        const data = animationDataRef.current;
        if (data.length === 0) return;

        // 初始化模型位置
        if (models.target && data[0]) {
            const initialPos = data[0].targetPosition;
            const initialOri = data[0].targetOrientation;
            updateModel(models.target, initialPos, initialOri, "target");

            // 添加初始位置到路径
            targetPathPositionsRef.current = [
                Cesium.Cartesian3.fromDegrees(
                    initialPos.x,
                    initialPos.y,
                    initialPos.z
                ),
            ];
        }

        if (models.missile && data[0]) {
            const initialPos = data[0].missilePosition;
            const initialOri = data[0].missileOrientation;
            updateModel(models.missile, initialPos, initialOri, "missile");

            // 添加初始位置到路径
            missilePathPositionsRef.current = [
                Cesium.Cartesian3.fromDegrees(
                    initialPos.x,
                    initialPos.y,
                    initialPos.z
                ),
            ];
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
            let currentTime = elapsed % totalDuration;

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

            // 更新目标模型和路径
            if (models.target) {
                const targetPos = interpolatePosition(
                    prevData.targetPosition,
                    nextData.targetPosition,
                    ratio
                );
                const targetOri = interpolateOrientation(
                    prevData.targetOrientation,
                    nextData.targetOrientation,
                    ratio
                );
                updateModel(models.target, targetPos, targetOri, "target");

                // 动态添加路径点
                const newPos = Cesium.Cartesian3.fromDegrees(
                    targetPos.x,
                    targetPos.y,
                    targetPos.z
                );
                if (
                    targetPathPositionsRef.current.length === 0 ||
                    !Cesium.Cartesian3.equals(
                        newPos,
                        targetPathPositionsRef.current[
                            targetPathPositionsRef.current.length - 1
                        ]
                    )
                ) {
                    targetPathPositionsRef.current = [
                        ...targetPathPositionsRef.current,
                        newPos,
                    ];
                }
            }

            // 更新导弹模型和路径
            if (models.missile) {
                const missilePos = interpolatePosition(
                    prevData.missilePosition,
                    nextData.missilePosition,
                    ratio
                );
                const missileOri = interpolateOrientation(
                    prevData.missileOrientation,
                    nextData.missileOrientation,
                    ratio
                );
                updateModel(models.missile, missilePos, missileOri, "missile");

                // 动态添加路径点
                const newPos = Cesium.Cartesian3.fromDegrees(
                    missilePos.x,
                    missilePos.y,
                    missilePos.z
                );
                if (
                    missilePathPositionsRef.current.length === 0 ||
                    !Cesium.Cartesian3.equals(
                        newPos,
                        missilePathPositionsRef.current[
                            missilePathPositionsRef.current.length - 1
                        ]
                    )
                ) {
                    missilePathPositionsRef.current = [
                        ...missilePathPositionsRef.current,
                        newPos,
                    ];
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
    // Modified startAnimation to handle two models

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
        const cartesianPos = Cesium.Cartesian3.fromDegrees(
            position.x,
            position.y,
            position.z
        );

        // 应用偏移量
        const currentOffsets = offsets[modelType] || {
            yaw: 0,
            pitch: 0,
            roll: 0,
        };
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

    // 处理按钮点击事件
    // Modify the file input handlers to specify model type
    const handleSimulationClick = modelType => () => {
        if (modelType === "target") {
            fileInputRef.current?.click();
        } else {
            missileFileInputRef.current?.click();
        }
    };
    const handleElsxClick = () => elsxRef.current?.click();

    const toggleAnimation = () => {
        if (isPlaying) {
            stopAnimation();
        } else {
            startAnimation();
        }
    };
    // 为上面的代码添加辅助函数：
    const getCurrentAnimationData = () => {
        const elapsed =
            (performance.now() - startTimeRef.current) * speedMultiplier;
        const totalDuration =
            animationDataRef.current[animationDataRef.current.length - 1].time;
        const currentTime = elapsed % totalDuration;

        let currentIndex = 0;
        for (let i = 0; i < animationDataRef.current.length; i++) {
            if (animationDataRef.current[i].time > currentTime) break;
            currentIndex = i;
        }

        return animationDataRef.current[currentIndex];
    };
    const adjustYaw = degrees => {
        if (!models[activeModel]) return;

        setOffsets(prev => {
            const newOffsets = {
                ...prev,
                [activeModel]: {
                    ...prev[activeModel],
                    yaw: prev[activeModel].yaw + degrees,
                },
            };

            // 立即应用新的偏移量
            if (animationDataRef.current?.length > 0) {
                const currentData = isPlaying
                    ? getCurrentAnimationData()
                    : animationDataRef.current[0];

                const position =
                    activeModel === "target"
                        ? currentData.targetPosition
                        : currentData.missilePosition;
                const orientation =
                    activeModel === "target"
                        ? currentData.targetOrientation
                        : currentData.missileOrientation;

                updateModel(
                    models[activeModel],
                    position,
                    orientation,
                    activeModel
                );
            }

            return newOffsets;
        });
    };

    const adjustPitch = degrees => {
        if (!models[activeModel]) return;

        setOffsets(prev => ({
            ...prev,
            [activeModel]: {
                ...prev[activeModel],
                pitch: prev[activeModel].pitch + degrees,
            },
        }));

        const model = models[activeModel];
        const position = Cesium.Matrix4.getTranslation(
            model.modelMatrix,
            new Cesium.Cartesian3()
        );

        const hpr = new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(offsets[activeModel].yaw),
            Cesium.Math.toRadians(offsets[activeModel].pitch + degrees),
            Cesium.Math.toRadians(offsets[activeModel].roll)
        );

        const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(hpr);
        model.modelMatrix =
            Cesium.Matrix4.fromTranslationQuaternionRotationScale(
                position,
                quaternion,
                new Cesium.Cartesian3(1.0, 1.0, 1.0)
            );
    };

    const adjustRoll = degrees => {
        if (!models[activeModel]) return;

        setOffsets(prev => ({
            ...prev,
            [activeModel]: {
                ...prev[activeModel],
                roll: prev[activeModel].roll + degrees,
            },
        }));

        const model = models[activeModel];
        const position = Cesium.Matrix4.getTranslation(
            model.modelMatrix,
            new Cesium.Cartesian3()
        );

        const hpr = new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(offsets[activeModel].yaw),
            Cesium.Math.toRadians(offsets[activeModel].pitch),
            Cesium.Math.toRadians(offsets[activeModel].roll + degrees)
        );

        const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(hpr);
        model.modelMatrix =
            Cesium.Matrix4.fromTranslationQuaternionRotationScale(
                position,
                quaternion,
                new Cesium.Cartesian3(1.0, 1.0, 1.0)
            );
    };
    const resetOrientation = () => {
        if (!models[activeModel]) return;

        // Reset offsets for the active model
        setOffsets(prev => ({
            ...prev,
            [activeModel]: { yaw: 0, pitch: 0, roll: 0 },
        }));

        const model = models[activeModel];
        const position = Cesium.Matrix4.getTranslation(
            model.modelMatrix,
            new Cesium.Cartesian3()
        );

        // Reset to default orientation
        const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(
            new Cesium.HeadingPitchRoll(0, 0, 0)
        );

        model.modelMatrix =
            Cesium.Matrix4.fromTranslationQuaternionRotationScale(
                position,
                quaternion,
                new Cesium.Cartesian3(1.0, 1.0, 1.0)
            );
    };
    const toggleActiveModel = () => {
        setActiveModel(prev => (prev === "target" ? "missile" : "target"));
    };

    const focusFn = () => {
        if (!viewerRef.current) return;
        const cesiumViewer = viewerRef.current.cesiumElement;
        cesiumViewer.camera.flyTo({
            destination: position,
            orientation: {
                heading: Cesium.Math.toRadians(230.0),
                pitch: Cesium.Math.toRadians(-20.0),
                roll: 0.0,
            },
        });
    };

    return (
        <div className="container">
            <header>
                <h1>飞行器可视化仿真软件</h1>
            </header>
            <div className="content">
                <nav>
                    <div className="nav-div">
                        <a href="#" onClick={handleSimulationClick("target")}>
                            加载目标模型
                        </a>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: "none" }}
                            accept=".glb,.gltf"
                            onChange={e =>
                                loadModel(e.target.files[0], "target")
                            }
                        />
                    </div>
                    <div className="nav-div">
                        <a href="#" onClick={handleSimulationClick("missile")}>
                            加载导弹模型
                        </a>
                        <input
                            type="file"
                            ref={missileFileInputRef}
                            style={{ display: "none" }}
                            accept=".glb,.gltf"
                            onChange={e =>
                                loadModel(e.target.files[0], "missile")
                            }
                        />
                    </div>
                    <div className="nav-div">
                        <a href="#" onClick={toggleAnimation}>
                            {isPlaying ? "停止动画" : "开始动画"}
                        </a>
                    </div>
                    <div className="nav-div">
                        <a href="#" onClick={() => setShowForm(true)}>
                            配置参数
                        </a>
                    </div>
                    <div className="nav-div">
                        <a href="#" onClick={handleElsxClick}>
                            导入轨迹
                        </a>
                        <input
                            type="file"
                            ref={elsxRef}
                            style={{ display: "none" }}
                            accept=".xlsx,.xls"
                            onChange={handleXlsxUpload}
                        />
                    </div>
                    <div className="nav-div">
                        <a
                            href="#"
                            onClick={() => {
                                connectWebSocket();
                            }}
                        >
                            {isRealTime ? "停止实时" : "实时轨迹"}
                        </a>
                    </div>
                </nav>

                {showForm && (
                    <Form
                        setPosition1={setPosition1}
                        setPosition2={setPosition2}
                        setShowForm={setShowForm}
                        position1={position1}
                        position2={position2}
                    />
                )}

                <main>
                    <Viewer ref={viewerRef} />
                </main>
            </div>
            <div className="tool-line">
                <button className="tool-btn" onClick={focusFn}>
                    R
                </button>
                <button className="tool-btn" onClick={toggleActiveModel}>
                    切换
                </button>
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
                <button className="tool-btn" onClick={() => adjustSpeed(1)}>
                    X1
                </button>
                <button className="tool-btn" onClick={() => adjustSpeed(2)}>
                    X2
                </button>
                <button className="tool-btn" onClick={() => adjustSpeed(4)}>
                    X4
                </button>
                <button className="tool-btn" onClick={() => adjustSpeed(8)}>
                    X8
                </button>
                <button className="tool-btn" onClick={() => adjustSpeed(16)}>
                    X16
                </button>
                <button className="tool-btn" onClick={() => adjustSpeed(32)}>
                    X32
                </button>
                <button className="tool-btn" onClick={resetOrientation}>
                    复位
                </button>
            </div>
            <div id="dataPanel">Waiting for data...</div>
        </div>
    );
}

export default FirstPage;
