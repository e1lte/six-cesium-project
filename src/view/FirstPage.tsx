import "./FirstPage.css";
import { Viewer, Entity } from "resium";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useRef, useState, useEffect } from "react";

function FirstPage() {
    Cesium.Ion.defaultAccessToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0MmM0OTcxYS01ZTNhLTQwNGEtOWI5My01OTQxMWUxYzkzYmUiLCJpZCI6MjY1NTczLCJpYXQiOjE3MzU0ODQ4MzN9.AsJ-Pj5zQi0s1FGGL7cu0K-U7PcIk45WmdbA9qX7cXc";

    // 北京四环附近的坐标 (望京区域)
    const BEIJING_POSITION = {
        longitude: 116.47,
        latitude: 39.99,
        height: 500,
    };
    const SHANGHAI_POSITION = {
        longitude: 117.47,
        latitude: 40.0,
        height: 200,
    };
    const position = Cesium.Cartesian3.fromDegrees(
        BEIJING_POSITION.longitude,
        BEIJING_POSITION.latitude,
        500
    );
    const position2 = Cesium.Cartesian3.fromDegrees(
        SHANGHAI_POSITION.longitude,
        SHANGHAI_POSITION.latitude,
        500
    );

    const fileInputRef = useRef<HTMLInputElement>(null);
    const viewerRef = useRef(null); // 使用 useRef 保存 Viewer 实例
    const modelRef = useRef(null); // 使用 useRef 保存模型实例
    const [duration, setDuration] = useState(10000);
    useEffect(() => {
        moveTheModel();
    }, [duration]);
    const handleSimulationClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = event => {
        const file = event.target.files[0];
        console.log("file:", file);
        if (!file) return; // 如果没有选择文件，则返回

        console.log("Selected file:", file.name);

        // 加载 .glb 文件
        loadModel(file);
    };

    const moveTheModel = () => {
        if (!modelRef.current) {
            console.error("Model is not loaded!");
            return;
        }

        // 定义目标位置（这里简单示例为向某个方向移动一定距离）
        const targetPosition = Cesium.Cartesian3.add(
            position2,
            new Cesium.Cartesian3(100, 100, 0),
            new Cesium.Cartesian3()
        );

        // 定义动画持续时间（毫秒）
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed >= duration) {
                // 动画结束，将模型移动到目标位置
                modelRef.current.modelMatrix =
                    Cesium.Transforms.eastNorthUpToFixedFrame(targetPosition);
                return;
            }

            // 计算当前进度
            const progress = elapsed / duration;

            // 线性插值计算当前位置
            const currentPosition = Cesium.Cartesian3.lerp(
                position,
                targetPosition,
                progress,
                new Cesium.Cartesian3()
            );

            // 更新模型的 modelMatrix
            modelRef.current.modelMatrix =
                Cesium.Transforms.eastNorthUpToFixedFrame(currentPosition);

            // 请求下一帧动画
            requestAnimationFrame(animate);
        };

        // 开始动画
        requestAnimationFrame(animate);
    };

    const adjustHeading = degrees => {
        if (!modelRef.current) {
            console.error("Model is not loaded!");
            return;
        }

        // 将角度转换为弧度
        const radians = Cesium.Math.toRadians(degrees);

        // 获取当前模型的 modelMatrix
        const modelMatrix = modelRef.current.modelMatrix;

        // 创建一个旋转矩阵
        const rotationMatrix = Cesium.Matrix3.fromRotationZ(radians);

        // 将旋转矩阵应用到模型的 modelMatrix
        Cesium.Matrix4.multiplyByMatrix3(
            modelMatrix,
            rotationMatrix,
            modelMatrix
        );

        // 更新模型的 modelMatrix
        modelRef.current.modelMatrix = modelMatrix;
    };

    const loadModel = async file => {
        if (!viewerRef.current || !viewerRef.current.cesiumElement) {
            console.error("Viewer is not initialized!");
            return;
        }

        // 创建一个临时 URL 来引用上传的文件
        const url = URL.createObjectURL(file);
        console.log("url:", url);

        // 获取 Cesium Viewer 实例
        const cesiumViewer = viewerRef.current.cesiumElement;

        try {
            // 使用 Cesium.Model.fromGltfAsync 加载模型
            const model = await Cesium.Model.fromGltfAsync({
                url: url,
                modelMatrix:
                    Cesium.Transforms.eastNorthUpToFixedFrame(position),
                scale: 10.0, // 根据需要调整模型的缩放比例
            });

            // 将模型添加到场景中
            cesiumViewer.scene.primitives.add(model);
            modelRef.current = model;

            console.log("Model loaded successfully.");

            // 调整相机视角以更好地查看模型
            cesiumViewer.camera.flyTo({
                destination: position,
                orientation: {
                    heading: Cesium.Math.toRadians(230.0),
                    pitch: Cesium.Math.toRadians(-20.0),
                    roll: 0.0,
                },
            });
        } catch (error) {
            console.error("An error occurred while loading the model:", error);
        } finally {
            // 释放临时 URL
            URL.revokeObjectURL(url);
        }
    };

    const adjustSpeed = () => {
        setDuration(30000);
    };

    return (
        <div className="container">
            <header>
                <h1>飞行器可视化仿真软件</h1>
            </header>
            <div className="content">
                <nav>
                    <div className="nav-div">
                        <a href="#" onClick={handleSimulationClick}>
                            仿真显示
                        </a>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: "none" }}
                            accept=".glb"
                            onChange={handleFileUpload}
                        />
                    </div>
                    <div className="nav-div">
                        <a href="#" onClick={moveTheModel}>
                            指令调用
                        </a>
                    </div>
                    <div className="nav-div">
                        <a href="#" onClick={() => adjustHeading(10)}>
                            调整方向
                        </a>
                    </div>

                    <div className="nav-div">
                        <a href="#" onClick={() => adjustSpeed()}>
                            倍速调整
                        </a>
                    </div>
                    <div className="nav-div">
                        <a href="#">实时上传</a>
                    </div>
                </nav>

                <main>
                    <Viewer
                        ref={el => {
                            viewerRef.current = el;
                        }}
                    />
                </main>
            </div>
        </div>
    );
}

export default FirstPage;
